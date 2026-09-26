import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient
from app.main import app
from app.core.temporal import IST
from datetime import datetime, timezone, timedelta

client = TestClient(app)


def test_scenario_1_clear_day_open_waters_favorable_pfz():
    """Scenario 1: Clear day, open waters, favorable PFZ -> Verdict: SAFE."""
    safe_atm = {
        "current": {"wind_speed_10m": 18.0, "wind_gusts_10m": 22.0, "temperature_2m": 28.0, "weather_code": 1},
        "hourly": {
            "time": ["2026-09-11T06:00:00Z", "2026-09-11T07:00:00Z"],
            "wind_speed_10m": [18.0, 19.0],
            "wind_gusts_10m": [22.0, 23.0],
            "weather_code": [1, 1],
            "temperature_2m": [28.0, 28.5],
            "precipitation": [0.0, 0.0]
        }
    }
    safe_marine = {
        "current": {"wave_height": 1.1, "wave_period": 6.0},
        "hourly": {
            "time": ["2026-09-11T06:00:00Z", "2026-09-11T07:00:00Z"],
            "wave_height": [1.1, 1.2]
        }
    }

    with patch("app.integrations.weather_client.weather_client._fetch_atmospheric_forecast", return_value=safe_atm), \
         patch("app.integrations.weather_client.weather_client._fetch_marine_waves", return_value=safe_marine):

        resp = client.post("/query", json={
            "text": "Is it safe to fish from Mangalore right now?",
            "user_type": "app"
        })

        assert resp.status_code == 200
        data = resp.json()
        assert data["verdict"] == "SAFE"
        assert "SAFE" in data["report"]
        assert data["dissemination_channel"] == "app"
        assert data["visualization"]["geojson"] is not None


def test_scenario_2_high_wind_gale_forecast():
    """Scenario 2: High wind (> 50 km/h) gale forecast -> Verdict: UNSAFE even with favorable PFZ."""
    gale_atm = {
        "current": {"wind_speed_10m": 58.0, "wind_gusts_10m": 72.0, "temperature_2m": 27.0, "weather_code": 2},
        "hourly": {
            "time": ["2026-09-11T06:00:00Z"],
            "wind_speed_10m": [58.0],
            "wind_gusts_10m": [72.0],
            "weather_code": [2],
            "temperature_2m": [27.0],
            "precipitation": [5.0]
        }
    }
    calm_marine = {
        "current": {"wave_height": 1.5, "wave_period": 6.0},
        "hourly": {"time": ["2026-09-11T06:00:00Z"], "wave_height": [1.5]}
    }

    with patch("app.integrations.weather_client.weather_client._fetch_atmospheric_forecast", return_value=gale_atm), \
         patch("app.integrations.weather_client.weather_client._fetch_marine_waves", return_value=calm_marine):

        resp = client.post("/query", json={
            "text": "Can I sail from Mangalore now?",
            "user_type": "app"
        })

        assert resp.status_code == 200
        data = resp.json()
        assert data["verdict"] == "UNSAFE"
        assert "UNSAFE" in data["report"]
        assert "58" in data["report"]


def make_hourly_forecast(base_wind=18.0, base_wave=1.2, spike_hours=None, spike_wind=55.0, spike_wave=3.8):
    now_ist = datetime.now(IST).replace(minute=0, second=0, microsecond=0)
    times = []
    winds = []
    waves = []
    gusts = []
    codes = []
    temps = []
    precips = []
    for h in range(72):
        t = now_ist + timedelta(hours=h)
        times.append(t.isoformat())
        if spike_hours and h in spike_hours:
            winds.append(spike_wind)
            waves.append(spike_wave)
            gusts.append(spike_wind * 1.3)
            codes.append(95)
            temps.append(26.0)
            precips.append(10.0)
        else:
            winds.append(base_wind)
            waves.append(base_wave)
            gusts.append(base_wind * 1.2)
            codes.append(1)
            temps.append(28.0)
            precips.append(0.0)

    atm = {
        "current": {
            "wind_speed_10m": winds[0],
            "wind_gusts_10m": gusts[0],
            "temperature_2m": temps[0],
            "weather_code": codes[0]
        },
        "hourly": {
            "time": times,
            "wind_speed_10m": winds,
            "wind_gusts_10m": gusts,
            "weather_code": codes,
            "temperature_2m": temps,
            "precipitation": precips
        }
    }
    marine = {
        "current": {
            "wave_height": waves[0],
            "wave_period": 7.0
        },
        "hourly": {
            "time": times,
            "wave_height": waves
        }
    }
    return atm, marine


def test_scenario_3_high_wave_swell():
    """Scenario 3: High wave (> 3.5 m) swell -> Verdict: UNSAFE, cites wave height."""
    huge_atm, huge_marine = make_hourly_forecast(base_wind=15.0, base_wave=4.2)

    with patch("app.integrations.weather_client.weather_client._fetch_atmospheric_forecast", return_value=huge_atm), \
         patch("app.integrations.weather_client.weather_client._fetch_marine_waves", return_value=huge_marine):

        resp = client.post("/query", json={
            "text": "Can I sail from Kochi today?",
            "user_type": "app"
        })

        assert resp.status_code == 200
        data = resp.json()
        assert data["verdict"] == "UNSAFE"
        assert "4.2" in data["report"]
        assert "UNSAFE" in data["report"]


def test_scenario_4_vessel_inside_gahirmatha_marine_sanctuary():
    """Scenario 4: Vessel inside Gahirmatha Marine Sanctuary -> Verdict: UNSAFE, distance 0.0 km."""
    # Point inside Gahirmatha: lat 20.75, lon 87.00
    safe_atm = {
        "current": {"wind_speed_10m": 12.0, "wind_gusts_10m": 15.0, "temperature_2m": 28.0, "weather_code": 1},
        "hourly": {}
    }
    safe_marine = {
        "current": {"wave_height": 0.8},
        "hourly": {}
    }

    with patch("app.integrations.weather_client.weather_client._fetch_atmospheric_forecast", return_value=safe_atm), \
         patch("app.integrations.weather_client.weather_client._fetch_marine_waves", return_value=safe_marine):

        resp = client.post("/query", json={
            "text": "Fishing check at current coordinates",
            "location": {"lat": 20.75, "lon": 87.00}
        })

        assert resp.status_code == 200
        data = resp.json()
        assert data["verdict"] == "UNSAFE"
        # Find geospatial trace
        geo_trace = next(t for t in data["agent_traces"] if t["agent"] == "GeospatialReasoningAgent")
        assert geo_trace["result"]["is_inside_restricted"] is True
        assert geo_trace["result"]["distance_to_boundary_km"] == 0.0


def test_scenario_5_vessel_1km_from_karwar_naval_perimeter():
    """Scenario 5: Vessel 1.0 km from Karwar Naval Perimeter -> Verdict: CAUTION."""
    # 74.08, 14.86 is the boundary; 74.07, 14.82 is ~1.08 km west
    safe_atm = {
        "current": {"wind_speed_10m": 14.0, "wind_gusts_10m": 18.0, "temperature_2m": 28.0, "weather_code": 1},
        "hourly": {}
    }
    safe_marine = {
        "current": {"wave_height": 0.9},
        "hourly": {}
    }

    with patch("app.integrations.weather_client.weather_client._fetch_atmospheric_forecast", return_value=safe_atm), \
         patch("app.integrations.weather_client.weather_client._fetch_marine_waves", return_value=safe_marine):

        resp = client.post("/query", json={
            "text": "Navigating near Karwar offshore",
            "location": {"lat": 14.82, "lon": 74.07}
        })

        assert resp.status_code == 200
        data = resp.json()
        assert data["verdict"] == "CAUTION"
        geo_trace = next(t for t in data["agent_traces"] if t["agent"] == "GeospatialReasoningAgent")
        assert geo_trace["result"]["within_caution_perimeter"] is True
        assert geo_trace["result"]["distance_to_boundary_km"] <= 2.0


def test_scenario_6_temporal_query_tomorrow_morning_gale():
    """Scenario 6: Tomorrow morning has gale -> Verdict: UNSAFE (even if current conditions are SAFE)."""
    now_ist = datetime.now(IST).replace(minute=0, second=0, microsecond=0)
    tmrw_morning_dt = (now_ist + timedelta(days=1)).replace(hour=8, minute=0, second=0, microsecond=0)
    spike_hour = int((tmrw_morning_dt - now_ist).total_seconds() // 3600)

    atm, marine = make_hourly_forecast(
        base_wind=12.0,
        base_wave=1.0,
        spike_hours=[spike_hour],
        spike_wind=56.0,
        spike_wave=2.2
    )

    with patch("app.integrations.weather_client.weather_client._fetch_atmospheric_forecast", return_value=atm), \
         patch("app.integrations.weather_client.weather_client._fetch_marine_waves", return_value=marine):

        resp = client.post("/query", json={
            "text": "Is it safe to sail from Karwar tomorrow morning?",
            "user_type": "app"
        })

        assert resp.status_code == 200
        data = resp.json()
        assert data["verdict"] == "UNSAFE"
        assert "tomorrow morning" in data["time_range"]["label"].lower()
        weather_trace = next(t for t in data["agent_traces"] if t["agent"] == "WeatherIntelligenceAgent")
        assert weather_trace["result"]["metrics"]["wind_speed_kmh"] == 56.0


def test_scenario_7_multi_turn_session_location_inheritance():
    """Scenario 7: Turn 1 sets Karwar, Turn 2 asks 'What about tomorrow?' and inherits Karwar."""
    safe_atm = {
        "current": {"wind_speed_10m": 15.0, "wind_gusts_10m": 20.0, "temperature_2m": 28.0, "weather_code": 1},
        "hourly": {}
    }
    safe_marine = {"current": {"wave_height": 1.1}, "hourly": {}}

    with patch("app.integrations.weather_client.weather_client._fetch_atmospheric_forecast", return_value=safe_atm), \
         patch("app.integrations.weather_client.weather_client._fetch_marine_waves", return_value=safe_marine):

        # Turn 1: Explicit Karwar
        resp1 = client.post("/query", json={
            "text": "How is the weather in Karwar today?",
            "session_id": "sess_scenario_7"
        })
        assert resp1.status_code == 200
        data1 = resp1.json()
        assert data1["session_id"] == "sess_scenario_7"

        # Turn 2: Follow-up asking about tomorrow without stating Karwar
        resp2 = client.post("/query", json={
            "text": "What about tomorrow?",
            "session_id": "sess_scenario_7"
        })
        assert resp2.status_code == 200
        data2 = resp2.json()
        assert data2["session_id"] == "sess_scenario_7"
        # Must inherit Karwar coordinates
        plan_trace = next(t for t in data2["agent_traces"] if t["agent"] == "PlanningAgent")
        assert plan_trace["result"]["location_name"] == "Karwar"
        assert round(plan_trace["result"]["coordinates"]["lat"], 1) == 14.8


def test_scenario_8_boat_near_shore_sms_channel():
    """Scenario 8: Boat near shore SMS channel produces payload <= 160 characters."""
    safe_atm = {
        "current": {"wind_speed_10m": 18.0, "wind_gusts_10m": 22.0, "temperature_2m": 28.0, "weather_code": 1},
        "hourly": {}
    }
    safe_marine = {"current": {"wave_height": 1.2}, "hourly": {}}

    with patch("app.integrations.weather_client.weather_client._fetch_atmospheric_forecast", return_value=safe_atm), \
         patch("app.integrations.weather_client.weather_client._fetch_marine_waves", return_value=safe_marine):

        resp = client.post("/query", json={
            "text": "Weather report for Mangalore harbor",
            "user_type": "boat_near_shore"
        })

        assert resp.status_code == 200
        data = resp.json()
        assert data["dissemination_channel"] == "boat_near_shore"
        dispatched = data["dispatched_payload"]
        assert dispatched["status"] == "DISPATCHED_SMS"
        sms_text = dispatched["content"]["text"]
        assert len(sms_text) <= 160
        assert len(sms_text) > 0


def test_scenario_9_deep_sea_satellite_channel():
    """Scenario 9: Deep sea satellite channel produces valid simulated NAVIC NMEA telegram with checksum."""
    safe_atm = {
        "current": {"wind_speed_10m": 24.0, "wind_gusts_10m": 30.0, "temperature_2m": 28.5, "weather_code": 1},
        "hourly": {}
    }
    safe_marine = {"current": {"wave_height": 1.6}, "hourly": {}}

    with patch("app.integrations.weather_client.weather_client._fetch_atmospheric_forecast", return_value=safe_atm), \
         patch("app.integrations.weather_client.weather_client._fetch_marine_waves", return_value=safe_marine):

        resp = client.post("/query", json={
            "text": "Deep sea advisory 50 nautical miles offshore",
            "user_type": "boat_open_sea",
            "location": {"lat": 12.50, "lon": 74.20}
        })

        assert resp.status_code == 200
        data = resp.json()
        assert data["dissemination_channel"] == "boat_open_sea"
        dispatched = data["dispatched_payload"]
        assert dispatched["status"] == "DISPATCHED_SATELLITE"
        telegram = dispatched["content"]["raw_telegram"]
        assert telegram.startswith("$ORCA,")
        assert "*" in telegram
        assert dispatched["metadata"]["is_simulated"] is True


def test_scenario_10_missing_location_demo_fallback_warning():
    """Scenario 10: Query with no location under DEMO_DEFAULT_LOCATION_ENABLED=True flags clear demo warning."""
    with patch("app.core.config.settings.DEMO_DEFAULT_LOCATION_ENABLED", True):
        resp = client.post("/query", json={
            "text": "How are the waves tomorrow morning?",
            "user_type": "app"
        })
        assert resp.status_code == 200
        data = resp.json()
        # Find planning agent trace
        plan_trace = next(t for t in data["agent_traces"] if t["agent"] == "PlanningAgent")
        assert any("DEMO FALLBACK" in w for w in plan_trace["warnings"])


def test_scenario_11_missing_location_conservative_caution_when_disabled():
    """Scenario 11: Query with no location under DEMO_DEFAULT_LOCATION_ENABLED=False returns CAUTION and partial status."""
    with patch("app.core.config.settings.DEMO_DEFAULT_LOCATION_ENABLED", False):
        resp = client.post("/query", json={
            "text": "What is the sea state right now?",
            "user_type": "app"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["verdict"] == "CAUTION"
        plan_trace = next(t for t in data["agent_traces"] if t["agent"] == "PlanningAgent")
        assert plan_trace["status"] == "partial"
        assert plan_trace["location"] is None
        assert any("ADVISORY: No coastal location" in w for w in plan_trace["warnings"])


def test_scenario_12_claude_hallucination_override_contradiction():
    """Scenario 12: If Claude attempts to output 'Safe' when weather is UNSAFE, report is strictly overridden."""
    from unittest.mock import AsyncMock
    gale_atm = {
        "current": {"wind_speed_10m": 55.0, "wind_gusts_10m": 72.0, "temperature_2m": 27.0, "weather_code": 2},
        "hourly": {}
    }
    calm_marine = {
        "current": {"wave_height": 1.5},
        "hourly": {}
    }

    with patch("app.integrations.weather_client.weather_client._fetch_atmospheric_forecast", return_value=gale_atm), \
         patch("app.integrations.weather_client.weather_client._fetch_marine_waves", return_value=calm_marine), \
         patch("app.integrations.claude_client.claude_client.client") as mock_client:

        # Claude mock returning a completely contradictory mild/safe message
        mock_client.messages.create = AsyncMock(return_value=type("Resp", (), {
            "content": [type("Text", (), {"text": "Pleasant weather today. Conditions are safe to sail."})()]
        })())

        resp = client.post("/query", json={
            "text": "Can I sail from Mangalore now?",
            "user_type": "app"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["verdict"] == "UNSAFE"
        # Contradictory text must NOT be in report!
        assert "Conditions are safe to sail" not in data["report"]
        assert "SAFETY ADVISORY: UNSAFE TO SAIL" in data["report"]
        assert "55" in data["report"]


def test_scenario_13_missing_hourly_forecast_charts_unavailable_zero_fabrication():
    """Scenario 13: When hourly forecast is unavailable from Open-Meteo, charts available is False and arrays are empty."""
    current_only_atm = {
        "current": {"wind_speed_10m": 22.0, "wind_gusts_10m": 28.0, "temperature_2m": 28.0, "weather_code": 1},
        "hourly": {}  # No hourly forecast
    }
    current_only_marine = {
        "current": {"wave_height": 1.4},
        "hourly": {}  # No hourly marine
    }

    with patch("app.integrations.weather_client.weather_client._fetch_atmospheric_forecast", return_value=current_only_atm), \
         patch("app.integrations.weather_client.weather_client._fetch_marine_waves", return_value=current_only_marine):

        resp = client.post("/query", json={
            "text": "Can I sail from Mangalore tomorrow morning?",
            "user_type": "app"
        })
        assert resp.status_code == 200
        data = resp.json()
        charts = data["visualization"]["charts"]
        assert charts["available"] is False
        assert charts["wave_series"]["data"] == []
        assert charts["wind_series"]["data"] == []
        assert "unavailable" in charts["warning"].lower()


def test_scenario_14_exact_threshold_boundary_wind_50_unsafe():
    """Scenario 14: Wind at exactly 50.0 km/h is deterministically UNSAFE."""
    atm = {
        "current": {"wind_speed_10m": 50.0, "wind_gusts_10m": 52.0, "temperature_2m": 28.0, "weather_code": 1},
        "hourly": {}
    }
    marine = {"current": {"wave_height": 1.0}, "hourly": {}}

    with patch("app.integrations.weather_client.weather_client._fetch_atmospheric_forecast", return_value=atm), \
         patch("app.integrations.weather_client.weather_client._fetch_marine_waves", return_value=marine):

        resp = client.post("/query", json={"text": "Mangalore status now"})
        assert resp.status_code == 200
        assert resp.json()["verdict"] == "UNSAFE"


def test_scenario_15_exact_threshold_boundary_wind_35_caution():
    """Scenario 15: Wind at exactly 35.0 km/h is deterministically CAUTION."""
    atm = {
        "current": {"wind_speed_10m": 35.0, "wind_gusts_10m": 40.0, "temperature_2m": 28.0, "weather_code": 1},
        "hourly": {}
    }
    marine = {"current": {"wave_height": 1.0}, "hourly": {}}

    with patch("app.integrations.weather_client.weather_client._fetch_atmospheric_forecast", return_value=atm), \
         patch("app.integrations.weather_client.weather_client._fetch_marine_waves", return_value=marine):

        resp = client.post("/query", json={"text": "Mangalore status now"})
        assert resp.status_code == 200
        assert resp.json()["verdict"] == "CAUTION"

