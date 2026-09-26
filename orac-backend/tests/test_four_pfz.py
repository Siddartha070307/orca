"""Targeted tests for Phase 2A: Four-PFZ Backend Enhancement.

Validates that:
1. Every coastal sector and offshore point in INCOIS mock provides exactly FOUR PFZ candidates.
2. Candidate IDs and coordinates are distinct within each sector.
3. Required candidate keys and provenance metadata are preserved on all 4 candidates.
4. Ocean Analytics deterministically sorts and ranks all 4 candidates by evaluated_suitability,
   assigning pfz_rank (1..4) and marking exactly one as is_recommended (Rank 1).
5. Geospatial Reasoning enriches all 4 candidates with user-relative navigation metrics and geofence checks.
6. Visualization Agent creates GeoJSON features for all 4 PFZs (with RFC 7946 [lon, lat]),
   targets the nav-course-vector to the recommended PFZ, and computes map_bounds enclosing all points.
7. Safety hierarchy subordination: favorable PFZs never override UNSAFE weather or restricted zones.
"""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch

from app.integrations.incois_mock import incois_provider
from app.agents.ocean_analytics import ocean_analytics_agent
from app.agents.geospatial_reasoning import geospatial_reasoning_agent
from app.agents.visualization import visualization_agent
from app.agents.risk_assessment import risk_assessment_agent
from app.models.schemas import AgentResult
from app.main import app

client = TestClient(app)


def test_1_all_34_sectors_return_exactly_four_candidates():
    """Requirement 1: Every matched INCOIS sector provides exactly 4 PFZ candidates."""
    sectors = incois_provider.COASTAL_SECTORS
    assert len(sectors) >= 30, f"Expected at least 30 sectors, got {len(sectors)}"

    for sec in sectors:
        sector_name = sec["sector"]
        candidates = incois_provider.get_pfz_advisories(sec["port_lat"], sec["port_lon"])
        assert len(candidates) == 4, (
            f"Sector '{sector_name}' returned {len(candidates)} candidates, expected 4"
        )


def test_2_candidate_ids_and_coordinates_are_unique_and_distinct():
    """Requirement 2: Within each sector, candidate IDs and coordinates must be unique and distinct."""
    for sec in incois_provider.COASTAL_SECTORS:
        sector_name = sec["sector"]
        candidates = incois_provider.get_pfz_advisories(sec["port_lat"], sec["port_lon"])
        ids = [c["id"] for c in candidates]
        coords = [(c["lat"], c["lon"]) for c in candidates]

        # Unique IDs
        assert len(set(ids)) == 4, f"Duplicate IDs in sector '{sector_name}': {ids}"

        # Distinct coordinates
        assert len(set(coords)) == 4, f"Duplicate coordinates in sector '{sector_name}': {coords}"

        # Non-empty IDs
        for cid in ids:
            assert cid and len(cid.strip()) > 0, f"Empty candidate ID in sector '{sector_name}'"


def test_3_required_candidate_schema_fields_present():
    """Requirement 3: Candidate schema includes all required oceanographic and metadata fields."""
    required_keys = [
        "id", "lat", "lon", "depth_m", "sst_c", "chlorophyll_mg_m3",
        "suitability_score", "fish_density_index", "target_species", "feature", "distance_km", "bearing_deg",
        "source_distance_km", "source_bearing_deg"
    ]
    candidates = incois_provider.get_pfz_advisories(12.87, 74.84)  # Mangalore
    assert len(candidates) == 4

    for c in candidates:
        for key in required_keys:
            assert key in c, f"Missing required key '{key}' in candidate {c.get('id')}"
        assert isinstance(c["target_species"], list) and len(c["target_species"]) > 0
        assert 15.0 <= c["sst_c"] <= 35.0, f"SST out of realistic range: {c['sst_c']}"
        assert c["chlorophyll_mg_m3"] > 0.0, f"Chlorophyll must be positive: {c['chlorophyll_mg_m3']}"
        assert 0.0 <= c["suitability_score"] <= 1.0, f"Suitability score not in [0, 1]: {c['suitability_score']}"
        assert 0.0 <= c["fish_density_index"] <= 10.0, f"Fish density index not in [0, 10]: {c['fish_density_index']}"


def test_4_offshore_fallback_returns_four_dynamic_candidates():
    """Requirement 4: Far offshore locations (>300 km from coastal sectors) produce 4 dynamic candidates."""
    # Point deep in Arabian Sea (lat=12.0, lon=64.0) far from any coastal sector
    offshore_lat, offshore_lon = 12.0, 64.0
    candidates = incois_provider.get_pfz_advisories(offshore_lat, offshore_lon)

    assert len(candidates) == 4
    expected_ids = {"PFZ-DYN-01", "PFZ-DYN-02", "PFZ-DYN-03", "PFZ-DYN-04"}
    actual_ids = {c["id"] for c in candidates}
    assert actual_ids == expected_ids, f"Expected {expected_ids}, got {actual_ids}"

    coords = [(c["lat"], c["lon"]) for c in candidates]
    assert len(set(coords)) == 4, "Offshore candidates must have distinct coordinates"


@pytest.mark.asyncio
async def test_5_ocean_analytics_ranking_and_recommendation():
    """Requirement 5: OceanAnalyticsAgent ranks all 4 candidates descending by suitability."""
    coords = {"lat": 12.87, "lon": 74.84}
    bulletins = incois_provider.get_pfz_advisories(coords["lat"], coords["lon"])
    assert len(bulletins) == 4

    res = await ocean_analytics_agent.execute(pfz_bulletins=bulletins, location=coords)
    assert res.status == "success"

    candidates = res.result["pfz_candidates"]
    assert len(candidates) == 4

    # Verify descending sort by evaluated_suitability
    scores = [c["evaluated_suitability"] for c in candidates]
    assert scores == sorted(scores, reverse=True), f"Candidates not sorted descending: {scores}"

    # Verify rank assignments 1 to 4
    ranks = [c["pfz_rank"] for c in candidates]
    assert ranks == [1, 2, 3, 4], f"Expected ranks [1, 2, 3, 4], got {ranks}"

    # Exactly one recommended candidate (Rank 1)
    rec_flags = [c["is_recommended"] for c in candidates]
    assert rec_flags == [True, False, False, False], f"Expected [True, False, False, False], got {rec_flags}"

    # Recommended PFZ in result matches rank 1
    assert res.result["recommended_pfz"]["id"] == candidates[0]["id"]
    assert res.result["recommended_pfz"]["pfz_rank"] == 1
    assert res.result["recommended_pfz"]["is_recommended"] is True


@pytest.mark.asyncio
async def test_6_geospatial_reasoning_enriches_all_four():
    """Requirement 6: GeospatialReasoningAgent calculates user-relative distance/bearing and restricted zone flag for all 4."""
    user_coords = {"lat": 14.82, "lon": 74.19}  # Karwar vessel
    bulletins = incois_provider.get_pfz_advisories(user_coords["lat"], user_coords["lon"])
    ocean_res = await ocean_analytics_agent.execute(pfz_bulletins=bulletins, location=user_coords)

    geo_res = await geospatial_reasoning_agent.execute(
        user_coords=user_coords,
        ocean_result=ocean_res
    )
    assert geo_res.status == "success"

    enriched = geo_res.result["pfz_candidates"]
    assert len(enriched) == 4

    for c in enriched:
        assert "distance_user_km" in c
        assert "bearing_user_deg" in c
        assert "calculated_distance_km" in c
        assert "calculated_bearing_deg" in c
        assert "distance_km" in c
        assert "bearing_deg" in c
        assert "source_distance_km" in c
        assert "source_bearing_deg" in c
        assert "is_in_restricted_zone" in c
        assert isinstance(c["is_in_restricted_zone"], bool)
        assert c["distance_km"] > 0
        assert 0 <= c["bearing_deg"] < 360


@pytest.mark.asyncio
async def test_7_visualization_geojson_contains_all_four_candidates():
    """Requirement 7: VisualizationAgent generates GeoJSON with 4 PFZ points, nav vector to Rank 1, and bounds."""
    user_coords = {"lat": 12.87, "lon": 74.84}
    bulletins = incois_provider.get_pfz_advisories(user_coords["lat"], user_coords["lon"])
    ocean_res = await ocean_analytics_agent.execute(pfz_bulletins=bulletins, location=user_coords)
    geo_res = await geospatial_reasoning_agent.execute(user_coords=user_coords, ocean_result=ocean_res)

    # Mock weather and risk
    mock_weather = AgentResult(
        agent="WeatherIntelligenceAgent",
        status="success",
        result={"verdict": "SAFE", "metrics": {"forecast_available": True}, "hourly_series": {"times": ["2026-09-12T12:00:00+05:30"], "wind_speed_kmh": [15.0], "wave_height_m": [1.0]}}
    )
    mock_risk = AgentResult(
        agent="RiskAssessmentAgent",
        status="success",
        result={"verdict": "SAFE"}
    )

    viz_res = await visualization_agent.execute(
        user_coords=user_coords,
        weather_result=mock_weather,
        ocean_result=ocean_res,
        risk_result=mock_risk,
        geospatial_result=geo_res
    )
    assert viz_res.status == "success"

    geojson = viz_res.result["geojson"]
    features = geojson["features"]

    # Filter PFZ features
    pfz_features = [f for f in features if f.get("properties", {}).get("category") == "pfz"]
    assert len(pfz_features) == 4, f"Expected 4 PFZ features, got {len(pfz_features)}"

    # Check ranks 1 to 4 present in features
    ranks = [f["properties"]["pfz_rank"] for f in pfz_features]
    assert sorted(ranks) == [1, 2, 3, 4]

    # Verify RFC 7946 coordinates [lon, lat] format
    for f in pfz_features:
        coords = f["geometry"]["coordinates"]
        assert len(coords) == 2
        lon, lat = coords[0], coords[1]
        assert f["properties"]["lon"] == lon
        assert f["properties"]["lat"] == lat

    # Verify recommended PFZ styling vs others
    rec_feat = next(f for f in pfz_features if f["properties"]["is_recommended"] is True)
    assert rec_feat["properties"]["pfz_rank"] == 1
    assert rec_feat["properties"]["marker-color"] == "#059669"
    assert rec_feat["properties"]["marker-symbol"] == "star"

    non_rec_feats = [f for f in pfz_features if f["properties"]["is_recommended"] is False]
    assert len(non_rec_feats) == 3
    for f in non_rec_feats:
        assert f["properties"]["marker-color"] == "#0d9488"
        assert f["properties"]["marker-symbol"] == "circle"

    # Verify nav-course-vector targets the recommended PFZ
    nav_vector = next((f for f in features if f.get("properties", {}).get("id") == "nav-course-vector"), None)
    assert nav_vector is not None
    assert nav_vector["properties"]["target_pfz_id"] == rec_feat["properties"]["id"]
    assert nav_vector["geometry"]["coordinates"][0] == [user_coords["lon"], user_coords["lat"]]
    assert nav_vector["geometry"]["coordinates"][1] == [rec_feat["properties"]["lon"], rec_feat["properties"]["lat"]]

    # Verify map_bounds covers vessel and all 4 candidates
    bounds = viz_res.result["map_bounds"]
    assert bounds is not None and len(bounds) == 4
    min_lon, min_lat, max_lon, max_lat = bounds
    assert min_lon <= user_coords["lon"] <= max_lon
    assert min_lat <= user_coords["lat"] <= max_lat
    for f in pfz_features:
        assert min_lon <= f["properties"]["lon"] <= max_lon
        assert min_lat <= f["properties"]["lat"] <= max_lat


def test_8_end_to_end_query_returns_four_candidates_in_geojson_and_traces():
    """Requirement 8: Full /query API returns all 4 PFZ features in visualization GeoJSON and traces."""
    resp = client.post("/query", json={
        "text": "Find good fishing spots near Mangalore tomorrow morning",
        "user_type": "app",
        "location": {"lat": 12.87, "lon": 74.84}
    })
    assert resp.status_code == 200
    data = resp.json()

    # GeoJSON verification
    features = data["visualization"]["geojson"]["features"]
    pfz_features = [f for f in features if f.get("properties", {}).get("category") == "pfz"]
    assert len(pfz_features) == 4, f"Expected 4 PFZ features in /query response, got {len(pfz_features)}"

    # OceanAnalytics trace verification
    ocean_trace = next(t for t in data["agent_traces"] if t["agent"] == "OceanAnalyticsAgent")
    assert ocean_trace["result"]["bulletins_count"] == 4
    assert len(ocean_trace["result"]["pfz_candidates"]) == 4

    # Top candidate is recommended
    assert ocean_trace["result"]["recommended_pfz"]["pfz_rank"] == 1


def test_9_safety_hierarchy_subordination_with_four_candidates():
    """Requirement 9: Favorable PFZ candidates NEVER override UNSAFE weather or restricted zone verdicts."""
    # Case A: Severe weather with gale-force winds (>55 km/h)
    severe_atm = {
        "current": {"wind_speed_10m": 62.0, "wind_gusts_10m": 78.0, "temperature_2m": 27.0, "weather_code": 2},
        "hourly": {
            "time": ["2026-09-12T06:00:00Z"],
            "wind_speed_10m": [62.0],
            "wind_gusts_10m": [78.0],
            "weather_code": [2],
            "temperature_2m": [27.0],
            "precipitation": [10.0]
        }
    }
    severe_marine = {
        "current": {"wave_height": 3.8, "wave_period": 9.0},
        "hourly": {
            "time": ["2026-09-12T06:00:00Z"],
            "wave_height": [3.8]
        }
    }

    with patch("app.integrations.weather_client.weather_client._fetch_atmospheric_forecast", return_value=severe_atm), \
         patch("app.integrations.weather_client.weather_client._fetch_marine_waves", return_value=severe_marine):

        resp = client.post("/query", json={
            "text": "Can I sail to the PFZ near Mangalore right now?",
            "user_type": "app",
            "location": {"lat": 12.87, "lon": 74.84}
        })
        assert resp.status_code == 200
        data = resp.json()

        # Despite 4 PFZ candidates being present, verdict MUST be strictly UNSAFE
        assert data["verdict"] == "UNSAFE"
        assert "UNSAFE" in data["report"]
        assert any("HARD CONSTRAINT" in d or "wind" in d.lower() or "wave" in d.lower() for d in data.get("safety_summary", "").split())


@pytest.mark.asyncio
async def test_10_fish_density_index_single_source_of_truth_and_propagation():
    """Requirement 10: fish_density_index is minted once at INCOIS source and propagated unchanged through the entire pipeline."""
    coords = {"lat": 12.87, "lon": 74.84}
    # 1. Source bulletins from INCOIS mock
    bulletins = incois_provider.get_pfz_advisories(coords["lat"], coords["lon"])
    assert len(bulletins) == 4
    source_fdis = {c["id"]: c["fish_density_index"] for c in bulletins}
    for cid, fdi in source_fdis.items():
        assert fdi is not None and 0.0 <= fdi <= 10.0, f"Invalid FDI {fdi} for {cid}"

    # 2. Ocean Analytics propagation
    ocean_res = await ocean_analytics_agent.execute(pfz_bulletins=bulletins, location=coords)
    oa_candidates = ocean_res.result["candidates"]
    for c in oa_candidates:
        cid = c["id"]
        assert c["fish_density_index"] == source_fdis[cid], (
            f"OceanAnalytics mutated FDI for {cid}: expected {source_fdis[cid]}, got {c['fish_density_index']}"
        )

    # 3. Geospatial Reasoning propagation
    geo_res = await geospatial_reasoning_agent.execute(user_coords=coords, ocean_result=ocean_res)
    geo_candidates = geo_res.result["candidates"]
    for c in geo_candidates:
        cid = c["id"]
        assert c["fish_density_index"] == source_fdis[cid], (
            f"GeospatialReasoning mutated FDI for {cid}: expected {source_fdis[cid]}, got {c['fish_density_index']}"
        )

    # 4. Visualization GeoJSON propagation
    mock_weather = AgentResult(
        agent="WeatherIntelligenceAgent",
        status="success",
        result={"verdict": "SAFE", "metrics": {"forecast_available": True}, "hourly_series": {"times": ["2026-09-12T12:00:00+05:30"], "wind_speed_kmh": [15.0], "wave_height_m": [1.0]}}
    )
    mock_risk = AgentResult(agent="RiskAssessmentAgent", status="success", result={"verdict": "SAFE"})

    viz_res = await visualization_agent.execute(
        user_coords=coords,
        weather_result=mock_weather,
        ocean_result=ocean_res,
        risk_result=mock_risk,
        geospatial_result=geo_res
    )
    features = viz_res.result["geojson"]["features"]
    pfz_features = [f for f in features if f.get("properties", {}).get("category") == "pfz"]
    assert len(pfz_features) == 4
    for f in pfz_features:
        p = f["properties"]
        cid = p["id"]
        assert p["fish_density_index"] == source_fdis[cid], (
            f"Visualization GeoJSON mutated FDI for {cid}: expected {source_fdis[cid]}, got {p['fish_density_index']}"
        )

    # 5. End-to-end /query API response propagation
    resp = client.post("/query", json={
        "text": "Where is the best fishing spot near Mangalore right now?",
        "user_type": "app",
        "location": coords
    })
    assert resp.status_code == 200
    api_data = resp.json()
    api_pfz_features = [f for f in api_data["visualization"]["geojson"]["features"] if f.get("properties", {}).get("category") == "pfz"]
    assert len(api_pfz_features) == 4
    for f in api_pfz_features:
        p = f["properties"]
        cid = p["id"]
        assert p["fish_density_index"] == source_fdis[cid], (
            f"API GeoJSON mutated FDI for {cid}: expected {source_fdis[cid]}, got {p['fish_density_index']}"
        )

