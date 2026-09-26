import pytest
from app.agents.ocean_analytics import OceanAnalyticsAgent, _haversine_km
from app.agents.risk_assessment import RiskAssessmentAgent
from app.models.schemas import AgentResult


@pytest.mark.asyncio
async def test_ocean_analytics_favorable_sst():
    """Test A: Favorable SST (28.5 °C) within [26.5, 30.5] -> marks SST as optimal."""
    agent = OceanAnalyticsAgent()
    bulletins = [{
        "zone_id": "PFZ-TEST-A",
        "lat": 12.9,
        "lon": 74.8,
        "sst_c": 28.5,
        "chlorophyll_mg_m3": 1.2,
    }]
    res = await agent.execute(bulletins)
    assert res.status == "success"
    cand = res.result["candidates"][0]
    assert cand["sst_analysis"]["is_optimal"] is True
    assert cand["sst_analysis"]["status"] == "OPTIMAL"
    assert cand["sst_analysis"]["value_c"] == 28.5


@pytest.mark.asyncio
async def test_ocean_analytics_unfavorable_sst():
    """Test B: Unfavorable SST (32.0 °C and 24.0 °C) -> marks SST as suboptimal."""
    agent = OceanAnalyticsAgent()
    bulletins = [
        {"zone_id": "PFZ-HIGH", "lat": 12.9, "lon": 74.8, "sst_c": 32.0, "chlorophyll_mg_m3": 1.0},
        {"zone_id": "PFZ-LOW", "lat": 13.0, "lon": 74.9, "sst_c": 24.0, "chlorophyll_mg_m3": 1.0}
    ]
    res = await agent.execute(bulletins)
    candidates = {c["zone_id"]: c for c in res.result["candidates"]}
    assert candidates["PFZ-HIGH"]["sst_analysis"]["is_optimal"] is False
    assert candidates["PFZ-HIGH"]["sst_analysis"]["status"] == "SUBOPTIMAL_HIGH"

    assert candidates["PFZ-LOW"]["sst_analysis"]["is_optimal"] is False
    assert candidates["PFZ-LOW"]["sst_analysis"]["status"] == "SUBOPTIMAL_LOW"


@pytest.mark.asyncio
async def test_ocean_analytics_favorable_chlorophyll():
    """Test C: Favorable chlorophyll (1.2 mg/m³) within [0.2, 3.0] -> marks chlorophyll as optimal."""
    agent = OceanAnalyticsAgent()
    bulletins = [{
        "zone_id": "PFZ-TEST-C",
        "lat": 12.9,
        "lon": 74.8,
        "sst_c": 28.0,
        "chlorophyll_mg_m3": 1.2
    }]
    res = await agent.execute(bulletins)
    cand = res.result["candidates"][0]
    assert cand["chlorophyll_analysis"]["is_optimal"] is True
    assert cand["chlorophyll_analysis"]["status"] == "OPTIMAL"
    assert cand["chlorophyll_analysis"]["value_mg_m3"] == 1.2


@pytest.mark.asyncio
async def test_ocean_analytics_suboptimal_chlorophyll():
    """Test D: Suboptimal chlorophyll (0.05 and 4.5 mg/m³) -> marks chlorophyll as suboptimal."""
    agent = OceanAnalyticsAgent()
    bulletins = [
        {"zone_id": "PFZ-LOW-CHL", "lat": 12.9, "lon": 74.8, "sst_c": 28.0, "chlorophyll_mg_m3": 0.05},
        {"zone_id": "PFZ-HIGH-CHL", "lat": 13.0, "lon": 74.9, "sst_c": 28.0, "chlorophyll_mg_m3": 4.5}
    ]
    res = await agent.execute(bulletins)
    candidates = {c["zone_id"]: c for c in res.result["candidates"]}
    assert candidates["PFZ-LOW-CHL"]["chlorophyll_analysis"]["is_optimal"] is False
    assert candidates["PFZ-LOW-CHL"]["chlorophyll_analysis"]["status"] == "SUBOPTIMAL_LOW"

    assert candidates["PFZ-HIGH-CHL"]["chlorophyll_analysis"]["is_optimal"] is False
    assert candidates["PFZ-HIGH-CHL"]["chlorophyll_analysis"]["status"] == "SUBOPTIMAL_HIGH"


@pytest.mark.asyncio
async def test_ocean_analytics_horizontal_thermal_gradient_calculation():
    """Test E: Horizontal thermal gradient calculation with multi-point data produces correct dSST/dd."""
    agent = OceanAnalyticsAgent()
    d_km = _haversine_km(12.9, 74.8, 13.0, 74.8)
    expected_grad = round(abs(28.0 - 29.0) / d_km, 4)

    bulletins = [{
        "zone_id": "PFZ-GRAD",
        "lat": 12.9,
        "lon": 74.8,
        "sst_c": 28.0,
        "chlorophyll_mg_m3": 1.2,
        "spatial_neighbors": [
            {"lat": 13.0, "lon": 74.8, "sst_c": 29.0}
        ]
    }]
    res = await agent.execute(bulletins)
    cand = res.result["candidates"][0]
    assert cand["thermal_front"]["calculation_available"] is True
    assert cand["thermal_front"]["gradient_c_per_km"] == expected_grad
    assert cand["thermal_front"]["front_detected"] == (expected_grad >= 0.05)


@pytest.mark.asyncio
async def test_ocean_analytics_single_point_fallback_no_fabrication():
    """Test F: Single point fallback does NOT fabricate gradient; explicitly sets calculation_available: False."""
    agent = OceanAnalyticsAgent()
    bulletins = [{
        "zone_id": "PFZ-SINGLE",
        "lat": 12.9,
        "lon": 74.8,
        "sst_c": 28.0,
        "chlorophyll_mg_m3": 1.2
    }]
    res = await agent.execute(bulletins)
    cand = res.result["candidates"][0]
    assert cand["thermal_front"]["calculation_available"] is False
    assert cand["thermal_front"]["gradient_c_per_km"] is None
    assert cand["thermal_front"]["front_detected"] is False
    assert "single point" in cand["thermal_front"]["analysis_note"].lower() or "insufficient" in cand["thermal_front"]["analysis_note"].lower()


@pytest.mark.asyncio
async def test_ocean_analytics_candidate_ranking():
    """Test G: Candidate ranking correctly orders multiple PFZ zones by evaluated suitability."""
    agent = OceanAnalyticsAgent()
    bulletins = [
        {"zone_id": "PFZ-BAD", "lat": 12.0, "lon": 74.0, "sst_c": 33.0, "chlorophyll_mg_m3": 0.05},
        {"zone_id": "PFZ-BEST", "lat": 12.5, "lon": 74.5, "sst_c": 28.0, "chlorophyll_mg_m3": 1.5},
        {"zone_id": "PFZ-MID", "lat": 12.2, "lon": 74.2, "sst_c": 28.0, "chlorophyll_mg_m3": 0.05}
    ]
    res = await agent.execute(bulletins)
    candidates = res.result["candidates"]
    assert len(candidates) == 3
    assert candidates[0]["zone_id"] == "PFZ-BEST"
    assert candidates[1]["zone_id"] == "PFZ-MID"
    assert candidates[2]["zone_id"] == "PFZ-BAD"
    assert candidates[0]["evaluated_suitability"] > candidates[1]["evaluated_suitability"]
    assert candidates[1]["evaluated_suitability"] > candidates[2]["evaluated_suitability"]
    assert res.result["recommended_pfz"]["zone_id"] == "PFZ-BEST"


@pytest.mark.asyncio
async def test_ocean_analytics_safety_subordination_in_risk_assessment():
    """Test H: PFZ favorable condition CANNOT override an unsafe weather or geofence condition."""
    ocean_result = AgentResult(
        agent="OceanAnalyticsAgent",
        status="success",
        result={
            "verdict": "FAVORABLE",
            "recommended_pfz": {"zone_id": "PFZ-SUPER", "evaluated_suitability": 1.0},
            "safety_subordinate": True
        }
    )

    unsafe_weather = AgentResult(
        agent="WeatherIntelligenceAgent",
        status="success",
        result={
            "verdict": "UNSAFE",
            "max_wind_kmh": 65.0,
            "max_gust_kmh": 75.0,
            "max_wave_m": 2.0,
            "has_storm": False,
            "reasons": ["Wind speed 65.0 km/h exceeds 50.0 km/h threshold"],
            "conditions_summary": "Dangerous gale winds"
        }
    )

    clear_geo = AgentResult(
        agent="GeospatialReasoningAgent",
        status="success",
        result={"inside_geofence": False, "nearest_boundary_distance_km": 15.0}
    )

    risk_agent = RiskAssessmentAgent()
    res = await risk_agent.execute(
        weather_result=unsafe_weather,
        ocean_result=ocean_result,
        geospatial_result=clear_geo
    )

    # Risk assessment MUST remain UNSAFE despite favorable ocean
    assert res.result["verdict"] == "UNSAFE"
    assert res.result["ocean_summary"]["verdict"] == "FAVORABLE"
    assert any("wind" in r.lower() for r in res.result["primary_drivers"])
