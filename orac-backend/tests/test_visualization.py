"""Tests for Improvement 1: Visualization Data Integrity."""
import pytest
from app.agents.visualization import visualization_agent
from app.agents.weather_intelligence import weather_intelligence_agent
from app.agents.risk_assessment import risk_assessment_agent
from app.core.temporal import resolve_time_range
from app.models.schemas import AgentResult


@pytest.mark.asyncio
async def test_a_actual_hourly_values_used():
    """Test A: Visualization Agent uses real hourly forecast values from Weather Intelligence."""
    # Mock weather payload with explicit non-synthetic series
    hourly_times = [f"2026-09-11T{h:02d}:00:00+05:30" for h in range(6, 12)]
    hourly_winds = [19.5, 21.0, 24.5, 26.0, 22.5, 20.0]
    hourly_waves = [1.25, 1.35, 1.45, 1.60, 1.50, 1.30]

    mock_weather_result = AgentResult(
        agent="WeatherIntelligenceAgent",
        status="success",
        time_range={"start": hourly_times[0], "end": hourly_times[-1], "label": "Tomorrow Morning"},
        result={
            "verdict": "SAFE",
            "hourly_series": {
                "times": hourly_times,
                "wind_speed_kmh": hourly_winds,
                "wave_height_m": hourly_waves
            }
        }
    )

    ocean_res = AgentResult(agent="OceanAnalyticsAgent", status="success", result={})
    risk_res = AgentResult(agent="RiskAssessmentAgent", status="success", result={"verdict": "SAFE"})

    viz_result = await visualization_agent.execute(
        user_coords={"lat": 12.87, "lon": 74.84},
        weather_result=mock_weather_result,
        ocean_result=ocean_res,
        risk_result=risk_res
    )

    charts = viz_result.result["charts"]
    assert charts["available"] is True
    assert charts["wave_series"]["data"] == hourly_waves
    assert charts["wind_series"]["data"] == hourly_winds
    assert charts["timestamps"] == hourly_times


@pytest.mark.asyncio
async def test_b_synthetic_values_not_generated():
    """Test B: When actual hourly series has specific values, no synthetic curves are injected."""
    custom_waves = [2.75, 2.80, 2.90]
    custom_winds = [41.2, 42.5, 43.1]
    times = ["2026-09-11T12:00:00+05:30", "2026-09-11T13:00:00+05:30", "2026-09-11T14:00:00+05:30"]

    w_res = AgentResult(
        agent="WeatherIntelligenceAgent",
        status="success",
        result={
            "verdict": "CAUTION",
            "hourly_series": {
                "times": times,
                "wind_speed_kmh": custom_winds,
                "wave_height_m": custom_waves
            }
        }
    )
    risk_res = AgentResult(agent="RiskAssessmentAgent", status="success", result={"verdict": "CAUTION"})

    viz_result = await visualization_agent.execute(
        user_coords={"lat": 14.82, "lon": 74.19},
        weather_result=w_res,
        ocean_result=AgentResult(agent="OceanAnalyticsAgent", status="success", result={}),
        risk_result=risk_res
    )

    charts = viz_result.result["charts"]
    assert len(charts["wave_series"]["data"]) == 3
    assert charts["wave_series"]["data"] == custom_waves
    assert charts["wind_series"]["data"] == custom_winds


@pytest.mark.asyncio
async def test_c_temporal_filtering_matching_window():
    """Test C: End-to-end WeatherIntelligence -> Visualization filters to requested window ('tomorrow morning')."""
    # 72-hour mock series covering today and tomorrow
    from datetime import datetime, timedelta
    from app.core.temporal import IST

    base_time = datetime.now(IST).replace(hour=0, minute=0, second=0, microsecond=0)
    all_times = [(base_time + timedelta(hours=i)).isoformat() for i in range(48)]
    all_winds = [10.0 + (i % 5) for i in range(48)]
    all_waves = [1.0 + (i % 3) * 0.2 for i in range(48)]

    raw_weather = {
        "source": "Open-Meteo",
        "timestamp": base_time.isoformat(),
        "coordinates": {"lat": 12.87, "lon": 74.84},
        "current": {"wind_speed_kmh": 15.0, "wave_height_m": 1.2},
        "forecast_hourly": {
            "times": all_times,
            "wind_speed_kmh": all_winds,
            "wave_height_m": all_waves
        }
    }

    tr_tomorrow_morning = resolve_time_range("tomorrow morning", reference_time=base_time)
    w_res = await weather_intelligence_agent.execute(
        weather_data=raw_weather,
        location={"lat": 12.87, "lon": 74.84},
        time_range=tr_tomorrow_morning
    )

    viz_result = await visualization_agent.execute(
        user_coords={"lat": 12.87, "lon": 74.84},
        weather_result=w_res,
        ocean_result=AgentResult(agent="OceanAnalyticsAgent", status="success", result={}),
        risk_result=AgentResult(agent="RiskAssessmentAgent", status="success", result={"verdict": "SAFE"})
    )

    charts = viz_result.result["charts"]
    assert charts["available"] is True
    # Window 06:00 to 12:00 -> 7 timestamps (06:00, 07:00, 08:00, 09:00, 10:00, 11:00, 12:00)
    assert len(charts["timestamps"]) == 7
    # Verify that all timestamps are on tomorrow
    tmrw_date_str = (base_time.date() + timedelta(days=1)).isoformat()
    assert all(t.startswith(tmrw_date_str) for t in charts["timestamps"])


@pytest.mark.asyncio
async def test_d_missing_data_handled_safely():
    """Test D: When forecast data is missing or empty, visualization returns unavailable without crashing."""
    w_empty = AgentResult(
        agent="WeatherIntelligenceAgent",
        status="partial",
        result={
            "verdict": "CAUTION",
            "hourly_series": {"times": [], "wind_speed_kmh": [], "wave_height_m": []}
        }
    )

    viz_result = await visualization_agent.execute(
        user_coords=None,  # Missing user coords too
        weather_result=w_empty,
        ocean_result=AgentResult(agent="OceanAnalyticsAgent", status="partial", result={}),
        risk_result=AgentResult(agent="RiskAssessmentAgent", status="success", result={"verdict": "CAUTION"})
    )

    assert viz_result.status == "partial"
    charts = viz_result.result["charts"]
    assert charts["available"] is False
    assert len(charts["wave_series"]["data"]) == 0
    assert len(charts["wind_series"]["data"]) == 0
    assert len(viz_result.warnings) > 0


@pytest.mark.asyncio
async def test_e_units_are_correct():
    """Test E: Wave height is marked 'm' and wind speed is marked 'km/h'."""
    times = ["2026-09-11T12:00:00+05:30"]
    w_res = AgentResult(
        agent="WeatherIntelligenceAgent",
        status="success",
        result={
            "verdict": "SAFE",
            "hourly_series": {
                "times": times,
                "wind_speed_kmh": [20.0],
                "wave_height_m": [1.5],
                "wind_gust_kmh": [25.0],
                "temperature_c": [29.0],
                "precipitation_mm": [0.0]
            }
        }
    )

    viz_result = await visualization_agent.execute(
        user_coords={"lat": 12.87, "lon": 74.84},
        weather_result=w_res,
        ocean_result=AgentResult(agent="OceanAnalyticsAgent", status="success", result={}),
        risk_result=AgentResult(agent="RiskAssessmentAgent", status="success", result={"verdict": "SAFE"})
    )

    charts = viz_result.result["charts"]
    assert charts["wave_series"]["unit"] == "m"
    assert charts["wind_series"]["unit"] == "km/h"
    assert charts["gust_series"]["unit"] == "km/h"
    assert charts["temperature_series"]["unit"] == "°C"
    assert charts["precipitation_series"]["unit"] == "mm"


@pytest.mark.asyncio
async def test_f_visualization_does_not_alter_risk_verdict():
    """Test F: Visualization Agent cannot mutate or override Risk Assessment verdicts."""
    risk_unsafe = AgentResult(
        agent="RiskAssessmentAgent",
        status="success",
        result={"verdict": "UNSAFE", "primary_drivers": ["HARD CONSTRAINT: Wave height > 3.5m"]}
    )

    w_res = AgentResult(
        agent="WeatherIntelligenceAgent",
        status="success",
        result={"verdict": "UNSAFE", "hourly_series": {"times": ["2026-09-11T12:00:00+05:30"], "wind_speed_kmh": [60.0], "wave_height_m": [4.0]}}
    )

    viz_result = await visualization_agent.execute(
        user_coords={"lat": 12.87, "lon": 74.84},
        weather_result=w_res,
        ocean_result=AgentResult(agent="OceanAnalyticsAgent", status="success", result={}),
        risk_result=risk_unsafe
    )

    # Risk result verdict MUST remain UNSAFE
    assert risk_unsafe.result["verdict"] == "UNSAFE"
    # Visualization result is purely a formatting presentation
    assert viz_result.agent == "VisualizationAgent"


@pytest.mark.asyncio
async def test_g_visualization_no_partial_or_fabricated_data_when_forecast_unavailable():
    """Regression Test F: Verify visualization does not plot partial/fabricated data when forecast_available == False."""
    w_unavailable = AgentResult(
        agent="WeatherIntelligenceAgent",
        status="partial",
        result={
            "verdict": "CAUTION",
            "metrics": {"forecast_available": False},
            "hourly_series": {
                "times": [],
                "wind_speed_kmh": [],
                "wind_gust_kmh": [],
                "wave_height_m": [],
                "temperature_c": [],
                "precipitation_mm": []
            }
        }
    )

    viz_result = await visualization_agent.execute(
        user_coords={"lat": 12.87, "lon": 74.84},
        weather_result=w_unavailable,
        ocean_result=AgentResult(agent="OceanAnalyticsAgent", status="success", result={}),
        risk_result=AgentResult(agent="RiskAssessmentAgent", status="success", result={"verdict": "CAUTION"})
    )

    assert viz_result.status == "partial"
    charts = viz_result.result["charts"]
    assert charts["available"] is False
    assert charts["timestamps"] == []
    assert charts["labels"] == []
    assert charts["wave_series"]["data"] == []
    assert charts["wind_series"]["data"] == []
    assert charts["gust_series"]["data"] == []
    assert charts["temperature_series"]["data"] == []
    assert charts["precipitation_series"]["data"] == []
    assert "unavailable" in charts["warning"].lower()
