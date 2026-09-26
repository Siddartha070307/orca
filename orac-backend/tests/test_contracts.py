import pytest
from app.models.schemas import AgentResult
from app.agents.user_interaction import UserInteractionAgent
from app.orchestration.planner import PlanningAgent
from app.agents.marine_data_discovery import MarineDataDiscoveryAgent
from app.agents.weather_intelligence import WeatherIntelligenceAgent
from app.agents.ocean_analytics import OceanAnalyticsAgent
from app.agents.geospatial_reasoning import GeospatialReasoningAgent
from app.agents.risk_assessment import RiskAssessmentAgent
from app.agents.visualization import VisualizationAgent
from app.agents.reporting import ReportingAgent


def assert_conforming_agent_result(res: AgentResult, expected_agent_name: str):
    """Verifies that an object conforms strictly to the standard AgentResult schema."""
    assert isinstance(res, AgentResult), f"{expected_agent_name} did not return an AgentResult instance"
    assert res.agent == expected_agent_name, f"Expected agent {expected_agent_name}, got {res.agent}"
    assert res.status in ["success", "partial", "error"], f"Invalid status: {res.status}"
    assert isinstance(res.result, dict), f"result must be a dict, got {type(res.result)}"
    assert isinstance(res.confidence, (int, float)), f"confidence must be float, got {type(res.confidence)}"
    assert 0.0 <= res.confidence <= 1.0, f"confidence out of bounds: {res.confidence}"
    assert isinstance(res.sources, list), f"sources must be a list, got {type(res.sources)}"
    for src in res.sources:
        assert isinstance(src, dict), f"Each source must be a dict, got {type(src)}"
        assert "name" in src, "Source missing 'name' field"
        assert "timestamp" in src, "Source missing 'timestamp' field"
    assert isinstance(res.warnings, list), f"warnings must be a list, got {type(res.warnings)}"
    for warn in res.warnings:
        assert isinstance(warn, str), f"Each warning must be a string, got {type(warn)}"
    if res.location is not None:
        assert isinstance(res.location, dict), f"location must be dict or None, got {type(res.location)}"
    if res.time_range is not None:
        assert isinstance(res.time_range, dict), f"time_range must be dict or None, got {type(res.time_range)}"


@pytest.mark.asyncio
async def test_user_interaction_agent_contract():
    agent = UserInteractionAgent()
    res = await agent.execute(text="Is it safe to sail from Mangalore?")
    assert_conforming_agent_result(res, "UserInteractionAgent")


@pytest.mark.asyncio
async def test_planning_agent_contract():
    agent = PlanningAgent()
    res = await agent.execute(query="Is it safe to sail from Mangalore tomorrow?")
    assert_conforming_agent_result(res, "PlanningAgent")


@pytest.mark.asyncio
async def test_marine_data_discovery_agent_contract():
    agent = MarineDataDiscoveryAgent()
    res = await agent.execute(location={"lat": 12.87, "lon": 74.84}, sector_name="Mangalore")
    assert_conforming_agent_result(res, "MarineDataDiscoveryAgent")


@pytest.mark.asyncio
async def test_weather_intelligence_agent_contract():
    agent = WeatherIntelligenceAgent()
    weather_data = {
        "current": {"wind_speed_kmh": 22.0, "wave_height_m": 1.5, "wind_gust_kmh": 28.0, "has_storm_alert": False},
        "coordinates": {"lat": 12.87, "lon": 74.84},
        "source": "Open-Meteo"
    }
    res = await agent.execute(weather_data=weather_data)
    assert_conforming_agent_result(res, "WeatherIntelligenceAgent")


@pytest.mark.asyncio
async def test_ocean_analytics_agent_contract():
    agent = OceanAnalyticsAgent()
    bulletins = [{
        "zone_id": "PFZ-01",
        "lat": 12.87,
        "lon": 74.84,
        "sst_c": 28.5,
        "chlorophyll_mg_m3": 1.2
    }]
    res = await agent.execute(pfz_bulletins=bulletins)
    assert_conforming_agent_result(res, "OceanAnalyticsAgent")


@pytest.mark.asyncio
async def test_geospatial_reasoning_agent_contract():
    agent = GeospatialReasoningAgent()
    res = await agent.execute(user_coords={"lat": 12.87, "lon": 74.84}, pfz_candidates=[])
    assert_conforming_agent_result(res, "GeospatialReasoningAgent")


@pytest.mark.asyncio
async def test_risk_assessment_agent_contract():
    agent = RiskAssessmentAgent()
    res = await agent.execute()
    assert_conforming_agent_result(res, "RiskAssessmentAgent")


@pytest.mark.asyncio
async def test_visualization_agent_contract():
    agent = VisualizationAgent()
    res = await agent.execute(user_coords={"lat": 12.87, "lon": 74.84})
    assert_conforming_agent_result(res, "VisualizationAgent")


@pytest.mark.asyncio
async def test_reporting_agent_contract():
    agent = ReportingAgent()
    res = await agent.execute(query="Can I fish near Mangalore?", location_name="Mangalore")
    assert_conforming_agent_result(res, "ReportingAgent")


@pytest.mark.asyncio
async def test_all_agents_resilience_under_empty_or_invalid_inputs():
    """Verify that every agent handles empty/None/invalid inputs without throwing unhandled exceptions."""
    agents = [
        (UserInteractionAgent(), lambda a: a.execute(text=None)),
        (PlanningAgent(), lambda a: a.execute(query="")),
        (MarineDataDiscoveryAgent(), lambda a: a.execute(location=None)),
        (WeatherIntelligenceAgent(), lambda a: a.execute(weather_data={})),
        (OceanAnalyticsAgent(), lambda a: a.execute(pfz_bulletins=[])),
        (GeospatialReasoningAgent(), lambda a: a.execute(user_coords=None)),
        (RiskAssessmentAgent(), lambda a: a.execute(weather_result=None)),
        (VisualizationAgent(), lambda a: a.execute(user_coords=None)),
        (ReportingAgent(), lambda a: a.execute(query="", location_name="")),
    ]

    for agent_inst, call_fn in agents:
        res = await call_fn(agent_inst)
        assert_conforming_agent_result(res, agent_inst.name)
        assert res.status in ["success", "partial", "error"]
