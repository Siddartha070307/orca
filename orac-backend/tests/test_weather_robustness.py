import pytest
from unittest.mock import patch, AsyncMock
import httpx
from app.integrations.weather_client import WeatherClient


@pytest.mark.asyncio
async def test_weather_client_http_500_fallback():
    """Test A: Weather client handles HTTP 500 error gracefully and returns conservative fallback."""
    client = WeatherClient()
    mock_resp = AsyncMock(status_code=500, text="Internal Server Error")

    with patch("httpx.AsyncClient.get", return_value=mock_resp):
        res = await client.get_marine_weather(12.87, 74.84)
        assert res is not None
        assert res["is_fallback"] is True
        assert res["source"] == "Open-Meteo (Fallback Cache)"
        # Conservative values: wind >= 20, wave >= 2.0
        assert res["current"]["wind_speed_kmh"] >= 20.0
        assert res["current"]["wave_height_m"] >= 2.0
        assert "warning" in res


@pytest.mark.asyncio
async def test_weather_client_timeout_fallback():
    """Test B: Weather client handles connection timeout gracefully."""
    client = WeatherClient()

    with patch("httpx.AsyncClient.get", side_effect=httpx.TimeoutException("Read timeout")):
        res = await client.get_marine_weather(12.87, 74.84)
        assert res is not None
        assert res["is_fallback"] is True
        assert res["current"]["wind_speed_kmh"] == 25.0
        assert res["current"]["wave_height_m"] == 2.2


@pytest.mark.asyncio
async def test_weather_client_malformed_json_fallback():
    """Test C: Weather client handles malformed JSON response gracefully."""
    client = WeatherClient()
    from unittest.mock import MagicMock
    mock_resp = MagicMock(status_code=200, text="NOT JSON at all {")
    mock_resp.json.side_effect = ValueError("Invalid JSON")

    with patch("httpx.AsyncClient.get", return_value=mock_resp):
        res = await client.get_marine_weather(12.87, 74.84)
        assert res is not None
        assert res["is_fallback"] is True


@pytest.mark.asyncio
async def test_weather_client_missing_forecast_arrays():
    """Test D: Weather client handles missing forecast arrays safely without fabricating fake series."""
    client = WeatherClient()
    # Response with current but empty hourly
    atm_mock = {
        "current": {"wind_speed_10m": 15.0, "temperature_2m": 27.0, "weather_code": 1},
        "hourly": {}
    }
    marine_mock = {
        "current": {"wave_height": 1.1},
        "hourly": {}
    }

    with patch.object(client, "_fetch_atmospheric_forecast", return_value=atm_mock), \
         patch.object(client, "_fetch_marine_waves", return_value=marine_mock):
        res = await client.get_marine_weather(12.87, 74.84)
        assert res is not None
        assert res["forecast_available"] is False
        assert res["forecast_hourly"]["times"] == []
        assert res["forecast_hourly"]["wind_speed_kmh"] == []
        assert res["forecast_hourly"]["wave_height_m"] == []


@pytest.mark.asyncio
async def test_weather_client_fallback_values_and_flags():
    """Test E: Fallback response has is_fallback: True and conservative caution values."""
    client = WeatherClient()
    with patch.object(client, "_fetch_atmospheric_forecast", return_value=None), \
         patch.object(client, "_fetch_marine_waves", return_value=None):
        res = await client.get_marine_weather(14.8, 74.1)
        assert res["is_fallback"] is True
        assert res["status"] == "partial"
        assert res["current"]["wind_speed_kmh"] == 25.0
        assert res["current"]["wave_height_m"] == 2.2
        assert res["current"]["wind_gust_kmh"] == 35.0
        assert "conservative estimates applied" in res["warning"]


@pytest.mark.asyncio
async def test_weather_client_normal_response_parsing():
    """Test F: Normal response parses hourly series correctly including temperature and precipitation."""
    client = WeatherClient()
    atm_mock = {
        "current": {
            "wind_speed_10m": 19.5,
            "wind_gusts_10m": 25.0,
            "wind_direction_10m": 220,
            "temperature_2m": 29.0,
            "weather_code": 2
        },
        "hourly": {
            "time": ["2026-09-11T00:00:00Z", "2026-09-11T01:00:00Z"],
            "wind_speed_10m": [19.5, 20.1],
            "wind_gusts_10m": [25.0, 26.2],
            "weather_code": [2, 2],
            "temperature_2m": [29.0, 28.5],
            "precipitation": [0.0, 0.5]
        }
    }
    marine_mock = {
        "current": {
            "wave_height": 1.4,
            "wave_period": 7.0,
            "wave_direction": 215
        },
        "hourly": {
            "time": ["2026-09-11T00:00:00Z", "2026-09-11T01:00:00Z"],
            "wave_height": [1.4, 1.5]
        }
    }

    with patch.object(client, "_fetch_atmospheric_forecast", return_value=atm_mock), \
         patch.object(client, "_fetch_marine_waves", return_value=marine_mock):
        res = await client.get_marine_weather(14.8, 74.1)
        assert res["is_fallback"] is False
        assert res["status"] == "success"
        assert res["current"]["wind_speed_kmh"] == 19.5
        assert res["current"]["wave_height_m"] == 1.4
        hourly = res["forecast_hourly"]
        assert hourly["temperature_c"] == [29.0, 28.5]
        assert hourly["precipitation_mm"] == [0.0, 0.5]
        assert hourly["wind_speed_kmh"] == [19.5, 20.1]
        assert hourly["wave_height_m"] == [1.4, 1.5]


# ==============================================================================
# FINAL HARDENING REGRESSION TESTS: ZERO HOURLY FORECAST FABRICATION
# ==============================================================================

@pytest.mark.asyncio
async def test_regression_a_short_wave_array_no_padding():
    """Test A: 24 timestamps + 24 wind + 12 wave -> forecast_available == False, no padding, arrays empty."""
    client = WeatherClient()
    times = [f"2026-09-11T{h:02d}:00:00Z" for h in range(24)]
    atm_mock = {
        "current": {"wind_speed_10m": 15.0, "wind_gusts_10m": 20.0, "temperature_2m": 28.0, "weather_code": 1},
        "hourly": {
            "time": times,
            "wind_speed_10m": [15.0] * 24,
            "wind_gusts_10m": [20.0] * 24,
            "temperature_2m": [28.0] * 24,
            "precipitation": [0.0] * 24,
            "weather_code": [1] * 24
        }
    }
    marine_mock = {
        "current": {"wave_height": 1.2},
        "hourly": {
            "time": times[:12],
            "wave_height": [1.2] * 12  # Short array (12 instead of 24)
        }
    }

    with patch.object(client, "_fetch_atmospheric_forecast", return_value=atm_mock), \
         patch.object(client, "_fetch_marine_waves", return_value=marine_mock):
        res = await client.get_marine_weather(12.87, 74.84)
        assert res["forecast_available"] is False
        hourly = res["forecast_hourly"]
        assert hourly["times"] == []
        assert hourly["wind_speed_kmh"] == []
        assert hourly["wind_gust_kmh"] == []
        assert hourly["wave_height_m"] == []
        assert hourly["temperature_c"] == []
        assert hourly["precipitation_mm"] == []
        assert hourly["weather_code"] == []
        assert "incomplete or misaligned" in res.get("warning", "")


@pytest.mark.asyncio
async def test_regression_b_short_gust_array_no_wind_125_fabrication():
    """Test B: 24 timestamps + 24 wind + 24 wave + 12 gust -> forecast_available == False, no wind * 1.25 fabrication, arrays empty."""
    client = WeatherClient()
    times = [f"2026-09-11T{h:02d}:00:00Z" for h in range(24)]
    atm_mock = {
        "current": {"wind_speed_10m": 20.0, "wind_gusts_10m": 25.0, "temperature_2m": 28.0, "weather_code": 1},
        "hourly": {
            "time": times,
            "wind_speed_10m": [20.0] * 24,
            "wind_gusts_10m": [25.0] * 12,  # Short gust array (12 instead of 24)
            "temperature_2m": [28.0] * 24,
            "precipitation": [0.0] * 24,
            "weather_code": [1] * 24
        }
    }
    marine_mock = {
        "current": {"wave_height": 1.5},
        "hourly": {
            "time": times,
            "wave_height": [1.5] * 24
        }
    }

    with patch.object(client, "_fetch_atmospheric_forecast", return_value=atm_mock), \
         patch.object(client, "_fetch_marine_waves", return_value=marine_mock):
        res = await client.get_marine_weather(12.87, 74.84)
        assert res["forecast_available"] is False
        hourly = res["forecast_hourly"]
        assert hourly["times"] == []
        assert hourly["wind_speed_kmh"] == []
        assert hourly["wind_gust_kmh"] == []
        assert hourly["wave_height_m"] == []
        assert hourly["temperature_c"] == []
        assert hourly["precipitation_mm"] == []
        assert hourly["weather_code"] == []


@pytest.mark.asyncio
async def test_regression_c_short_temperature_array_empty():
    """Test C: 24 timestamps + 24 wind + 24 wave + 24 gust + 12 temperature -> forecast_available == False, arrays empty."""
    client = WeatherClient()
    times = [f"2026-09-11T{h:02d}:00:00Z" for h in range(24)]
    atm_mock = {
        "current": {"wind_speed_10m": 18.0, "wind_gusts_10m": 24.0, "temperature_2m": 28.0, "weather_code": 1},
        "hourly": {
            "time": times,
            "wind_speed_10m": [18.0] * 24,
            "wind_gusts_10m": [24.0] * 24,
            "temperature_2m": [28.0] * 12,  # Short temp array (12 instead of 24)
            "precipitation": [0.0] * 24,
            "weather_code": [1] * 24
        }
    }
    marine_mock = {
        "current": {"wave_height": 1.3},
        "hourly": {
            "time": times,
            "wave_height": [1.3] * 24
        }
    }

    with patch.object(client, "_fetch_atmospheric_forecast", return_value=atm_mock), \
         patch.object(client, "_fetch_marine_waves", return_value=marine_mock):
        res = await client.get_marine_weather(12.87, 74.84)
        assert res["forecast_available"] is False
        hourly = res["forecast_hourly"]
        assert hourly["times"] == []
        assert hourly["wind_speed_kmh"] == []
        assert hourly["wave_height_m"] == []
        assert hourly["temperature_c"] == []


@pytest.mark.asyncio
async def test_regression_d_complete_required_arrays_success():
    """Test D: 24 timestamps + 24 complete required arrays -> forecast_available == True, arrays len == 24."""
    client = WeatherClient()
    times = [f"2026-09-11T{h:02d}:00:00Z" for h in range(24)]
    atm_mock = {
        "current": {"wind_speed_10m": 18.0, "wind_gusts_10m": 24.0, "temperature_2m": 28.0, "weather_code": 1},
        "hourly": {
            "time": times,
            "wind_speed_10m": [18.5] * 24,
            "wind_gusts_10m": [24.0] * 24,
            "temperature_2m": [28.5] * 24,
            "precipitation": [0.2] * 24,
            "weather_code": [1] * 24
        }
    }
    marine_mock = {
        "current": {"wave_height": 1.3},
        "hourly": {
            "time": times,
            "wave_height": [1.35] * 24
        }
    }

    with patch.object(client, "_fetch_atmospheric_forecast", return_value=atm_mock), \
         patch.object(client, "_fetch_marine_waves", return_value=marine_mock):
        res = await client.get_marine_weather(12.87, 74.84)
        assert res["forecast_available"] is True
        hourly = res["forecast_hourly"]
        assert len(hourly["times"]) == 24
        assert len(hourly["wind_speed_kmh"]) == 24
        assert len(hourly["wind_gust_kmh"]) == 24
        assert len(hourly["wave_height_m"]) == 24
        assert len(hourly["temperature_c"]) == 24
        assert len(hourly["precipitation_mm"]) == 24
        assert len(hourly["weather_code"]) == 24
        assert hourly["wind_speed_kmh"][0] == 18.5
        assert hourly["wave_height_m"][0] == 1.35


@pytest.mark.asyncio
async def test_regression_e_forecast_hourly_arrays_exact_match_times_length():
    """Test E: Check that in all cases, every array in forecast_hourly has the exact same length as times."""
    client = WeatherClient()
    times = [f"2026-09-11T{h:02d}:00:00Z" for h in range(24)]

    # Sub-case 1: Valid 24-point dataset
    res_valid = client._consolidate_weather(
        lat=12.87,
        lon=74.84,
        forecast_data={
            "current": {"wind_speed_10m": 15.0},
            "hourly": {
                "time": times,
                "wind_speed_10m": [15.0] * 24,
                "wind_gusts_10m": [20.0] * 24,
                "temperature_2m": [28.0] * 24,
                "precipitation": [0.0] * 24,
                "weather_code": [1] * 24
            }
        },
        marine_data={
            "current": {"wave_height": 1.2},
            "hourly": {"wave_height": [1.2] * 24}
        }
    )
    assert res_valid["forecast_available"] is True
    t_len_valid = len(res_valid["forecast_hourly"]["times"])
    assert t_len_valid == 24
    for k, v in res_valid["forecast_hourly"].items():
        if isinstance(v, list):
            assert len(v) == t_len_valid, f"Array {k} length {len(v)} != {t_len_valid}"

    # Sub-case 2: Misaligned series (12 waves vs 24 times)
    res_misaligned = client._consolidate_weather(
        lat=12.87,
        lon=74.84,
        forecast_data={
            "current": {"wind_speed_10m": 15.0},
            "hourly": {
                "time": times,
                "wind_speed_10m": [15.0] * 24,
                "wind_gusts_10m": [20.0] * 24,
                "temperature_2m": [28.0] * 24,
                "precipitation": [0.0] * 24
            }
        },
        marine_data={
            "current": {"wave_height": 1.2},
            "hourly": {"wave_height": [1.2] * 12}
        }
    )
    assert res_misaligned["forecast_available"] is False
    t_len_mis = len(res_misaligned["forecast_hourly"]["times"])
    assert t_len_mis == 0
    for k, v in res_misaligned["forecast_hourly"].items():
        if isinstance(v, list):
            assert len(v) == t_len_mis, f"Array {k} length {len(v)} != {t_len_mis}"

    # Sub-case 3: Empty dataset
    res_empty = client._consolidate_weather(lat=12.87, lon=74.84, forecast_data=None, marine_data=None)
    assert res_empty["forecast_available"] is False
    t_len_emp = len(res_empty["forecast_hourly"]["times"])
    assert t_len_emp == 0
    for k, v in res_empty["forecast_hourly"].items():
        if isinstance(v, list):
            assert len(v) == t_len_emp, f"Array {k} length {len(v)} != {t_len_emp}"

    # Sub-case 4: Series containing NaN or malformed value
    res_nan = client._consolidate_weather(
        lat=12.87,
        lon=74.84,
        forecast_data={
            "current": {"wind_speed_10m": 15.0},
            "hourly": {
                "time": times,
                "wind_speed_10m": [15.0] * 23 + [float("nan")],
                "wind_gusts_10m": [20.0] * 24,
                "temperature_2m": [28.0] * 24,
                "precipitation": [0.0] * 24
            }
        },
        marine_data={
            "current": {"wave_height": 1.2},
            "hourly": {"wave_height": [1.2] * 24}
        }
    )
    assert res_nan["forecast_available"] is False
    t_len_nan = len(res_nan["forecast_hourly"]["times"])
    assert t_len_nan == 0
    for k, v in res_nan["forecast_hourly"].items():
        if isinstance(v, list):
            assert len(v) == t_len_nan, f"Array {k} length {len(v)} != {t_len_nan}"
