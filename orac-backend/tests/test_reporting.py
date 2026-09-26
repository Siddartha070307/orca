import pytest
from unittest.mock import AsyncMock, patch
from app.agents.reporting import ReportingAgent
from app.models.schemas import AgentResult


@pytest.fixture
def base_results():
    risk_res = AgentResult(
        agent="RiskAssessmentAgent",
        status="success",
        result={
            "verdict": "UNSAFE",
            "primary_drivers": ["Wind speed 58.0 km/h exceeds 50.0 km/h threshold", "Severe gale conditions"],
            "actionable_directive": "STAY ASHORE"
        },
        location={"lat": 14.8, "lon": 74.1}
    )

    weather_res = AgentResult(
        agent="WeatherIntelligenceAgent",
        status="success",
        time_range={"start": "2026-09-11T06:00:00Z", "end": "2026-09-11T12:00:00Z", "label": "tomorrow morning"},
        result={
            "verdict": "UNSAFE",
            "metrics": {
                "wind_speed_kmh": 58.0,
                "wave_height_m": 3.8,
                "wind_gust_kmh": 68.0,
                "precipitation_mm": 12.0
            }
        },
        location={"lat": 14.8, "lon": 74.1}
    )

    ocean_res = AgentResult(
        agent="OceanAnalyticsAgent",
        status="success",
        result={
            "verdict": "FAVORABLE",
            "candidates": [{
                "id": "PFZ-KAR-01",
                "distance_km": 18.5,
                "bearing_deg": 245,
                "sst_c": 28.5,
                "target_species": ["Mackerel", "Sardinella"]
            }]
        }
    )

    geo_res = AgentResult(
        agent="GeospatialReasoningAgent",
        status="success",
        result={
            "verdict": "SAFE",
            "inside_geofence": False,
            "nearest_boundary_distance_km": 8.4,
            "status_description": "Clear of all marine protected zones"
        }
    )

    return risk_res, weather_res, ocean_res, geo_res


@pytest.mark.asyncio
async def test_reporting_test_a_unsafe_enforced_even_if_llm_mild(base_results):
    """Test A: Verdict UNSAFE is strictly reflected in report output even if LLM text is mild."""
    risk_res, weather_res, ocean_res, geo_res = base_results
    agent = ReportingAgent()

    # Mock Claude returning a mild / hallucinated safe message
    with patch("app.integrations.claude_client.claude_client.client") as mock_client:
        mock_client.messages.create = AsyncMock(return_value=type("Resp", (), {
            "content": [type("Text", (), {"text": "Weather seems pleasant today. You can sail safely."})()]
        })())

        res = await agent.execute(
            query="Can I sail tomorrow morning?",
            location_name="Karwar",
            risk_result=risk_res,
            weather_result=weather_res,
            ocean_result=ocean_res,
            geospatial_result=geo_res
        )

        assert res.status == "success"
        report_text = res.result["report_english"]
        # Must enforce UNSAFE header despite Claude's mild text
        assert "SAFETY ADVISORY: UNSAFE TO SAIL" in report_text
        assert res.result["verdict"] == "UNSAFE"


@pytest.mark.asyncio
async def test_reporting_test_b_caution_enforced(base_results):
    """Test B: Verdict CAUTION is strictly reflected in report output."""
    risk_res, weather_res, ocean_res, geo_res = base_results
    risk_res.result["verdict"] = "CAUTION"
    risk_res.result["primary_drivers"] = ["Wave height 2.6 m reaches caution threshold"]
    agent = ReportingAgent()

    with patch("app.integrations.claude_client.claude_client.client") as mock_client:
        mock_client.messages.create = AsyncMock(return_value=type("Resp", (), {
            "content": [type("Text", (), {"text": "Everything is perfectly fine out on the water."})()]
        })())

        res = await agent.execute(
            query="Can I fish near Karwar?",
            location_name="Karwar",
            risk_result=risk_res,
            weather_result=weather_res,
            ocean_result=ocean_res,
            geospatial_result=geo_res
        )

        report_text = res.result["report_english"]
        assert "SAFETY ADVISORY: PROCEED WITH CAUTION" in report_text
        assert res.result["verdict"] == "CAUTION"


@pytest.mark.asyncio
async def test_reporting_test_c_numerical_evidence_matches_upstream(base_results):
    """Test C: Numerical evidence matches upstream weather metrics."""
    risk_res, weather_res, ocean_res, geo_res = base_results
    agent = ReportingAgent()

    res = await agent.execute(
        query="Report for Karwar",
        location_name="Karwar",
        risk_result=risk_res,
        weather_result=weather_res,
        ocean_result=ocean_res,
        geospatial_result=geo_res
    )

    evidence = res.result["evidence_cited"]
    assert evidence["wind_speed_kmh"] == 58.0
    assert evidence["wave_height_m"] == 3.8
    assert "Wind: 58.0 km/h" in res.result["safety_summary"]
    assert "Wave: 3.8 m" in res.result["safety_summary"]


@pytest.mark.asyncio
async def test_reporting_test_d_temporal_window_label_included(base_results):
    """Test D: Temporal window label is included in the report."""
    risk_res, weather_res, ocean_res, geo_res = base_results
    agent = ReportingAgent()

    res = await agent.execute(
        query="Is it safe tomorrow morning?",
        location_name="Karwar",
        risk_result=risk_res,
        weather_result=weather_res,
        ocean_result=ocean_res,
        geospatial_result=geo_res
    )

    assert "tomorrow morning" in res.result["report_english"].lower()
    assert "[tomorrow morning]" in res.result["safety_summary"]
    assert res.result["temporal_window"] == "tomorrow morning"


@pytest.mark.asyncio
async def test_reporting_test_e_offline_fallback_contains_key_fields(base_results):
    """Test E: Offline fallback report contains all key upstream fields."""
    risk_res, weather_res, ocean_res, geo_res = base_results
    agent = ReportingAgent()

    # Ensure offline mode (client is None)
    with patch("app.integrations.claude_client.claude_client.client", None):
        res = await agent.execute(
            query="Karwar status",
            location_name="Karwar",
            risk_result=risk_res,
            weather_result=weather_res,
            ocean_result=ocean_res,
            geospatial_result=geo_res
        )

        report = res.result["report_english"]
        # 1. Deterministic verdict
        assert "UNSAFE" in report
        # 2. Weather metrics
        assert "58" in report
        assert "3.8" in report
        # 3. Temporal window
        assert "tomorrow morning" in report.lower()
        # 4. Geospatial
        assert "8.4" in report or "Clear" in report
        # 5. Primary risk drivers
        assert "exceeds 50.0 km/h threshold" in report


@pytest.mark.asyncio
async def test_reporting_test_f_warning_reasons_listed(base_results):
    """Test F: Upstream warning/danger reasons are listed in the report."""
    risk_res, weather_res, ocean_res, geo_res = base_results
    agent = ReportingAgent()

    res = await agent.execute(
        query="Karwar status",
        location_name="Karwar",
        risk_result=risk_res,
        weather_result=weather_res,
        ocean_result=ocean_res,
        geospatial_result=geo_res
    )

    drivers = res.result["evidence_cited"]["drivers"]
    assert "Wind speed 58.0 km/h exceeds 50.0 km/h threshold" in drivers
    assert any("58.0 km/h" in r for r in drivers)


@pytest.mark.asyncio
async def test_reporting_test_g_never_crashes_on_missing_optional_fields():
    """Test G: Reporting agent never crashes on missing optional fields."""
    agent = ReportingAgent()

    # Pass all None or partial results
    res = await agent.execute(
        query="",
        location_name="",
        risk_result=None,
        weather_result=None,
        ocean_result=None,
        geospatial_result=None
    )

    assert res.status == "success"
    assert res.result["verdict"] in ["SAFE", "CAUTION", "UNSAFE"]
    assert isinstance(res.result["report_english"], str)
    assert len(res.result["report_english"]) > 0
