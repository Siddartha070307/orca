"""Tests for temporal reasoning, time-window forecast filtering, and deterministic safety hierarchy."""
from datetime import datetime, date, time, timedelta
import pytest
from app.core.temporal import (
    IST,
    parse_temporal_expression,
    resolve_time_range,
    filter_forecast_by_timerange,
    parse_iso_datetime
)
from app.agents.weather_intelligence import weather_intelligence_agent
from app.orchestration.planner import planning_agent
from app.agents.user_interaction import user_interaction_agent
from app.models.schemas import QueryRequest, AgentResult
from app.core.safety_rules import arbitrate_safety_hierarchy, SafetyVerdict


# ====================================================================
# Unit Tests: Temporal Expression Parsing & Window Normalization
# ====================================================================

def test_parse_temporal_expressions():
    """Verify natural language temporal parsing handles all target expressions."""
    assert parse_temporal_expression("Is it safe now?") == "now"
    assert parse_temporal_expression("what are current conditions?") == "now"
    assert parse_temporal_expression("Is it safe right now to fish?") == "now"
    assert parse_temporal_expression("Can I go fishing today?") == "today"
    assert parse_temporal_expression("Is it safe tomorrow?") == "tomorrow"
    assert parse_temporal_expression("Is it safe tomorrow morning?") == "tomorrow morning"
    assert parse_temporal_expression("What about tomorrow afternoon?") == "tomorrow afternoon"
    assert parse_temporal_expression("Check weather for tomorrow evening near Goa") == "tomorrow evening"
    assert parse_temporal_expression("Forecast for next 24 hours") == "next 24 hours"
    assert parse_temporal_expression("Conditions in 24h") == "next 24 hours"
    assert parse_temporal_expression("Weather for next 48 hours") == "next 48 hours"
    assert parse_temporal_expression("Check 2026-09-15 safety") == "2026-09-15"


def test_resolve_time_range_exact_windows():
    """Verify resolved time windows match required operational boundaries in IST (+05:30)."""
    ref_time = datetime(2026, 9, 10, 10, 0, 0, tzinfo=IST)
    
    # "now"
    tr_now = resolve_time_range("now", reference_time=ref_time)
    assert tr_now["is_current"] is True
    assert tr_now["start"] == "2026-09-10T10:00:00+05:30"
    assert tr_now["end"] == "2026-09-10T10:00:00+05:30"
    assert tr_now["label"] == "Current Conditions"

    # "tomorrow" -> tomorrow 00:00 through 23:59:59
    tr_tmrw = resolve_time_range("tomorrow", reference_time=ref_time)
    assert tr_tmrw["is_current"] is False
    assert tr_tmrw["start"] == "2026-09-11T00:00:00+05:30"
    assert tr_tmrw["end"] == "2026-09-11T23:59:59+05:30"
    assert tr_tmrw["label"] == "Tomorrow"

    # "tomorrow morning" -> tomorrow 06:00 through 12:00
    tr_tmrw_morn = resolve_time_range("tomorrow morning", reference_time=ref_time)
    assert tr_tmrw_morn["is_current"] is False
    assert tr_tmrw_morn["start"] == "2026-09-11T06:00:00+05:30"
    assert tr_tmrw_morn["end"] == "2026-09-11T12:00:00+05:30"
    assert tr_tmrw_morn["label"] == "Tomorrow Morning"

    # "tomorrow afternoon" -> tomorrow 12:00 through 17:00
    tr_tmrw_aft = resolve_time_range("tomorrow afternoon", reference_time=ref_time)
    assert tr_tmrw_aft["start"] == "2026-09-11T12:00:00+05:30"
    assert tr_tmrw_aft["end"] == "2026-09-11T17:00:00+05:30"
    assert tr_tmrw_aft["label"] == "Tomorrow Afternoon"

    # "tomorrow evening" -> tomorrow 17:00 through 22:00
    tr_tmrw_eve = resolve_time_range("tomorrow evening", reference_time=ref_time)
    assert tr_tmrw_eve["start"] == "2026-09-11T17:00:00+05:30"
    assert tr_tmrw_eve["end"] == "2026-09-11T22:00:00+05:30"
    assert tr_tmrw_eve["label"] == "Tomorrow Evening"

    # "next 24 hours" -> ref through ref + 24h
    tr_24h = resolve_time_range("next 24 hours", reference_time=ref_time)
    assert tr_24h["start"] == "2026-09-10T10:00:00+05:30"
    assert tr_24h["end"] == "2026-09-11T10:00:00+05:30"
    assert tr_24h["label"] == "Next 24 Hours"


# ====================================================================
# REQUIRED SPECIFIC TEST CASES 1 THROUGH 5
# ====================================================================

@pytest.mark.asyncio
async def test_case_1_query_is_it_safe_now():
    """CASE 1: Query 'Is it safe now?' evaluates current conditions."""
    request = QueryRequest(
        text="Is it safe now near Mangalore?",
        user_type="app",
        location={"lat": 12.87, "lon": 74.84}
    )
    response = await user_interaction_agent.handle_query(request)
    
    # Assert time_range exposed in response
    assert response.time_range is not None
    assert response.time_range["label"] == "Current Conditions"
    assert response.time_range["is_current"] is True

    # Check WeatherIntelligenceAgent trace
    weather_trace = next(t for t in response.agent_traces if t.agent == "WeatherIntelligenceAgent")
    assert weather_trace.time_range["label"] == "Current Conditions"
    assert weather_trace.result["evaluated_window"]["is_current"] is True


@pytest.mark.asyncio
async def test_case_2_query_is_it_safe_tomorrow():
    """CASE 2: Query 'Is it safe tomorrow?' evaluates tomorrow's forecast window."""
    request = QueryRequest(
        text="Is it safe tomorrow near Mangalore?",
        user_type="app",
        location={"lat": 12.87, "lon": 74.84}
    )
    response = await user_interaction_agent.handle_query(request)

    assert response.time_range is not None
    assert response.time_range["label"] == "Tomorrow"
    assert response.time_range["is_current"] is False

    weather_trace = next(t for t in response.agent_traces if t.agent == "WeatherIntelligenceAgent")
    assert weather_trace.time_range["label"] == "Tomorrow"
    assert "evaluated_window" in weather_trace.result


@pytest.mark.asyncio
async def test_case_3_query_is_it_safe_tomorrow_morning():
    """CASE 3: Query 'Is it safe tomorrow morning?' evaluates only approximately 06:00–12:00 tomorrow."""
    request = QueryRequest(
        text="Is it safe tomorrow morning near Mangalore?",
        user_type="app",
        location={"lat": 12.87, "lon": 74.84}
    )
    response = await user_interaction_agent.handle_query(request)

    assert response.time_range is not None
    assert response.time_range["label"] == "Tomorrow Morning"
    
    start_dt = parse_iso_datetime(response.time_range["start"])
    end_dt = parse_iso_datetime(response.time_range["end"])
    
    # Window must be 06:00 to 12:00
    assert start_dt.time() == time(6, 0, 0)
    assert end_dt.time() == time(12, 0, 0)


@pytest.mark.asyncio
async def test_case_4_current_safe_tomorrow_morning_unsafe():
    """CASE 4: Current = SAFE, Tomorrow morning = UNSAFE -> result MUST be UNSAFE for 'tomorrow morning'."""
    ref_time = datetime(2026, 9, 10, 10, 0, 0, tzinfo=IST)
    tmrw_morning_range = resolve_time_range("tomorrow morning", reference_time=ref_time)

    # Build forecast dataset:
    # Current conditions: SAFE (wind 18 km/h, wave 1.0 m)
    # Tomorrow 06:00 to 12:00: UNSAFE (squall with wind 55 km/h, wave 3.8 m)
    # All other times: SAFE
    times = []
    winds = []
    waves = []
    gusts = []
    codes = []

    start_base = datetime(2026, 9, 10, 0, 0, 0, tzinfo=IST)
    for h in range(72):
        t_dt = start_base + timedelta(hours=h)
        times.append(t_dt.isoformat())
        # Check if inside tomorrow morning window (Sept 11, 06:00 to 12:00)
        if t_dt.date() == date(2026, 9, 11) and 6 <= t_dt.hour <= 12:
            winds.append(55.0)  # Extreme gale wind >= 50 km/h -> UNSAFE
            waves.append(3.8)   # High wave >= 3.5 m -> UNSAFE
            gusts.append(72.0)  # Severe gust >= 70 km/h -> UNSAFE
            codes.append(95)    # Thunderstorm code -> UNSAFE
        else:
            winds.append(18.0)
            waves.append(1.0)
            gusts.append(22.0)
            codes.append(1)

    mock_weather = {
        "source": "Mock Meteorological Feed",
        "timestamp": ref_time.isoformat(),
        "coordinates": {"lat": 12.87, "lon": 74.84},
        "current": {
            "wind_speed_kmh": 18.0,  # SAFE
            "wave_height_m": 1.0,    # SAFE
            "wind_gust_kmh": 22.0,   # SAFE
            "has_storm_alert": False,
            "storm_description": ""
        },
        "forecast_hourly": {
            "times": times,
            "wind_speed_kmh": winds,
            "wave_height_m": waves,
            "wind_gust_kmh": gusts,
            "weather_code": codes
        }
    }

    # Evaluate WeatherIntelligenceAgent with 'tomorrow morning' window
    weather_result = await weather_intelligence_agent.execute(
        weather_data=mock_weather,
        location={"lat": 12.87, "lon": 74.84},
        time_range=tmrw_morning_range
    )

    # Result MUST be UNSAFE
    assert weather_result.result["verdict"] == "UNSAFE"
    assert weather_result.result["metrics"]["wind_speed_kmh"] == 55.0
    assert weather_result.result["metrics"]["wave_height_m"] == 3.8
    assert any("HARD CONSTRAINT" in r for r in weather_result.result["reasons"])


@pytest.mark.asyncio
async def test_case_5_tomorrow_morning_safe_tomorrow_evening_unsafe():
    """CASE 5: Tomorrow morning = SAFE, Tomorrow evening = UNSAFE -> result for 'tomorrow morning' MUST remain SAFE."""
    ref_time = datetime(2026, 9, 10, 10, 0, 0, tzinfo=IST)
    tmrw_morning_range = resolve_time_range("tomorrow morning", reference_time=ref_time)

    # Build forecast dataset:
    # Tomorrow 06:00 to 12:00: SAFE (wind 18 km/h, wave 1.2 m, gust 22 km/h)
    # Tomorrow 17:00 to 22:00 (evening): UNSAFE (wind 62 km/h, wave 4.0 m, code 99 storm)
    times = []
    winds = []
    waves = []
    gusts = []
    codes = []

    start_base = datetime(2026, 9, 10, 0, 0, 0, tzinfo=IST)
    for h in range(72):
        t_dt = start_base + timedelta(hours=h)
        times.append(t_dt.isoformat())
        if t_dt.date() == date(2026, 9, 11) and 17 <= t_dt.hour <= 22:
            # Dangerous evening storm
            winds.append(62.0)
            waves.append(4.0)
            gusts.append(80.0)
            codes.append(99)
        elif t_dt.date() == date(2026, 9, 11) and 6 <= t_dt.hour <= 12:
            # Calmer morning conditions
            winds.append(18.0)
            waves.append(1.2)
            gusts.append(22.0)
            codes.append(1)
        else:
            winds.append(20.0)
            waves.append(1.3)
            gusts.append(24.0)
            codes.append(1)

    mock_weather = {
        "source": "Mock Meteorological Feed",
        "timestamp": ref_time.isoformat(),
        "coordinates": {"lat": 12.87, "lon": 74.84},
        "current": {
            "wind_speed_kmh": 20.0,
            "wave_height_m": 1.3,
            "wind_gust_kmh": 24.0,
            "has_storm_alert": False
        },
        "forecast_hourly": {
            "times": times,
            "wind_speed_kmh": winds,
            "wave_height_m": waves,
            "wind_gust_kmh": gusts,
            "weather_code": codes
        }
    }

    # Evaluate 'tomorrow morning' window
    weather_result = await weather_intelligence_agent.execute(
        weather_data=mock_weather,
        location={"lat": 12.87, "lon": 74.84},
        time_range=tmrw_morning_range
    )

    # The result for 'tomorrow morning' MUST remain SAFE despite the evening storm!
    assert weather_result.result["verdict"] == "SAFE"
    assert weather_result.result["metrics"]["wind_speed_kmh"] == 18.0
    assert weather_result.result["metrics"]["wave_height_m"] == 1.2
    assert weather_result.result["evaluated_window"]["label"] == "Tomorrow Morning"


# ====================================================================
# Additional Safety Precedence & Response Shape Verification
# ====================================================================

def test_pfz_never_overrides_unsafe_weather():
    """Verify deterministic safety hierarchy: Favorable PFZ NEVER overrides unsafe weather."""
    verdict, reasons, score = arbitrate_safety_hierarchy(
        weather_verdict=SafetyVerdict.UNSAFE,
        weather_reasons=["HARD CONSTRAINT: Wind 55 km/h exceeds 50 km/h threshold"],
        geospatial_verdict=SafetyVerdict.SAFE,
        geospatial_reasons=["Clear of restricted zones"],
        ocean_verdict="FAVORABLE",
        ocean_reasons=["Optimal chlorophyll-a and sea surface temperature front"]
    )
    assert verdict == SafetyVerdict.UNSAFE
    assert score >= 0.8
    assert any("HARD CONSTRAINT" in r for r in reasons)
    assert not any("Optimal chlorophyll" in r for r in reasons)


def test_pfz_never_overrides_caution_weather():
    """Verify deterministic safety hierarchy: Favorable PFZ NEVER overrides caution weather."""
    verdict, reasons, score = arbitrate_safety_hierarchy(
        weather_verdict=SafetyVerdict.CAUTION,
        weather_reasons=["ADVISORY: Wind 42 km/h in caution band"],
        geospatial_verdict=SafetyVerdict.SAFE,
        geospatial_reasons=["Clear of restricted zones"],
        ocean_verdict="FAVORABLE",
        ocean_reasons=["High fish school concentration"]
    )
    assert verdict == SafetyVerdict.CAUTION
    assert score >= 0.4


@pytest.mark.asyncio
async def test_case_d_out_of_horizon_forecast_returns_caution_not_safe():
    """CASE D: Requested date outside available forecast horizon must NOT silently return SAFE."""
    ref_time = datetime(2026, 9, 10, 10, 0, 0, tzinfo=IST)
    # Requested date is 10 days in future (2026-09-20)
    future_range = resolve_time_range("2026-09-20", reference_time=ref_time)

    # Forecast dataset only covers 72 hours (Sept 10 - Sept 13)
    times = [(ref_time + timedelta(hours=h)).isoformat() for h in range(72)]
    mock_weather = {
        "source": "Open-Meteo Live API",
        "timestamp": ref_time.isoformat(),
        "current": {
            "wind_speed_kmh": 15.0,
            "wave_height_m": 0.8,
            "wind_gust_kmh": 18.0,
            "has_storm_alert": False
        },
        "forecast_hourly": {
            "times": times,
            "wind_speed_kmh": [15.0] * 72,
            "wave_height_m": [0.8] * 72,
            "wind_gust_kmh": [18.0] * 72,
            "weather_code": [1] * 72
        }
    }

    result = await weather_intelligence_agent.execute(
        weather_data=mock_weather,
        location={"lat": 12.87, "lon": 74.84},
        time_range=future_range
    )

    # Must NOT be SAFE!
    assert result.result["verdict"] != "SAFE"
    assert result.result["verdict"] == "CAUTION"
    assert result.result["evaluated_window"]["out_of_horizon"] is True
    assert result.result["evaluated_window"]["data_points_evaluated"] == 0
    assert any("exceeds available forecast horizon" in r or "outside the available forecast horizon" in r for r in result.result["reasons"])


@pytest.mark.asyncio
async def test_case_f_query_time_range_matches_weather_intelligence():
    """CASE F: Verify time_range returned by /query matches WeatherIntelligence evaluated window."""
    request = QueryRequest(
        text="Is it safe tomorrow afternoon near Kochi?",
        user_type="app",
        location={"lat": 9.93, "lon": 76.26}
    )
    response = await user_interaction_agent.handle_query(request)

    weather_trace = next(t for t in response.agent_traces if t.agent == "WeatherIntelligenceAgent")
    assert response.time_range is not None
    assert response.time_range["start"] == weather_trace.time_range["start"]
    assert response.time_range["end"] == weather_trace.time_range["end"]
    assert response.time_range["label"] == weather_trace.time_range["label"]
    assert response.time_range["label"] == "Tomorrow Afternoon"


@pytest.mark.asyncio
async def test_case_g_agent_traces_preserve_temporal_context():
    """CASE G: Verify all 9 AgentResult traces preserve temporal context where applicable."""
    request = QueryRequest(
        text="Is it safe tomorrow evening near Goa?",
        user_type="app",
        location={"lat": 15.49, "lon": 73.82}
    )
    response = await user_interaction_agent.handle_query(request)

    # Exactly 9 agents participated
    traces_by_agent = {t.agent: t for t in response.agent_traces}
    assert len(traces_by_agent) == 9

    # Core temporal agents must carry the tomorrow evening window
    expected_label = "Tomorrow Evening"
    assert traces_by_agent["PlanningAgent"].time_range["label"] == expected_label
    assert traces_by_agent["WeatherIntelligenceAgent"].time_range["label"] == expected_label
    assert traces_by_agent["RiskAssessmentAgent"].time_range["label"] == expected_label
    assert traces_by_agent["VisualizationAgent"].time_range["label"] == expected_label
    assert traces_by_agent["ReportingAgent"].time_range["label"] == expected_label


# ====================================================================
# Targeted Regression Test Cases A Through M (Temporal Semantics Fix)
# ====================================================================

def test_case_a_explicit_date_morning():
    """CASE A: 'September 11, 2026 in the morning' resolves to 2026-09-11 06:00 - 12:00 IST."""
    query = "Is it safe to sail here on September 11, 2026 in the morning?"
    canonical = parse_temporal_expression(query)
    assert canonical == "2026-09-11 morning"

    tr = resolve_time_range(canonical)
    assert tr["start"] == "2026-09-11T06:00:00+05:30"
    assert tr["end"] == "2026-09-11T12:00:00+05:30"
    assert tr["label"] == "September 11 Morning"
    assert tr["is_current"] is False


def test_case_b_explicit_date_afternoon():
    """CASE B: 'September 11, 2026 in the afternoon' resolves to 2026-09-11 12:00 - 17:00 IST."""
    query = "Is it safe to sail here on September 11, 2026 in the afternoon?"
    canonical = parse_temporal_expression(query)
    assert canonical == "2026-09-11 afternoon"

    tr = resolve_time_range(canonical)
    assert tr["start"] == "2026-09-11T12:00:00+05:30"
    assert tr["end"] == "2026-09-11T17:00:00+05:30"
    assert tr["label"] == "September 11 Afternoon"
    assert tr["is_current"] is False


def test_case_c_explicit_date_evening():
    """CASE C (TEST 6D): 'September 11, 2026 in the evening' resolves to 2026-09-11 17:00 - 22:00 IST."""
    query = "Is it safe to sail here on September 11, 2026 in the evening?"
    canonical = parse_temporal_expression(query)
    assert canonical == "2026-09-11 evening"

    tr = resolve_time_range(canonical)
    assert tr["start"] == "2026-09-11T17:00:00+05:30"
    assert tr["end"] == "2026-09-11T22:00:00+05:30"
    assert tr["label"] == "September 11 Evening"
    assert tr["is_current"] is False


def test_case_d_explicit_date_night():
    """CASE D: 'September 11, 2026 at night' resolves to 2026-09-11 22:00 - 2026-09-12 06:00 IST."""
    query = "Is it safe to sail here on September 11, 2026 at night?"
    canonical = parse_temporal_expression(query)
    assert canonical == "2026-09-11 night"

    tr = resolve_time_range(canonical)
    assert tr["start"] == "2026-09-11T22:00:00+05:30"
    assert tr["end"] == "2026-09-12T06:00:00+05:30"
    assert tr["label"] == "September 11 Night"
    assert tr["is_current"] is False


def test_case_e_tomorrow_morning_deterministic():
    """CASE E: 'tomorrow morning' with deterministic reference time resolves to D+1 06:00 - 12:00."""
    ref_dt = datetime(2026, 9, 10, 10, 0, 0, tzinfo=IST)
    tr = resolve_time_range("tomorrow morning", reference_time=ref_dt)
    assert tr["start"] == "2026-09-11T06:00:00+05:30"
    assert tr["end"] == "2026-09-11T12:00:00+05:30"
    assert tr["label"] == "Tomorrow Morning"


def test_case_f_tomorrow_afternoon_deterministic():
    """CASE F: 'tomorrow afternoon' with deterministic reference time resolves to D+1 12:00 - 17:00."""
    ref_dt = datetime(2026, 9, 10, 10, 0, 0, tzinfo=IST)
    tr = resolve_time_range("tomorrow afternoon", reference_time=ref_dt)
    assert tr["start"] == "2026-09-11T12:00:00+05:30"
    assert tr["end"] == "2026-09-11T17:00:00+05:30"
    assert tr["label"] == "Tomorrow Afternoon"


def test_case_g_tomorrow_evening_deterministic():
    """CASE G: 'tomorrow evening' with deterministic reference time resolves to D+1 17:00 - 22:00."""
    ref_dt = datetime(2026, 9, 10, 10, 0, 0, tzinfo=IST)
    tr = resolve_time_range("tomorrow evening", reference_time=ref_dt)
    assert tr["start"] == "2026-09-11T17:00:00+05:30"
    assert tr["end"] == "2026-09-11T22:00:00+05:30"
    assert tr["label"] == "Tomorrow Evening"


def test_case_h_tomorrow_night_deterministic():
    """CASE H: 'tomorrow night' with deterministic reference time resolves to D+1 22:00 - D+2 06:00."""
    ref_dt = datetime(2026, 9, 10, 10, 0, 0, tzinfo=IST)
    tr = resolve_time_range("tomorrow night", reference_time=ref_dt)
    assert tr["start"] == "2026-09-11T22:00:00+05:30"
    assert tr["end"] == "2026-09-12T06:00:00+05:30"
    assert tr["label"] == "Tomorrow Night"


def test_case_i_day_after_tomorrow():
    """CASE I: 'day after tomorrow' resolves to D+2 full day and sub-day windows."""
    ref_dt = datetime(2026, 9, 10, 10, 0, 0, tzinfo=IST)
    
    # Full day D+2
    tr_full = resolve_time_range("day after tomorrow", reference_time=ref_dt)
    assert tr_full["start"] == "2026-09-12T00:00:00+05:30"
    assert tr_full["end"] == "2026-09-12T23:59:59+05:30"
    assert tr_full["label"] == "Day After Tomorrow"

    # Sub-day morning D+2
    tr_morn = resolve_time_range("day after tomorrow morning", reference_time=ref_dt)
    assert tr_morn["start"] == "2026-09-12T06:00:00+05:30"
    assert tr_morn["end"] == "2026-09-12T12:00:00+05:30"
    assert tr_morn["label"] == "Day After Tomorrow Morning"

    # Sub-day evening D+2
    tr_eve = resolve_time_range("day after tomorrow evening", reference_time=ref_dt)
    assert tr_eve["start"] == "2026-09-12T17:00:00+05:30"
    assert tr_eve["end"] == "2026-09-12T22:00:00+05:30"
    assert tr_eve["label"] == "Day After Tomorrow Evening"

    # Sub-day night D+2 -> D+3
    tr_night = resolve_time_range("day after tomorrow night", reference_time=ref_dt)
    assert tr_night["start"] == "2026-09-12T22:00:00+05:30"
    assert tr_night["end"] == "2026-09-13T06:00:00+05:30"
    assert tr_night["label"] == "Day After Tomorrow Night"


def test_case_j_utc_to_ist_boundary():
    """CASE J: Near midnight UTC, relative dates strictly use the LOCAL IST calendar date."""
    # 2026-09-10T18:33:34Z -> In IST (+05:30), it is 2026-09-11T00:03:34+05:30 (Date D = 2026-09-11)
    ref_utc_late = parse_iso_datetime("2026-09-10T18:33:34Z")
    
    # 'today' must be Date D = 2026-09-11
    tr_today = resolve_time_range("today", reference_time=ref_utc_late)
    assert tr_today["start"].startswith("2026-09-11")
    assert tr_today["end"].startswith("2026-09-11")

    # 'tomorrow morning' must be D+1 = 2026-09-12 06:00 - 12:00
    tr_tmrw = resolve_time_range("tomorrow morning", reference_time=ref_utc_late)
    assert tr_tmrw["start"] == "2026-09-12T06:00:00+05:30"
    assert tr_tmrw["end"] == "2026-09-12T12:00:00+05:30"

    # Conversely, when UTC timestamp is earlier: 2026-09-10T10:00:00Z -> IST is 2026-09-10T15:30:00+05:30 (Date D = 2026-09-10)
    ref_utc_earlier = parse_iso_datetime("2026-09-10T10:00:00Z")
    tr_tmrw_earlier = resolve_time_range("tomorrow morning", reference_time=ref_utc_earlier)
    assert tr_tmrw_earlier["start"] == "2026-09-11T06:00:00+05:30"
    assert tr_tmrw_earlier["end"] == "2026-09-11T12:00:00+05:30"


def test_case_k_explicit_date_overrides_relative_date():
    """CASE K: Explicit calendar date must be authoritative when combined with relative words."""
    query = "Is it safe on September 11, 2026 in the evening instead of tomorrow?"
    canonical = parse_temporal_expression(query)
    assert canonical == "2026-09-11 evening"

    ref_dt = datetime(2026, 9, 10, 10, 0, 0, tzinfo=IST)
    tr = resolve_time_range(canonical, reference_time=ref_dt)
    assert tr["start"] == "2026-09-11T17:00:00+05:30"
    assert tr["end"] == "2026-09-11T22:00:00+05:30"
    assert tr["label"] == "September 11 Evening"


def test_case_tonight_cross_midnight():
    """Verify 'tonight' / 'today night' resolves to D 22:00 through D+1 06:00."""
    ref_dt = datetime(2026, 9, 10, 10, 0, 0, tzinfo=IST)
    tr = resolve_time_range("tonight", reference_time=ref_dt)
    assert tr["start"] == "2026-09-10T22:00:00+05:30"
    assert tr["end"] == "2026-09-11T06:00:00+05:30"
    assert tr["label"] == "Tonight"


def test_case_test6a_late_night_today_label():
    """Verify late-night 'today' window extending past midnight displays 'Tonight / Early Morning'."""
    ref_dt = datetime(2026, 9, 10, 23, 58, 0, tzinfo=IST)
    tr = resolve_time_range("today", reference_time=ref_dt)
    assert tr["start"] == "2026-09-10T23:00:00+05:30"
    assert tr["end"] == "2026-09-11T05:58:00+05:30"
    assert tr["label"] == "Tonight / Early Morning"


@pytest.mark.asyncio
async def test_case_l_downstream_consistency_explicit_evening():
    """CASE L: Full pipeline consistency for 'September 11, 2026 in the evening'."""
    request = QueryRequest(
        text="Is it safe to sail here on September 11, 2026 in the evening near Mangalore?",
        user_type="app",
        location={"lat": 12.87, "lon": 74.84},
        timestamp="2026-09-10T10:00:00+05:30"
    )
    response = await user_interaction_agent.handle_query(request)

    expected_start = "2026-09-11T17:00:00+05:30"
    expected_end = "2026-09-11T22:00:00+05:30"
    expected_label = "September 11 Evening"

    # Top-level response time_range
    assert response.time_range is not None
    assert response.time_range["start"] == expected_start
    assert response.time_range["end"] == expected_end
    assert response.time_range["label"] == expected_label

    traces_by_agent = {t.agent: t for t in response.agent_traces}
    assert len(traces_by_agent) == 9

    # PlanningAgent
    assert traces_by_agent["PlanningAgent"].time_range["start"] == expected_start
    assert traces_by_agent["PlanningAgent"].time_range["end"] == expected_end
    assert traces_by_agent["PlanningAgent"].time_range["label"] == expected_label

    # WeatherIntelligenceAgent
    assert traces_by_agent["WeatherIntelligenceAgent"].time_range["start"] == expected_start
    assert traces_by_agent["WeatherIntelligenceAgent"].time_range["end"] == expected_end
    assert traces_by_agent["WeatherIntelligenceAgent"].time_range["label"] == expected_label
    assert traces_by_agent["WeatherIntelligenceAgent"].result["evaluated_window"]["start"] == expected_start
    assert traces_by_agent["WeatherIntelligenceAgent"].result["evaluated_window"]["end"] == expected_end

    # RiskAssessmentAgent
    assert traces_by_agent["RiskAssessmentAgent"].time_range["start"] == expected_start
    assert traces_by_agent["RiskAssessmentAgent"].time_range["end"] == expected_end
    assert traces_by_agent["RiskAssessmentAgent"].time_range["label"] == expected_label

    # VisualizationAgent
    assert traces_by_agent["VisualizationAgent"].time_range["start"] == expected_start
    assert traces_by_agent["VisualizationAgent"].time_range["end"] == expected_end
    assert traces_by_agent["VisualizationAgent"].time_range["label"] == expected_label

    # ReportingAgent
    assert traces_by_agent["ReportingAgent"].time_range["start"] == expected_start
    assert traces_by_agent["ReportingAgent"].time_range["end"] == expected_end
    assert traces_by_agent["ReportingAgent"].time_range["label"] == expected_label


@pytest.mark.asyncio
async def test_case_m_downstream_consistency_deterministic_request_timestamp():
    """CASE M: QueryRequest with request.timestamp evaluates relative date deterministically."""
    request = QueryRequest(
        text="Is it safe to sail here tomorrow morning near Karwar?",
        user_type="app",
        location={"lat": 14.82, "lon": 74.13},
        timestamp="2026-09-10T10:00:00Z"
    )
    response = await user_interaction_agent.handle_query(request)

    expected_start = "2026-09-11T06:00:00+05:30"
    expected_end = "2026-09-11T12:00:00+05:30"
    expected_label = "Tomorrow Morning"

    assert response.time_range["start"] == expected_start
    assert response.time_range["end"] == expected_end
    assert response.time_range["label"] == expected_label

    traces_by_agent = {t.agent: t for t in response.agent_traces}
    assert traces_by_agent["PlanningAgent"].time_range["start"] == expected_start
    assert traces_by_agent["WeatherIntelligenceAgent"].time_range["start"] == expected_start
    assert traces_by_agent["RiskAssessmentAgent"].time_range["start"] == expected_start
    assert traces_by_agent["VisualizationAgent"].time_range["start"] == expected_start
    assert traces_by_agent["ReportingAgent"].time_range["start"] == expected_start


# ====================================================================
# Targeted Corrections Verification: No Synthetic Gusts & Dynamic Year
# ====================================================================

def test_missing_forecast_gust_data_never_creates_synthetic_gust():
    """Verify that missing forecast gust data returns None (explicitly unavailable) and NEVER derives a synthetic gust or 0.0."""
    ref_dt = datetime(2026, 9, 10, 10, 0, 0, tzinfo=IST)
    time_range = resolve_time_range("tomorrow", reference_time=ref_dt)

    # Hourly forecast with wind 35.0 km/h, but ZERO gust data provided
    mock_hourly = {
        "times": ["2026-09-11T08:00:00+05:30", "2026-09-11T12:00:00+05:30"],
        "wind_speed_kmh": [35.0, 38.0],
        "wave_height_m": [1.5, 1.6],
        "wind_gust_kmh": [],  # Unavailable
        "weather_code": [1, 1],
        "temperature_c": [28.0, 29.0],
        "precipitation_mm": [0.0, 0.0]
    }

    result = filter_forecast_by_timerange(mock_hourly, time_range)
    assert result["matched_points"] == 2
    assert result["max_wind_kmh"] == 38.0
    # Must NOT be 38.0 * 1.2 = 45.6! Must be None (explicitly unavailable, not 0.0 and not derived)
    assert result["max_gust_kmh"] is None
    assert result["max_gust_kmh"] != 0.0
    assert result["max_gust_kmh"] != round(38.0 * 1.2, 1)
    assert result["filtered_series"]["wind_gust_kmh"] == []


def test_natural_language_date_explicit_year():
    """Verify natural-language date with explicit year is authoritative regardless of reference year."""
    # Reference year is 2027, but query specifies 2026
    ref_2027 = datetime(2027, 3, 15, 10, 0, 0, tzinfo=IST)
    canonical = parse_temporal_expression("September 11, 2026", reference_time=ref_2027)
    assert canonical == "2026-09-11"

    tr = resolve_time_range(canonical, reference_time=ref_2027)
    assert tr["start"] == "2026-09-11T00:00:00+05:30"
    assert tr["end"] == "2026-09-11T23:59:59+05:30"

    # Reference year is 2026, but query specifies 2028
    ref_2026 = datetime(2026, 9, 10, 10, 0, 0, tzinfo=IST)
    canonical_28 = parse_temporal_expression("September 11, 2028", reference_time=ref_2026)
    assert canonical_28 == "2028-09-11"
    tr_28 = resolve_time_range(canonical_28, reference_time=ref_2026)
    assert tr_28["start"] == "2028-09-11T00:00:00+05:30"
    assert tr_28["end"] == "2028-09-11T23:59:59+05:30"


def test_natural_language_date_omitted_year():
    """Verify natural-language date without year dynamically derives year from reference date."""
    # Case 1: Ref date in 2026 (2026-09-10) -> "September 11" resolves to 2026-09-11
    ref_2026 = datetime(2026, 9, 10, 10, 0, 0, tzinfo=IST)
    canonical_26 = parse_temporal_expression("September 11", reference_time=ref_2026)
    assert canonical_26 == "2026-09-11"
    tr_26 = resolve_time_range(canonical_26, reference_time=ref_2026)
    assert tr_26["start"] == "2026-09-11T00:00:00+05:30"
    assert tr_26["end"] == "2026-09-11T23:59:59+05:30"

    # Case 2: Ref date in 2027 (2027-03-15) -> "September 11" resolves to 2027-09-11
    ref_2027 = datetime(2027, 3, 15, 10, 0, 0, tzinfo=IST)
    canonical_27 = parse_temporal_expression("September 11", reference_time=ref_2027)
    assert canonical_27 == "2027-09-11"
    tr_27 = resolve_time_range(canonical_27, reference_time=ref_2027)
    assert tr_27["start"] == "2027-09-11T00:00:00+05:30"
    assert tr_27["end"] == "2027-09-11T23:59:59+05:30"


def test_natural_language_date_omitted_year_with_morning():
    """Verify omitted year with 'morning' derives year from reference date and applies 06:00-12:00."""
    ref_2027 = datetime(2027, 3, 15, 10, 0, 0, tzinfo=IST)
    canonical = parse_temporal_expression("September 11 in the morning", reference_time=ref_2027)
    assert canonical == "2027-09-11 morning"

    tr = resolve_time_range(canonical, reference_time=ref_2027)
    assert tr["start"] == "2027-09-11T06:00:00+05:30"
    assert tr["end"] == "2027-09-11T12:00:00+05:30"
    assert tr["label"] == "September 11 Morning"


def test_natural_language_date_omitted_year_with_evening():
    """Verify omitted year with 'evening' derives year from reference date and applies 17:00-22:00."""
    ref_2027 = datetime(2027, 3, 15, 10, 0, 0, tzinfo=IST)
    canonical = parse_temporal_expression("September 11 in the evening", reference_time=ref_2027)
    assert canonical == "2027-09-11 evening"

    tr = resolve_time_range(canonical, reference_time=ref_2027)
    assert tr["start"] == "2027-09-11T17:00:00+05:30"
    assert tr["end"] == "2027-09-11T22:00:00+05:30"
    assert tr["label"] == "September 11 Evening"


def test_natural_language_date_omitted_year_around_year_boundary():
    """Verify omitted year around year boundary (e.g. Dec 31 asking about Jan 2) resolves to next year."""
    ref_dec = datetime(2026, 12, 31, 10, 0, 0, tzinfo=IST)
    
    # Query: "January 2"
    canonical_jan = parse_temporal_expression("January 2", reference_time=ref_dec)
    assert canonical_jan == "2027-01-02"
    tr_jan = resolve_time_range(canonical_jan, reference_time=ref_dec)
    assert tr_jan["start"] == "2027-01-02T00:00:00+05:30"
    assert tr_jan["end"] == "2027-01-02T23:59:59+05:30"

    # Query: "January 2 in the morning"
    canonical_jan_morn = parse_temporal_expression("January 2 in the morning", reference_time=ref_dec)
    assert canonical_jan_morn == "2027-01-02 morning"
    tr_jan_morn = resolve_time_range(canonical_jan_morn, reference_time=ref_dec)
    assert tr_jan_morn["start"] == "2027-01-02T06:00:00+05:30"
    assert tr_jan_morn["end"] == "2027-01-02T12:00:00+05:30"
    assert tr_jan_morn["label"] == "January 2 Morning"


@pytest.mark.asyncio
async def test_missing_gust_evaluates_as_unavailable_not_zero_in_weather_intelligence():
    """Verify missing gust in forecast evaluates to None across WeatherIntelligenceAgent and safety evaluation."""
    ref_dt = datetime(2026, 9, 10, 10, 0, 0, tzinfo=IST)
    time_range = resolve_time_range("tomorrow", reference_time=ref_dt)

    mock_weather = {
        "source": "Open-Meteo Live API",
        "timestamp": ref_dt.isoformat(),
        "current": {
            "wind_speed_kmh": 20.0,
            "wave_height_m": 1.2,
            "wind_gust_kmh": None,
            "has_storm_alert": False
        },
        "forecast_hourly": {
            "times": ["2026-09-11T08:00:00+05:30", "2026-09-11T12:00:00+05:30"],
            "wind_speed_kmh": [20.0, 22.0],
            "wave_height_m": [1.1, 1.2],
            "wind_gust_kmh": [],  # Unavailable
            "weather_code": [1, 1]
        }
    }

    res = await weather_intelligence_agent.execute(
        weather_data=mock_weather,
        location={"lat": 14.8, "lon": 74.1},
        time_range=time_range
    )
    assert res.result["evaluated_window"]["peak_gust_kmh"] is None
    assert res.result["metrics"]["wind_gust_kmh"] is None
    assert res.result["metrics"]["wind_gust_kmh"] != 0.0
    assert res.result["verdict"] == "SAFE"


def test_missing_measurements_filter_forecast_by_timerange():
    """Verify missing wind, wave, or gust series in filter_forecast_by_timerange return None, not 0.0."""
    ref_dt = datetime(2026, 9, 10, 10, 0, 0, tzinfo=IST)
    time_range = resolve_time_range("tomorrow", reference_time=ref_dt)

    # Empty window (no matched indices)
    empty_hourly = {
        "times": ["2026-09-08T08:00:00+05:30"],
        "wind_speed_kmh": [20.0],
        "wave_height_m": [1.0],
        "wind_gust_kmh": [25.0],
    }
    empty_res = filter_forecast_by_timerange(empty_hourly, time_range)
    assert empty_res["matched_points"] == 0
    assert empty_res["max_wind_kmh"] is None
    assert empty_res["max_wave_m"] is None
    assert empty_res["max_gust_kmh"] is None

    # Matched timestamps but wave and gust arrays are empty
    partial_hourly = {
        "times": ["2026-09-11T08:00:00+05:30"],
        "wind_speed_kmh": [22.0],
        "wave_height_m": [],
        "wind_gust_kmh": [],
    }
    partial_res = filter_forecast_by_timerange(partial_hourly, time_range)
    assert partial_res["matched_points"] == 1
    assert partial_res["max_wind_kmh"] == 22.0
    assert partial_res["max_wave_m"] is None
    assert partial_res["max_gust_kmh"] is None



