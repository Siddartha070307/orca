"""Unit tests for individual ORCA agents and the deterministic safety hierarchy."""
import pytest
from app.core.safety_rules import (
    evaluate_weather_safety,
    evaluate_geospatial_safety,
    arbitrate_safety_hierarchy,
    SafetyVerdict
)
from app.agents.weather_intelligence import weather_intelligence_agent
from app.agents.ocean_analytics import ocean_analytics_agent
from app.agents.geospatial_reasoning import geospatial_reasoning_agent
from app.agents.risk_assessment import risk_assessment_agent
from app.models.schemas import AgentResult


@pytest.mark.asyncio
async def test_weather_intelligence_thresholds():
    """Verify deterministic weather safety rules."""
    # Test safe conditions
    verdict, reasons, metrics = evaluate_weather_safety(wind_speed=20.0, wave_height=1.2)
    assert verdict == SafetyVerdict.SAFE
    assert metrics["wind_speed_kmh"] == 20.0
    assert metrics["wave_height_m"] == 1.2

    # Test caution conditions (wave > 2.0m)
    verdict, reasons, _ = evaluate_weather_safety(wind_speed=20.0, wave_height=2.5)
    assert verdict == SafetyVerdict.CAUTION

    # Test hard constraint unsafe conditions (wind > 50km/h)
    verdict, reasons, _ = evaluate_weather_safety(wind_speed=55.0, wave_height=1.5)
    assert verdict == SafetyVerdict.UNSAFE
    assert any("HARD CONSTRAINT" in r for r in reasons)

    # Test storm alert hard constraint
    verdict, reasons, _ = evaluate_weather_safety(
        wind_speed=25.0, wave_height=1.2, has_storm_alert=True, storm_description="Cyclone Alert"
    )
    assert verdict == SafetyVerdict.UNSAFE


@pytest.mark.asyncio
async def test_weather_intelligence_agent_contract():
    """Verify WeatherIntelligenceAgent returns standard AgentResult contract."""
    mock_weather = {
        "source": "Open-Meteo",
        "timestamp": "2026-09-10T12:00:00Z",
        "coordinates": {"lat": 12.87, "lon": 74.84},
        "current": {
            "wind_speed_kmh": 22.0,
            "wave_height_m": 1.4,
            "wind_gust_kmh": 28.0,
            "has_storm_alert": False
        },
        "forecast_24h": {
            "wind_speed_kmh": [22.0, 24.0, 20.0],
            "wave_height_m": [1.4, 1.5, 1.3]
        }
    }

    result = await weather_intelligence_agent.execute(mock_weather)
    assert isinstance(result, AgentResult)
    assert result.agent == "WeatherIntelligenceAgent"
    assert result.status == "success"
    assert result.result["verdict"] == "SAFE"
    assert "metrics" in result.result
    assert 0.0 <= result.confidence <= 1.0


@pytest.mark.asyncio
async def test_ocean_analytics_ranking():
    """Verify OceanAnalyticsAgent correctly filters and ranks PFZ candidates."""
    mock_bulletins = [
        {
            "id": "PFZ-TEST-01",
            "lat": 12.85,
            "lon": 74.55,
            "bearing_deg": 260,
            "distance_km": 30.0,
            "depth_m": 45,
            "sst_c": 28.2,
            "chlorophyll_mg_m3": 1.5,
            "suitability_score": 0.85,
            "target_species": ["Mackerel", "Sardine"]
        },
        {
            "id": "PFZ-TEST-02",
            "lat": 12.95,
            "lon": 74.60,
            "bearing_deg": 300,
            "distance_km": 25.0,
            "depth_m": 40,
            "sst_c": 32.5,  # Unfavorable high SST
            "chlorophyll_mg_m3": 0.05,  # Unfavorable low chl
            "suitability_score": 0.50,
            "target_species": ["Squid"]
        }
    ]

    result = await ocean_analytics_agent.execute(mock_bulletins, location={"lat": 12.87, "lon": 74.84})
    assert isinstance(result, AgentResult)
    assert result.status == "success"
    assert result.result["recommended_pfz"]["id"] == "PFZ-TEST-01"
    assert result.result["recommended_pfz"]["evaluated_suitability"] > 0.8


@pytest.mark.asyncio
async def test_geospatial_reasoning_geofencing():
    """Verify GeospatialReasoningAgent detects prohibited zones and computes haversine distances."""
    # Location inside Karwar Naval Exclusion perimeter [74.12, 14.82]
    inside_coords = {"lat": 14.82, "lon": 74.12}
    result_inside = await geospatial_reasoning_agent.execute(inside_coords, pfz_candidates=[])
    assert result_inside.result["verdict"] == "UNSAFE"
    assert result_inside.result["is_inside_restricted"] is True
    assert "Karwar Naval" in result_inside.result["restricted_zone_breached"]

    # Open sea location off Mangalore [74.84, 12.87]
    clear_coords = {"lat": 12.87, "lon": 74.84}
    result_clear = await geospatial_reasoning_agent.execute(clear_coords, pfz_candidates=[])
    assert result_clear.result["verdict"] == "SAFE"
    assert result_clear.result["is_inside_restricted"] is False


@pytest.mark.asyncio
async def test_deterministic_safety_hierarchy():
    """Verify safety hierarchy precedence: Hard constraints always override favorable analytics."""
    # Case: Ocean is favorable, but Weather is UNSAFE (Gale force wind)
    verdict, reasons, score = arbitrate_safety_hierarchy(
        weather_verdict=SafetyVerdict.UNSAFE,
        weather_reasons=["HARD CONSTRAINT: Wind 60km/h"],
        geospatial_verdict=SafetyVerdict.SAFE,
        geospatial_reasons=["Clear of restricted zones"],
        ocean_verdict="FAVORABLE",
        ocean_reasons=["Rich PFZ thermal front"]
    )
    assert verdict == SafetyVerdict.UNSAFE
    assert score >= 0.8
    assert any("HARD CONSTRAINT" in r for r in reasons)

    # Case: Weather is SAFE, but Geospatial is UNSAFE (inside marine national park)
    verdict, reasons, score = arbitrate_safety_hierarchy(
        weather_verdict=SafetyVerdict.SAFE,
        weather_reasons=["Calm seas"],
        geospatial_verdict=SafetyVerdict.UNSAFE,
        geospatial_reasons=["HARD CONSTRAINT: Inside Marine Sanctuary"],
        ocean_verdict="FAVORABLE"
    )
    assert verdict == SafetyVerdict.UNSAFE

    # Case: Caution condition
    verdict, reasons, score = arbitrate_safety_hierarchy(
        weather_verdict=SafetyVerdict.CAUTION,
        weather_reasons=["Rough wave 2.8m"],
        geospatial_verdict=SafetyVerdict.SAFE,
        geospatial_reasons=["Clear"]
    )
    assert verdict == SafetyVerdict.CAUTION
