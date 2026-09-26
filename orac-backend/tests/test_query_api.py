"""End-to-end integration tests for ORCA API endpoints."""
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health_endpoint():
    """Verify system health and agent registry status."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["agents_registered"] == 9
    assert "weather_intelligence" in data["services"]
    assert "llm_engine" in data["services"]


def test_query_app_channel_end_to_end():
    """Verify primary demo path: POST /query with app user type."""
    payload = {
        "text": "Is it safe to fish near Mangalore tomorrow?",
        "user_type": "app",
        "location": {"lat": 12.87, "lon": 74.84}
    }
    response = client.post("/query", json=payload)
    assert response.status_code == 200
    data = response.json()

    # Core response assertions
    assert "query_id" in data
    assert data["verdict"] in ["SAFE", "CAUTION", "UNSAFE"]
    assert data["dissemination_channel"] == "app"
    assert len(data["report"]) > 20
    assert "time_range" in data and data["time_range"] is not None
    assert data["time_range"]["label"] == "Tomorrow"
    assert "start" in data["time_range"] and "end" in data["time_range"]

    # Visualization payload assertions
    viz = data["visualization"]
    assert "geojson" in viz
    assert viz["geojson"]["type"] == "FeatureCollection"
    assert len(viz["geojson"]["features"]) >= 2
    assert "charts" in viz
    assert "wave_series" in viz["charts"]

    # Trace assertions: All 9 agents participated
    traces = data["agent_traces"]
    agent_names = [t["agent"] for t in traces]
    assert "UserInteractionAgent" in agent_names
    assert "PlanningAgent" in agent_names
    assert "MarineDataDiscoveryAgent" in agent_names
    assert "WeatherIntelligenceAgent" in agent_names
    assert "OceanAnalyticsAgent" in agent_names
    assert "GeospatialReasoningAgent" in agent_names
    assert "RiskAssessmentAgent" in agent_names
    assert "VisualizationAgent" in agent_names
    assert "ReportingAgent" in agent_names


def test_query_boat_near_shore_sms():
    """Verify boat_near_shore channel formats and dispatches SMS under 160 chars."""
    payload = {
        "text": "Check fishing safety and nearest PFZ near Kochi",
        "user_type": "boat_near_shore",
        "location": {"lat": 9.93, "lon": 76.26}
    }
    response = client.post("/query", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["dissemination_channel"] == "boat_near_shore"
    dispatched = data["dispatched_payload"]
    assert dispatched["status"] == "DISPATCHED_SMS"
    assert dispatched["metadata"]["char_count"] <= 160
    assert "raw_sms" in dispatched["metadata"]


def test_query_boat_open_sea_satellite():
    """Verify boat_open_sea channel produces simulated NAVIC / MSS satellite packet."""
    payload = {
        "text": "What are the ocean and weather conditions here?",
        "user_type": "boat_open_sea",
        "location": {"lat": 15.0, "lon": 72.5}
    }
    response = client.post("/query", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["dissemination_channel"] == "boat_open_sea"
    dispatched = data["dispatched_payload"]
    assert dispatched["status"] == "DISPATCHED_SATELLITE"
    sat_content = dispatched["content"]
    assert "raw_telegram" in sat_content
    assert sat_content["raw_telegram"].startswith("$ORCA,")


def test_query_multi_lingual_hindi():
    """Verify handling of regional Indian language text."""
    payload = {
        "text": "क्या कल मैंगलोर के पास मछली पकड़ना सुरक्षित है?",
        "user_type": "app"
    }
    response = client.post("/query", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["detected_language"] in ["hi", "en"]
    assert data["verdict"] in ["SAFE", "CAUTION", "UNSAFE"]
