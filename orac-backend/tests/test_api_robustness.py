import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_api_health_endpoint():
    """Test A: Health endpoint returns 200 with complete status, agents count, and uptime."""
    resp = client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "healthy"
    assert data["agents_registered"] == 9
    assert "version" in data
    assert "uptime_seconds" in data
    assert isinstance(data["uptime_seconds"], (int, float))
    assert "services" in data


def test_api_empty_query_validation_error():
    """Test B: Empty query text returns 422 validation error."""
    resp = client.post("/query", json={"text": ""})
    assert resp.status_code == 422


def test_api_invalid_user_type_validation_error():
    """Test C: Query with invalid user_type returns 422."""
    resp = client.post("/query", json={
        "text": "Is it safe near Karwar?",
        "user_type": "submarine_nuclear_vessel"  # Invalid
    })
    assert resp.status_code == 422


def test_api_out_of_range_coordinates_validation_error():
    """Test D: Query with out-of-range coordinates returns 422."""
    # Latitude > 90
    resp = client.post("/query", json={
        "text": "Weather check",
        "location": {"lat": 195.0, "lon": 74.0}
    })
    assert resp.status_code == 422

    # Longitude > 180
    resp2 = client.post("/query", json={
        "text": "Weather check",
        "location": {"lat": 15.0, "lon": 250.0}
    })
    assert resp2.status_code == 422


def test_api_excessive_query_length_validation_error():
    """Test H: Query exceeding 2000 characters returns 422."""
    long_text = "ocean " * 450  # ~2700 chars
    resp = client.post("/query", json={"text": long_text})
    assert resp.status_code == 422


def test_api_zones_endpoint():
    """Test G: /zones endpoint returns list of restricted marine zones."""
    resp = client.get("/zones")
    assert resp.status_code == 200
    data = resp.json()
    assert "restricted_marine_zones" in data
    assert len(data["restricted_marine_zones"]) >= 4


def test_api_pipeline_resilience_under_all_external_api_failures():
    """Test E: Pipeline completes and returns 200 even when Open-Meteo, Bhashini, and Claude all fail."""
    with patch("app.integrations.weather_client.weather_client._fetch_atmospheric_forecast", return_value=None), \
         patch("app.integrations.weather_client.weather_client._fetch_marine_waves", return_value=None), \
         patch("app.integrations.bhashini_client.bhashini_client._call_bhashini_nmt", side_effect=Exception("Bhashini Down")), \
         patch("app.integrations.claude_client.claude_client.client", None):

        resp = client.post("/query", json={
            "text": "Can I sail from Karwar tomorrow morning?",
            "user_type": "app"
        })

        assert resp.status_code == 200
        data = resp.json()
        assert data["verdict"] in ["SAFE", "CAUTION", "UNSAFE"]
        assert len(data["report"]) > 0
        assert data["visualization"] is not None
        assert len(data["agent_traces"]) == 9


def test_api_response_schema_conformance():
    """Test F: Response contains all required top-level fields."""
    with patch("app.integrations.weather_client.weather_client._fetch_atmospheric_forecast", return_value=None), \
         patch("app.integrations.weather_client.weather_client._fetch_marine_waves", return_value=None):

        resp = client.post("/query", json={"text": "Is it safe to sail from Mangalore?"})
        assert resp.status_code == 200
        data = resp.json()

        required_fields = [
            "query_id", "timestamp", "user_type", "original_query",
            "detected_language", "translated_query", "verdict",
            "safety_summary", "report", "dissemination_channel",
            "dispatched_payload", "visualization", "agent_traces"
        ]
        for field in required_fields:
            assert field in data, f"Response missing required field: {field}"
        assert data["verdict"] in ["SAFE", "CAUTION", "UNSAFE"]
        assert len(data["agent_traces"]) == 9
