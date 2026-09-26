"""Unit and integration tests for ORCA Full Localization and Multi-Modal features.

Covers:
1. Translation fallback chain (Bhashini -> Claude -> fallback_en).
2. Expanded coastal coverage (Kakinada lookup, approximate sector distance).
3. Backend Text-to-Speech (gTTS synthesis, supported languages, fallback checks).
4. Localized PDF export (ReportLab generation, vector mini-map canvas, Indic text).
5. Endpoints: /tts, /export-pdf, and /health diagnostic updates.
"""
import io
import pytest
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient

from app.main import app
from app.integrations.bhashini_client import bhashini_client
from app.integrations.claude_client import claude_client
from app.integrations.incois_mock import incois_provider
from app.integrations.tts_client import tts_provider
from app.integrations.pdf_generator import generate_marine_advisory_pdf

client = TestClient(app)


# ----------------------------------------------------
# 1. Translation Fallback Chain Tests
# ----------------------------------------------------
@pytest.mark.asyncio
async def test_bhashini_fallback_to_claude():
    """Test that when Bhashini has no credentials or fails, it calls Claude translation."""
    with patch.object(bhashini_client, "_call_bhashini_nmt", side_effect=Exception("Bhashini timeout")), \
         patch.object(claude_client, "translate_text", new_callable=AsyncMock, return_value="सुरक्षित समुद्री स्थिति"):

        translated, status = await bhashini_client.translate_from_english_with_status(
            text="Safe sea conditions",
            target_lang="hi"
        )
        assert status == "translated"
        assert translated == "सुरक्षित समुद्री स्थिति"


@pytest.mark.asyncio
async def test_bhashini_fallback_to_english_when_all_fail():
    """Test that when both Bhashini and Claude fail, it returns English with fallback_en status."""
    with patch.object(bhashini_client, "_call_bhashini_nmt", side_effect=Exception("Bhashini down")), \
         patch.object(claude_client, "translate_text", new_callable=AsyncMock, return_value=None):

        translated, status = await bhashini_client.translate_from_english_with_status(
            text="Dangerous rough waves near coast",
            target_lang="te"
        )
        assert status == "fallback_en"
        assert translated == "Dangerous rough waves near coast"


@pytest.mark.asyncio
async def test_ingress_detect_and_translate_with_claude_fallback():
    """Test ingress query translation falls back to Claude when Bhashini is down."""
    with patch.object(bhashini_client, "_call_bhashini_nmt", side_effect=Exception("Bhashini down")), \
         patch.object(claude_client, "translate_text", new_callable=AsyncMock, return_value="Can I fish near Mangalore today?"):

        lang, translated = await bhashini_client.detect_and_translate_to_english(
            text="ఈ రోజు మంగళూరు సమీపంలో చేపల వేటకు వెళ్లవచ్చా?",
            user_specified_lang="te"
        )
        assert lang == "te"
        assert translated == "Can I fish near Mangalore today?"


# ----------------------------------------------------
# 2. Coastal Coverage & Kakinada Tests
# ----------------------------------------------------
def test_kakinada_sector_and_coordinates_coverage():
    """Test that Kakinada (approx 16.99°N, 82.24°E) is recognized and returns genuine Kakinada PFZ."""
    advisories = incois_provider.get_pfz_advisories(lat=16.99, lon=82.24)
    assert len(advisories) > 0
    kakinada_pfz = advisories[0]
    assert kakinada_pfz["id"] == "PFZ-KAK-01"
    assert kakinada_pfz["sector"] == "Kakinada"
    assert kakinada_pfz["state"] == "Andhra Pradesh"
    assert kakinada_pfz["sector_match_distance_km"] == 0.0


def test_sector_distance_approximation_disclosure():
    """Test that coordinates > 40km away disclose approximate sector with distance."""
    # Point ~55 km from Kakinada
    advisories = incois_provider.get_pfz_advisories(lat=17.48, lon=82.24)
    assert len(advisories) > 0
    first = advisories[0]
    assert "approximate" in first["sector"]
    assert first["sector_match_distance_km"] > 40.0


# ----------------------------------------------------
# 3. Text-to-Speech (gTTS) Tests
# ----------------------------------------------------
def test_tts_language_support_checks():
    """Test that supported 10 Indic languages return True and Odia/Assamese return False for fallback."""
    for lang in ["en", "hi", "ta", "te", "kn", "ml", "mr", "bn", "gu", "pa"]:
        assert tts_provider.is_language_supported(lang) is True

    # Odia and Assamese must return False so client uses browser TTS
    assert tts_provider.is_language_supported("or") is False
    assert tts_provider.is_language_supported("as") is False


def test_tts_audio_endpoint():
    """Test GET /tts synthesizes MP3 audio stream."""
    with patch.object(tts_provider, "synthesize_speech", return_value=b"ID3" + b"\x00" * 1500):
        resp = client.get("/tts?text=ORCA+Marine+Advisory+Test&language=en")
        assert resp.status_code == 200
        assert resp.headers["content-type"] == "audio/mpeg"
        assert len(resp.content) > 1000


def test_tts_unsupported_language_returns_404():
    """Test GET /tts with unsupported language returns 404 prompting client fallback."""
    resp = client.get("/tts?text=Testing+Odia&language=or")
    assert resp.status_code == 404
    assert "fallback" in resp.json()["detail"].lower()


def test_gtts_provider_live_synthesis():
    """Test GTTSProvider real synthesis when gTTS library is available."""
    audio = tts_provider.synthesize_speech("ORCA Marine Intelligence Advisory", "en")
    assert audio is not None
    assert len(audio) > 1000
    assert audio[:2] in (b"\xff\xfb", b"\xff\xf3", b"\xff\xf2") or audio[:3] == b"ID3"


def test_tts_endpoint_live():
    """Test GET /tts live endpoint returns 200 with audio/mpeg content."""
    resp = client.get("/tts?text=ORCA+Live+Test&language=en")
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "audio/mpeg"
    assert len(resp.content) > 1000
    assert resp.content[:2] in (b"\xff\xfb", b"\xff\xf3", b"\xff\xf2") or resp.content[:3] == b"ID3"


# ----------------------------------------------------
# 4. Localized PDF Export Tests
# ----------------------------------------------------
def test_pdf_generator_creates_valid_pdf():
    """Test generate_marine_advisory_pdf returns valid PDF document bytes."""
    pdf_bytes = generate_marine_advisory_pdf(
        query_id="ORCA-TEST-PDF-99",
        verdict="CAUTION",
        safety_summary="Marginal conditions detected near port.",
        report_text="**CAUTION ADVISED** Wind gusts up to 28 km/h.",
        location_name="Kakinada",
        coordinates={"lat": 16.99, "lon": 82.24},
        weather_metrics={"wind_speed_kmh": 22.0, "wave_height_m": 1.8},
        pfz_recommendation={"id": "PFZ-KAK-01", "distance_km": 31.0, "bearing_deg": 110, "lat": 16.92, "lon": 82.52},
        geospatial_info={"status_description": "Clear of naval perimeters"},
        language="te"
    )
    assert isinstance(pdf_bytes, bytes)
    assert len(pdf_bytes) > 4000
    assert pdf_bytes.startswith(b"%PDF-")


def test_pdf_export_endpoint():
    """Test POST /export-pdf returns downloadable PDF response."""
    payload = {
        "query_id": "ORCA-TEST-API",
        "language": "hi",
        "verdict": "SAFE",
        "safety_summary": "अनुकूल समुद्री स्थितियां",
        "report_text": "सभी नौकाओं के लिए सुरक्षित परिचालन स्थितियां।",
        "location_name": "Porbandar",
        "coordinates": {"lat": 21.64, "lon": 69.62}
    }
    resp = client.post("/export-pdf", json=payload)
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/pdf"
    assert "attachment" in resp.headers["content-disposition"]
    assert resp.content.startswith(b"%PDF-")


def test_health_check_reports_new_subsystems():
    """Test GET /health includes tts_engine and pdf_engine services."""
    resp = client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert "tts_engine" in data["services"]
    assert "pdf_engine" in data["services"]
    assert "ocean_analytics" in data["services"]
