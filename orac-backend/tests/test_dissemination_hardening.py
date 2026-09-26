import pytest
from app.dissemination.router import DisseminationRouter
from app.dissemination.sms_client import format_near_shore_sms
from app.dissemination.satellite_client import satellite_client
from app.models.schemas import AgentResult


@pytest.fixture
def mock_domain_results():
    weather_res = AgentResult(
        agent="WeatherIntelligenceAgent",
        status="success",
        result={
            "metrics": {
                "wind_speed_kmh": 42.5,
                "wave_height_m": 2.8
            }
        }
    )
    ocean_res = AgentResult(
        agent="OceanAnalyticsAgent",
        status="success",
        result={
            "candidates": [{
                "id": "PFZ-MNG-01",
                "distance_km": 28.5,
                "bearing_deg": 260
            }]
        }
    )
    return weather_res, ocean_res


def test_sms_length_strictly_under_160_chars():
    """Test that format_near_shore_sms is strictly <= 160 chars under extreme cases."""
    test_cases = [
        ("UNSAFE", "Visakhapatnam Harbor Coastal Sector", 85.5, 4.8, 55.2, 180),
        ("CAUTION", "Thiruvananthapuram Vizhinjam Port", 48.0, 3.2, 35.0, 245),
        ("SAFE", "Port Blair South Andaman Marine Sector", 12.0, 0.8, 18.0, 90),
        ("UNSAFE", "", 99.0, 6.0, 0, 0),
        ("CAUTION", "VeryLongLocationNameExceedingNormalLimits1234567890", 45.0, 2.5, 10.0, 315)
    ]

    for verdict, loc, wind, wave, dist, bear in test_cases:
        sms = format_near_shore_sms(verdict, loc, wind, wave, dist, bear)
        assert len(sms) <= 160, f"SMS length {len(sms)} exceeded 160 chars: {sms}"
        assert len(sms) > 0


def test_satellite_nmea_sentence_structure_and_checksum():
    """Test that simulated NAVIC S-Band telegram produces valid NMEA syntax and checksum."""
    lat, lon = 12.8712, 74.8423
    record = satellite_client.dispatch_navic_alert(
        lat=lat,
        lon=lon,
        verdict="CAUTION",
        wind_kmh=42.0,
        wave_m=2.5,
        pfz_bearing=250,
        pfz_dist_km=30.0
    )

    raw = record["raw_telegram"]
    assert raw.startswith("$ORCA,")
    assert "*" in raw
    body, csum = raw[1:].split("*")
    assert len(csum) == 2

    # Verify checksum algorithm
    expected_csum = 0
    for ch in body:
        expected_csum ^= ord(ch)
    assert f"{expected_csum:02X}" == csum
    assert record["decoded_telemetry"]["verdict_code"] == 1


@pytest.mark.asyncio
async def test_dissemination_router_app_channel(mock_domain_results):
    """Test app channel returns rich dashboard payload."""
    w_res, o_res = mock_domain_results
    router = DisseminationRouter()

    payload = await router.route(
        user_type="app",
        verdict="CAUTION",
        location_name="Mangalore",
        location_coords={"lat": 12.87, "lon": 74.84},
        report_text="Advisory report text",
        weather_result=w_res,
        ocean_result=o_res
    )

    assert payload.channel == "app"
    assert payload.status == "DELIVERED_IN_RESPONSE"
    assert payload.content["format"] == "rich_dashboard"
    assert payload.metadata["includes_interactive_geojson"] is True


@pytest.mark.asyncio
async def test_dissemination_router_unexpected_user_type(mock_domain_results):
    """Test router handles unexpected user_type safely with default fallback."""
    w_res, o_res = mock_domain_results
    router = DisseminationRouter()

    payload = await router.route(
        user_type="custom_unknown_channel",
        verdict="SAFE",
        location_name="Goa",
        location_coords={"lat": 15.4, "lon": 73.8},
        report_text="Report text",
        weather_result=w_res,
        ocean_result=o_res
    )

    assert payload.status == "DELIVERED_IN_RESPONSE"
    assert "message" in payload.content


@pytest.mark.asyncio
async def test_mock_simulation_labeling_across_components(mock_domain_results):
    """Test that simulated components are clearly labeled with is_simulated: True."""
    w_res, o_res = mock_domain_results
    router = DisseminationRouter()

    # 1. Satellite channel metadata
    sat_payload = await router.route(
        user_type="boat_open_sea",
        verdict="UNSAFE",
        location_name="Karwar",
        location_coords={"lat": 14.8, "lon": 74.1},
        report_text="Report",
        weather_result=w_res,
        ocean_result=o_res
    )
    assert sat_payload.metadata.get("is_simulated") is True

    # 2. INCOIS Provider bulletins
    from app.integrations.incois_mock import incois_provider
    bulletins = incois_provider.get_pfz_advisories(12.87, 74.84)
    assert len(bulletins) > 0
    for b in bulletins:
        assert b.get("is_simulated") is True
