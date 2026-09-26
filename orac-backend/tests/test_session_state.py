"""Tests for Improvement 2: Multi-Turn Session State."""
import pytest
from app.orchestration.planner import planning_agent
from app.orchestration.state import session_store
from app.agents.user_interaction import user_interaction_agent
from app.models.schemas import QueryRequest


@pytest.fixture(autouse=True)
def clean_session_store():
    """Ensure a clean session store before each test."""
    session_store.clear()
    yield
    session_store.clear()


@pytest.mark.asyncio
async def test_a_first_query_establishes_context():
    """Test A: First query initializes session context and records location, temporal, and intent."""
    sess_id = "test_sess_alpha"
    state = await planning_agent.run_pipeline(
        query="Is it safe to fish near Karwar today?",
        session_id=sess_id
    )

    assert state.session_id == sess_id
    assert "Karwar" in state.location_name
    assert state.location_coords is not None

    stored = session_store.get_session(sess_id)
    assert stored is not None
    assert stored.session_id == sess_id
    assert "Karwar" in stored.location_name
    assert stored.turn_count == 1


@pytest.mark.asyncio
async def test_b_follow_up_inherits_location():
    """Test B: Query 1 establishes location; Query 2 'What about tomorrow?' inherits previous location."""
    sess_id = "test_sess_inherit_loc"

    # Turn 1: Establish Karwar
    turn1 = await planning_agent.run_pipeline(
        query="Is it safe near Karwar right now?",
        session_id=sess_id
    )
    assert "Karwar" in turn1.location_name
    karwar_coords = turn1.location_coords

    # Turn 2: Follow-up without explicit location
    turn2 = await planning_agent.run_pipeline(
        query="What about tomorrow morning?",
        session_id=sess_id
    )
    # MUST inherit Karwar!
    assert "Karwar" in turn2.location_name
    assert turn2.location_coords == karwar_coords
    assert turn2.target_time == "tomorrow morning"

    stored = session_store.get_session(sess_id)
    assert stored.turn_count == 2


@pytest.mark.asyncio
async def test_c_follow_up_inherits_temporal_context():
    """Test C: Follow-up without explicit temporal expression inherits previous temporal context."""
    sess_id = "test_sess_inherit_time"

    # Turn 1: Ask about tomorrow afternoon
    turn1 = await planning_agent.run_pipeline(
        query="Is it safe near Karwar tomorrow afternoon?",
        session_id=sess_id
    )
    assert turn1.target_time == "tomorrow afternoon"

    # Turn 2: Ask general question in same session
    turn2 = await planning_agent.run_pipeline(
        query="How is the wave height?",
        session_id=sess_id
    )
    # Inherits Karwar location and previous temporal target
    assert "Karwar" in turn2.location_name
    assert turn2.target_time == "tomorrow afternoon"


@pytest.mark.asyncio
async def test_d_explicit_new_location_overrides_old():
    """Test D: Query 1 establishes Karwar; Query 2 explicitly asks about Mangalore -> Mangalore MUST override."""
    sess_id = "test_sess_override_loc"

    # Turn 1: Karwar
    turn1 = await planning_agent.run_pipeline(
        query="Is it safe near Karwar today?",
        session_id=sess_id
    )
    assert "Karwar" in turn1.location_name

    # Turn 2: Explicitly switch to Mangalore
    turn2 = await planning_agent.run_pipeline(
        query="What about Mangalore tomorrow?",
        session_id=sess_id
    )
    assert "Mangalore" in turn2.location_name
    assert turn2.location_name != turn1.location_name
    assert turn2.location_coords["lat"] == pytest.approx(12.87, abs=0.1)

    stored = session_store.get_session(sess_id)
    assert "Mangalore" in stored.location_name


@pytest.mark.asyncio
async def test_e_explicit_new_date_overrides_old():
    """Test E: Query 1 asks about today; Query 2 asks about tomorrow -> tomorrow MUST override."""
    sess_id = "test_sess_override_date"

    # Turn 1: Today
    turn1 = await planning_agent.run_pipeline(
        query="Is it safe near Karwar now?",
        session_id=sess_id
    )
    assert turn1.target_time == "now"

    # Turn 2: Tomorrow morning
    turn2 = await planning_agent.run_pipeline(
        query="What about tomorrow morning?",
        session_id=sess_id
    )
    assert turn2.target_time == "tomorrow morning"
    assert turn2.time_range["label"] == "Tomorrow Morning"


@pytest.mark.asyncio
async def test_f_new_session_has_no_previous_context():
    """Test F: A fresh uninitialized session does not inherit stale context from prior queries."""
    state = await planning_agent.run_pipeline(
        query="What about tomorrow?",
        session_id="brand_new_session_123"
    )
    # Without prior context, defaults safely to Mangalore baseline
    assert "Mangalore" in state.location_name


@pytest.mark.asyncio
async def test_g_session_isolation():
    """Test G: Session A context NEVER leaks to Session B."""
    sess_a = "session_alpha_karwar"
    sess_b = "session_beta_kochi"

    # Session A: Karwar
    await planning_agent.run_pipeline(
        query="Is fishing safe near Karwar today?",
        session_id=sess_a
    )

    # Session B: Kochi
    await planning_agent.run_pipeline(
        query="Is fishing safe near Kochi today?",
        session_id=sess_b
    )

    # Follow-up in Session A
    follow_a = await planning_agent.run_pipeline(
        query="What about tomorrow?",
        session_id=sess_a
    )
    # Follow-up in Session B
    follow_b = await planning_agent.run_pipeline(
        query="What about tomorrow?",
        session_id=sess_b
    )

    assert "Karwar" in follow_a.location_name
    assert "Kochi" in follow_b.location_name
    assert follow_a.location_name != follow_b.location_name


@pytest.mark.asyncio
async def test_h_agent_traces_retain_resolved_context():
    """Test H: Completed agent traces within the session state reflect the resolved inherited context."""
    sess_id = "test_sess_traces"

    # Turn 1
    await planning_agent.run_pipeline(
        query="Is it safe near Karwar today?",
        session_id=sess_id
    )

    # Turn 2
    state2 = await planning_agent.run_pipeline(
        query="What about tomorrow morning?",
        session_id=sess_id
    )

    # Verify that Weather and Geospatial traces in state2 reflect Karwar and tomorrow morning
    traces = state2.agent_results
    assert "WeatherIntelligenceAgent" in traces
    assert "GeospatialReasoningAgent" in traces

    geo_trace = traces["GeospatialReasoningAgent"]
    assert "Karwar" in geo_trace.result.get("nearest_restricted_zone", "")

    weather_trace = traces["WeatherIntelligenceAgent"]
    assert weather_trace.time_range["label"] == "Tomorrow Morning"
