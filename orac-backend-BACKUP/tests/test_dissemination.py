"""Tests for multi-channel dissemination routing."""
import pytest
from app.dissemination.sms_client import format_near_shore_sms, sms_gateway
from app.dissemination.satellite_client import satellite_client
from app.dissemination.router import dissemination_router
from app.models.schemas import AgentResult


def test_sms_length_constraint():
    """Verify that SMS for near-shore fishermen strictly complies with <= 160 characters."""
    # Test safe SMS
    sms_safe = format_near_shore_sms(
        verdict="SAFE",
        location_name="Mangalore",
        wind_kmh=18.5,
        wave_m=1.2,
        pfz_distance_km=31.5,
        pfz_bearing_deg=265
    )
    assert len(sms_safe) <= 160
    assert "SAFE" in sms_safe
    assert "18km/h" in sms_safe

    # Test unsafe SMS
    sms_unsafe = format_near_shore_sms(
        verdict="UNSAFE",
        location_name="Visakhapatnam",
        wind_kmh=62.0,
        wave_m=4.2
    )
    assert len(sms_unsafe) <= 160
    assert "DANGER" in sms_unsafe or "UNSAFE" in sms_unsafe
    assert "DO NOT" in sms_unsafe

    # Test gateway dispatch validation
    dispatch_res = sms_gateway.send_sms(recipient="+919876543210", text=sms_safe)
    assert dispatch_res["within_160_limit"] is True
    assert dispatch_res["status"] == "DELIVERED_SIMULATED"


def test_satellite_navic_dispatch():
    """Verify simulated ISRO NAVIC / MSS satellite NMEA telegram generation."""
    sat_res = satellite_client.dispatch_navic_alert(
        lat=12.87,
        lon=74.84,
        verdict="SAFE",
        wind_kmh=18.0,
        wave_m=1.2,
        pfz_bearing=265,
        pfz_dist_km=31.5
    )
    assert sat_res["protocol"] == "ISRO_NAVIC_MSS_SATELLITE_SIMULATED"
    assert "raw_telegram" in sat_res
    raw = sat_res["raw_telegram"]
    assert raw.startswith("$ORCA,")
    assert "*" in raw  # Checksum delimiter present
    assert sat_res["decoded_telemetry"]["verdict_label"] == "SAFE"


@pytest.mark.asyncio
async def test_dissemination_router_channels():
    """Verify router dispatches appropriate payload for each channel."""
    weather_dummy = AgentResult(
        agent="WeatherIntelligenceAgent",
        status="success",
        result={"metrics": {"wind_speed_kmh": 20.0, "wave_height_m": 1.3}}
    )
    ocean_dummy = AgentResult(
        agent="OceanAnalyticsAgent",
        status="success",
        result={"candidates": [{"distance_km": 25.0, "bearing_deg": 270}]}
    )

    # 1. App channel
    res_app = await dissemination_router.route(
        user_type="app",
        verdict="SAFE",
        location_name="Mangalore",
        location_coords={"lat": 12.87, "lon": 74.84},
        report_text="Advisory report",
        weather_result=weather_dummy,
        ocean_result=ocean_dummy
    )
    assert res_app.channel == "app"
    assert res_app.status == "DELIVERED_IN_RESPONSE"

    # 2. Near shore SMS channel
    res_sms = await dissemination_router.route(
        user_type="boat_near_shore",
        verdict="SAFE",
        location_name="Mangalore",
        location_coords={"lat": 12.87, "lon": 74.84},
        report_text="Advisory report",
        weather_result=weather_dummy,
        ocean_result=ocean_dummy
    )
    assert res_sms.channel == "boat_near_shore"
    assert res_sms.metadata["char_count"] <= 160

    # 3. Open sea satellite channel
    res_sat = await dissemination_router.route(
        user_type="boat_open_sea",
        verdict="SAFE",
        location_name="Deep Sea",
        location_coords={"lat": 10.50, "lon": 72.00},
        report_text="Advisory report",
        weather_result=weather_dummy,
        ocean_result=ocean_dummy
    )
    assert res_sat.channel == "boat_open_sea"
    assert "ISRO NAVIC" in res_sat.metadata["protocol"]
