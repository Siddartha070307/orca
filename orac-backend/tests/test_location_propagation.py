"""Regression tests for location propagation and multi-turn session location handling."""
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.integrations.claude_client import ClaudeClient, _get_coastal_sectors_registry

client = TestClient(app)


def test_coastal_registry_coverage():
    """Verify COASTAL_SECTORS registry covers key coastal states and ports."""
    reg = _get_coastal_sectors_registry()
    assert "andhra pradesh" in reg
    assert "kerala" in reg
    assert "tamil nadu" in reg
    assert "karnataka" in reg
    assert "goa" in reg
    assert "maharashtra" in reg
    assert "gujarat" in reg
    assert "odisha" in reg
    assert "west bengal" in reg

    assert "kochi" in reg
    assert "visakhapatnam" in reg
    assert "kakinada" in reg
    assert "chennai" in reg
    assert "mangalore" in reg


def test_fallback_intent_parser_locations():
    """Verify fallback parser resolves coastal sectors, states, and non-coastal inputs."""
    parser = ClaudeClient()

    # Coastal ports
    kochi_res = parser._fallback_intent_parser("Can I sail from Kochi today?", None)
    assert kochi_res["has_explicit_location"] is True
    assert kochi_res["location_name"] == "Kochi"
    assert kochi_res["coordinates"]["lat"] == 9.93

    # Coastal states
    ap_res = parser._fallback_intent_parser("Find good fishing spots near Andhra Pradesh", None)
    assert ap_res["has_explicit_location"] is True
    assert ap_res["location_name"] == "Andhra Pradesh"
    assert ap_res["coordinates"]["lat"] == 16.99

    vizag_res = parser._fallback_intent_parser("Can I sail from Visakhapatnam today?", None)
    assert vizag_res["has_explicit_location"] is True
    assert vizag_res["location_name"] == "Visakhapatnam"

    chennai_res = parser._fallback_intent_parser("Weather in Chennai tomorrow", None)
    assert chennai_res["has_explicit_location"] is True
    assert chennai_res["location_name"] == "Chennai"

    # Non-coastal / inland location
    delhi_res = parser._fallback_intent_parser("Can I sail from Delhi today?", None)
    assert delhi_res["has_explicit_location"] is True
    assert delhi_res["location_name"] == "Delhi"
    assert delhi_res["coordinates"] is None

    # No location
    none_res = parser._fallback_intent_parser("What about tomorrow?", None)
    assert none_res["has_explicit_location"] is False
    assert none_res["location_name"] is None


def test_kochi_query_propagates_correctly():
    """Verify query for Kochi resolves to Kochi across report, traces, and top-level response."""
    resp = client.post("/query", json={"text": "Can I sail from Kochi today?"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["location_name"] == "Kochi"
    assert "KOCHI" in data["report"].upper()
    planning_trace = next(t for t in data["agent_traces"] if t["agent"] == "PlanningAgent")
    assert planning_trace["result"]["location_name"] == "Kochi"
    assert planning_trace["result"]["coordinates"]["lat"] == 9.93


def test_andhra_pradesh_query_does_not_become_kochi():
    """Verify query for Andhra Pradesh resolves to Andhra Pradesh and NEVER Kochi."""
    resp = client.post("/query", json={"text": "Find good fishing spots near Andhra Pradesh"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["location_name"] == "Andhra Pradesh"
    assert "ANDHRA PRADESH" in data["report"].upper()
    assert "KOCHI" not in data["report"].upper()
    planning_trace = next(t for t in data["agent_traces"] if t["agent"] == "PlanningAgent")
    assert planning_trace["result"]["location_name"] == "Andhra Pradesh"
    assert planning_trace["result"]["coordinates"]["lat"] == 16.99


def test_visakhapatnam_query_propagates():
    """Verify Visakhapatnam query resolves properly."""
    resp = client.post("/query", json={"text": "Can I sail from Visakhapatnam today?"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["location_name"] == "Visakhapatnam"
    assert "VISAKHAPATNAM" in data["report"].upper()
    assert "KOCHI" not in data["report"].upper()


def test_multi_turn_session_location_override():
    """Verify multi-turn session properly retains location on follow-up, but overrides when new location given."""
    session_id = "test_sess_location_override_001"

    # Turn 1: Kochi
    r1 = client.post("/query", json={
        "text": "Can I sail from Kochi today?",
        "session_id": session_id
    })
    assert r1.status_code == 200
    d1 = r1.json()
    assert d1["location_name"] == "Kochi"

    # Turn 2: Follow-up without location -> should retain Kochi
    r2 = client.post("/query", json={
        "text": "What about tomorrow?",
        "session_id": session_id
    })
    assert r2.status_code == 200
    d2 = r2.json()
    assert d2["location_name"] == "Kochi"
    assert "KOCHI" in d2["report"].upper()

    # Turn 3: Follow-up with explicit new location Andhra Pradesh -> MUST OVERRIDE Kochi!
    r3 = client.post("/query", json={
        "text": "Find good fishing spots near Andhra Pradesh",
        "session_id": session_id
    })
    assert r3.status_code == 200
    d3 = r3.json()
    assert d3["location_name"] == "Andhra Pradesh"
    assert "ANDHRA PRADESH" in d3["report"].upper()
    assert "KOCHI" not in d3["report"].upper()

    # Turn 4: Follow-up with Visakhapatnam -> MUST OVERRIDE Andhra Pradesh!
    r4 = client.post("/query", json={
        "text": "What about Visakhapatnam?",
        "session_id": session_id
    })
    assert r4.status_code == 200
    d4 = r4.json()
    assert d4["location_name"] == "Visakhapatnam"
    assert "VISAKHAPATNAM" in d4["report"].upper()
    assert "KOCHI" not in d4["report"].upper()


def test_unrecognized_location_no_silent_substitution():
    """Verify inland/unrecognized location does not silently substitute Mangalore or Kochi."""
    resp = client.post("/query", json={"text": "Can I sail from Delhi today?"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["location_name"] == "Delhi"
    planning_trace = next(t for t in data["agent_traces"] if t["agent"] == "PlanningAgent")
    assert planning_trace["result"]["location_name"] == "Delhi"
    assert planning_trace["result"]["coordinates"] is None
    # Report should explicitly state Delhi and not Kochi or Mangalore
    assert "DELHI" in data["report"].upper()
    assert "MANGALORE" not in data["report"].upper()
    assert "KOCHI" not in data["report"].upper()
