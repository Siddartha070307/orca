"""Regression tests for PFZ distance and bearing consistency.

Validates that:
1. Static source bulletin metadata (from coastal reference port) is preserved in `source_distance_km` and `source_bearing_deg`.
2. Dynamic user-relative navigation values are calculated from the vessel's actual coordinates in:
   - `distance_user_km`
   - `bearing_user_deg`
   - `calculated_distance_km`
   - `calculated_bearing_deg`
   - `distance_km`
   - `bearing_deg`
3. Geospatial Reasoning, Ocean Analytics, Visualization, Reporting, and Dissemination (SMS and NAVIC Satellite)
   all consistently report the user-relative navigation values (~98.1 km, ~312° for Karwar -> Goa offshore PFZ).
4. Distance and bearing change dynamically for different user positions (not hardcoded).
5. Safety hierarchy subordination is preserved: favorable PFZ never overrides UNSAFE or CAUTION.
"""
import pytest
from app.integrations.incois_mock import incois_provider
from app.agents.ocean_analytics import ocean_analytics_agent
from app.agents.geospatial_reasoning import geospatial_reasoning_agent
from app.agents.visualization import visualization_agent
from app.agents.reporting import reporting_agent
from app.agents.risk_assessment import risk_assessment_agent
from app.dissemination.router import dissemination_router
from app.models.schemas import AgentResult


@pytest.mark.asyncio
async def test_incois_mock_distinguishes_source_and_user_relative_pfz():
    """Test user at (14.82, 74.19) computes ~98.1 km @ 312° while keeping source 33 km @ 255°."""
    lat, lon = 14.82, 74.19
    bulletins = incois_provider.get_pfz_advisories(lat, lon)
    assert len(bulletins) > 0
    goa_pfz = next((b for b in bulletins if b["id"] == "PFZ-GOA-01"), bulletins[0])

    # 1. Source bulletin metadata from Panaji port is preserved
    assert goa_pfz["source_distance_km"] == 33.0
    assert goa_pfz["source_bearing_deg"] == 255

    # 2. User-relative navigation values are dynamically calculated from coordinates
    assert abs(goa_pfz["distance_user_km"] - 98.1) < 0.5
    assert abs(goa_pfz["bearing_user_deg"] - 312) <= 1
    assert abs(goa_pfz["calculated_distance_km"] - 98.1) < 0.5
    assert abs(goa_pfz["calculated_bearing_deg"] - 312) <= 1
    assert abs(goa_pfz["distance_km"] - 98.1) < 0.5
    assert abs(goa_pfz["bearing_deg"] - 312) <= 1


@pytest.mark.asyncio
async def test_ocean_analytics_preserves_and_synchronizes_pfz_navigation():
    """Test Ocean Analytics calculates user-relative distance/bearing and keeps source metadata."""
    coords = {"lat": 14.82, "lon": 74.19}
    bulletins = incois_provider.get_pfz_advisories(coords["lat"], coords["lon"])
    res = await ocean_analytics_agent.execute(pfz_bulletins=bulletins, location=coords)
    assert res.status == "success"

    recommended = res.result["recommended_pfz"]
    assert recommended is not None
    # Source provenance
    assert recommended["source_distance_km"] == 33.0
    assert recommended["source_bearing_deg"] == 255
    # Dynamic navigation
    assert abs(recommended["distance_user_km"] - 98.1) < 0.5
    assert abs(recommended["bearing_user_deg"] - 312) <= 1
    assert abs(recommended["distance_km"] - 98.1) < 0.5
    assert abs(recommended["bearing_deg"] - 312) <= 1


@pytest.mark.asyncio
async def test_geospatial_reasoning_calculates_matching_user_relative_pfz():
    """Test Geospatial Reasoning produces consistent distance and bearing on candidates."""
    coords = {"lat": 14.82, "lon": 74.19}
    raw_pfz = [
        {
            "id": "PFZ-GOA-01",
            "lat": 15.42,
            "lon": 73.52,
            "distance_km": 33.0,
            "bearing_deg": 255
        }
    ]
    res = await geospatial_reasoning_agent.execute(user_coords=coords, pfz_candidates=raw_pfz)
    assert res.status == "success"

    candidate = res.result["candidates"][0]
    assert candidate["source_distance_km"] == 33.0
    assert candidate["source_bearing_deg"] == 255
    assert abs(candidate["calculated_distance_km"] - 98.1) < 0.5
    assert candidate["calculated_bearing_deg"] == 312
    assert abs(candidate["distance_user_km"] - 98.1) < 0.5
    assert candidate["bearing_user_deg"] == 312
    assert abs(candidate["distance_km"] - 98.1) < 0.5
    assert candidate["bearing_deg"] == 312


@pytest.mark.asyncio
async def test_visualization_uses_user_relative_values_in_point_and_linestring():
    """Test Visualization GeoJSON uses user-relative values (~98.1 km @ 312°) for point and line."""
    coords = {"lat": 14.82, "lon": 74.19}
    ocean_res = AgentResult(
        agent="OceanAnalyticsAgent",
        status="success",
        location=coords,
        result={
            "recommended_pfz": {
                "id": "PFZ-GOA-01",
                "lat": 15.42,
                "lon": 73.52,
                "sst_c": 28.4,
                "chlorophyll_mg_m3": 1.25,
                "evaluated_suitability": 0.87,
                "distance_km": 98.1,
                "bearing_deg": 312,
                "distance_user_km": 98.1,
                "bearing_user_deg": 312,
                "calculated_distance_km": 98.1,
                "calculated_bearing_deg": 312,
                "source_distance_km": 33.0,
                "source_bearing_deg": 255,
                "target_species": ["Kingfish", "Mackerel"]
            }
        }
    )

    viz_res = await visualization_agent.execute(user_coords=coords, ocean_result=ocean_res)
    assert viz_res.status in ("success", "partial")

    features = viz_res.result["geojson"]["features"]
    pfz_point = next(f for f in features if f["properties"].get("category") == "pfz")
    course_vector = next(f for f in features if f["properties"].get("id") == "nav-course-vector")

    # Point feature properties
    assert pfz_point["properties"]["distance_km"] == 98.1
    assert pfz_point["properties"]["bearing_deg"] == 312
    assert pfz_point["properties"]["source_distance_km"] == 33.0
    assert pfz_point["properties"]["source_bearing_deg"] == 255

    # LineString course vector
    assert course_vector["geometry"]["type"] == "LineString"
    assert course_vector["geometry"]["coordinates"] == [[74.19, 14.82], [73.52, 15.42]]
    assert course_vector["properties"]["title"] == "Course Vector (98.1 km @ 312°)"
    assert course_vector["properties"]["distance_km"] == 98.1
    assert course_vector["properties"]["bearing_deg"] == 312


@pytest.mark.asyncio
async def test_dissemination_channels_use_user_relative_pfz():
    """Test SMS and Satellite routing outputs transmit user-relative 98 km @ 312°."""
    coords = {"lat": 14.82, "lon": 74.19}
    weather_res = AgentResult(
        agent="WeatherIntelligenceAgent",
        status="success",
        location=coords,
        result={"metrics": {"wind_speed_kmh": 20.0, "wave_height_m": 1.2}}
    )
    ocean_res = AgentResult(
        agent="OceanAnalyticsAgent",
        status="success",
        location=coords,
        result={
            "recommended_pfz": {
                "id": "PFZ-GOA-01",
                "distance_km": 98.1,
                "bearing_deg": 312,
                "distance_user_km": 98.1,
                "bearing_user_deg": 312,
                "calculated_distance_km": 98.1,
                "calculated_bearing_deg": 312,
                "source_distance_km": 33.0,
                "source_bearing_deg": 255
            },
            "candidates": [
                {
                    "id": "PFZ-GOA-01",
                    "distance_km": 98.1,
                    "bearing_deg": 312,
                    "distance_user_km": 98.1,
                    "bearing_user_deg": 312
                }
            ]
        }
    )

    # 1. Near-shore SMS channel
    sms_payload = await dissemination_router.route(
        user_type="boat_near_shore",
        verdict="SAFE",
        location_name="Karwar",
        location_coords=coords,
        report_text="Safe report",
        weather_result=weather_res,
        ocean_result=ocean_res
    )
    sms_text = sms_payload.metadata["raw_sms"]
    assert "98km@312deg" in sms_text
    assert "33km@255deg" not in sms_text

    # 2. Open-sea Satellite channel
    sat_payload = await dissemination_router.route(
        user_type="boat_open_sea",
        verdict="SAFE",
        location_name="Karwar",
        location_coords=coords,
        report_text="Safe report",
        weather_result=weather_res,
        ocean_result=ocean_res
    )
    sat_decoded = sat_payload.content["decoded_telemetry"]
    assert sat_decoded["pfz_vector"] == "98.1 km @ 312°"
    telegram = sat_payload.content["raw_telegram"]
    assert ",312,98.1*" in telegram


@pytest.mark.asyncio
async def test_reporting_summary_quotes_user_relative_pfz():
    """Test Reporting Agent safety summary quotes user-relative distance (98.1km)."""
    coords = {"lat": 14.82, "lon": 74.19}
    risk_res = AgentResult(agent="RiskAssessmentAgent", status="success", location=coords, result={"verdict": "SAFE", "primary_drivers": []})
    weather_res = AgentResult(agent="WeatherIntelligenceAgent", status="success", location=coords, result={"metrics": {"wind_speed_kmh": 20.0, "wave_height_m": 1.2}})
    ocean_res = AgentResult(
        agent="OceanAnalyticsAgent",
        status="success",
        location=coords,
        result={
            "candidates": [
                {
                    "id": "PFZ-GOA-01",
                    "distance_km": 98.1,
                    "bearing_deg": 312,
                    "distance_user_km": 98.1,
                    "bearing_user_deg": 312,
                    "source_distance_km": 33.0,
                    "source_bearing_deg": 255
                }
            ]
        }
    )

    report_res = await reporting_agent.execute(
        query="Is it safe to fish?",
        location_name="Karwar",
        risk_result=risk_res,
        weather_result=weather_res,
        ocean_result=ocean_res
    )
    summary = report_res.result["safety_summary"]
    assert "PFZ: 98.1km offshore" in summary
    assert "PFZ: 33km offshore" not in summary


@pytest.mark.asyncio
async def test_dynamic_responsiveness_for_different_user_coordinates():
    """Test changing user coordinates produces dynamic, non-hardcoded distance and bearing."""
    # User at Mangalore (12.87, 74.84) targeting Goa PFZ (15.42, 73.52)
    mng_lat, mng_lon = 12.87, 74.84
    bulletins = incois_provider.get_pfz_advisories(mng_lat, mng_lon, sector_name="Goa")
    goa_pfz = next((b for b in bulletins if b["id"] == "PFZ-GOA-01"), bulletins[0])

    # Distance Mangalore -> Goa PFZ is ~318 km, bearing ~333°
    assert goa_pfz["source_distance_km"] == 33.0
    assert goa_pfz["source_bearing_deg"] == 255
    assert goa_pfz["distance_user_km"] > 250.0  # Not 98.1!
    assert goa_pfz["distance_km"] > 250.0
    assert goa_pfz["bearing_deg"] != 312  # Dynamic bearing, not 312!


@pytest.mark.asyncio
async def test_safety_hierarchy_subordination_with_favorable_pfz():
    """Test favorable PFZ (score 0.95) never overrides UNSAFE weather or geofence violation."""
    coords = {"lat": 14.82, "lon": 74.19}
    # Unsafe weather: 55 km/h wind
    weather_unsafe = AgentResult(
        agent="WeatherIntelligenceAgent",
        status="success",
        location=coords,
        result={"verdict": "UNSAFE", "reasons": ["Wind speed 55.0 km/h exceeds unsafe threshold 50.0 km/h."]}
    )
    ocean_favorable = AgentResult(
        agent="OceanAnalyticsAgent",
        status="success",
        location=coords,
        result={
            "verdict": "FAVORABLE",
            "recommended_pfz": {"id": "PFZ-GOA-01", "evaluated_suitability": 0.95, "distance_user_km": 98.1, "bearing_user_deg": 312}
        }
    )
    geo_safe = AgentResult(
        agent="GeospatialReasoningAgent",
        status="success",
        location=coords,
        result={"verdict": "SAFE", "inside_geofence": False, "nearest_boundary_distance_km": 50.0}
    )

    risk_res = await risk_assessment_agent.execute(
        weather_result=weather_unsafe,
        ocean_result=ocean_favorable,
        geospatial_result=geo_safe,
        location=coords
    )
    assert risk_res.result["verdict"] == "UNSAFE"
    assert risk_res.result["ocean_summary"]["verdict"] == "FAVORABLE"
    assert "Wind speed" in " ".join(risk_res.result["primary_drivers"])


@pytest.mark.asyncio
async def test_stale_ambiguous_fields_overridden_by_direct_coordinate_calculation():
    """Requirement 3: Stale distance_km=33 and bearing_deg=255 with omitted dynamic fields
    must be ignored in favor of direct coordinate calculation (~98.1 km, ~312°)
    in both VisualizationAgent and DisseminationRouter."""
    user_coords = {"lat": 14.82, "lon": 74.19}
    # Deliberately stale distance_km / bearing_deg, omitting all dynamic normalized fields:
    stale_pfz = {
        "id": "PFZ-STALE-TEST",
        "lat": 15.42,
        "lon": 73.52,
        "distance_km": 33.0,
        "bearing_deg": 255,
        "sst_c": 28.4,
        "chlorophyll_mg_m3": 1.25,
        "evaluated_suitability": 0.88,
        "target_species": ["Mackerel"]
    }

    ocean_res = AgentResult(
        agent="OceanAnalyticsAgent",
        status="success",
        location=user_coords,
        result={
            "recommended_pfz": stale_pfz,
            "candidates": [stale_pfz]
        }
    )
    weather_res = AgentResult(
        agent="WeatherIntelligenceAgent",
        status="success",
        location=user_coords,
        result={"metrics": {"wind_speed_kmh": 20.0, "wave_height_m": 1.2}}
    )

    # 1. Verify VisualizationAgent
    viz_res = await visualization_agent.execute(
        user_coords=user_coords,
        ocean_result=ocean_res,
        weather_result=weather_res
    )
    features = viz_res.result["geojson"]["features"]
    pfz_point = next(f for f in features if f["properties"].get("id") == "PFZ-STALE-TEST")
    course_vector = next(f for f in features if f["properties"].get("id") == "nav-course-vector")

    # Point feature navigation fields must use calculated coordinates (~98.1 km @ 312°) NOT stale 33 / 255
    assert abs(pfz_point["properties"]["distance_km"] - 98.1) < 0.5
    assert abs(pfz_point["properties"]["bearing_deg"] - 312) <= 1
    assert abs(pfz_point["properties"]["distance_user_km"] - 98.1) < 0.5
    assert abs(pfz_point["properties"]["bearing_user_deg"] - 312) <= 1
    # Legitimate source metadata preserved
    assert pfz_point["properties"]["source_distance_km"] == 33.0
    assert pfz_point["properties"]["source_bearing_deg"] == 255

    # LineString course vector must also use calculated navigation (~98.1 km @ 312°)
    assert course_vector["properties"]["title"] == "Course Vector (98.1 km @ 312°)"
    assert abs(course_vector["properties"]["distance_km"] - 98.1) < 0.5
    assert abs(course_vector["properties"]["bearing_deg"] - 312) <= 1

    # 2. Verify DisseminationRouter for both SMS and Satellite
    sms_payload = await dissemination_router.route(
        user_type="boat_near_shore",
        verdict="SAFE",
        location_name="Karwar",
        location_coords=user_coords,
        report_text="Marine advisory",
        weather_result=weather_res,
        ocean_result=ocean_res
    )
    sms_text = sms_payload.metadata["raw_sms"]
    assert "98km@312deg" in sms_text
    assert "33km@255deg" not in sms_text

    sat_payload = await dissemination_router.route(
        user_type="boat_open_sea",
        verdict="SAFE",
        location_name="Karwar",
        location_coords=user_coords,
        report_text="Marine advisory",
        weather_result=weather_res,
        ocean_result=ocean_res
    )
    sat_decoded = sat_payload.content["decoded_telemetry"]
    assert sat_decoded["pfz_vector"] == "98.1 km @ 312°"
    telegram = sat_payload.content["raw_telegram"]
    assert ",312,98.1*" in telegram

