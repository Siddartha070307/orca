"""FastAPI route handlers for ORCA."""
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.models.schemas import QueryRequest, QueryResponse, HealthResponse
from app.models.db import get_db, QueryRecord
from app.agents.user_interaction import user_interaction_agent
from app.agents.geospatial_reasoning import RESTRICTED_ZONES
from app.integrations.incois_mock import incois_provider
from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/query", response_model=QueryResponse, status_code=status.HTTP_200_OK)
async def process_query(request: QueryRequest, db: Session = Depends(get_db)):
    """Primary endpoint routing user queries through the 9-agent marine pipeline."""
    try:
        response = await user_interaction_agent.handle_query(request)

        # Asynchronously log query record into SQLite database
        try:
            db_record = QueryRecord(
                id=response.query_id,
                user_type=response.user_type,
                original_query=response.original_query,
                detected_language=response.detected_language,
                latitude=request.location.lat if request.location else None,
                longitude=request.location.lon if request.location else None,
                verdict=response.verdict,
                report=response.report,
                dissemination_channel=response.dissemination_channel,
                dispatched_content=str(response.dispatched_payload.content) if response.dispatched_payload else None,
                agent_traces_json=[t.model_dump() for t in response.agent_traces]
            )
            db.add(db_record)
            db.commit()
        except Exception as db_err:
            logger.warning(f"Failed to log query into SQLite: {db_err}")
            db.rollback()

        return response
    except Exception as e:
        logger.error(f"Pipeline error processing query: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"ORCA Pipeline Error: {str(e)}"
        )


import time
import io
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel, Field
from typing import Dict, Any, Optional
from app.integrations.tts_client import tts_provider
from app.integrations.pdf_generator import generate_marine_advisory_pdf

START_TIME = time.time()


class PdfExportRequest(BaseModel):
    query_id: str
    language: str = "en"
    verdict: Optional[str] = "SAFE"
    safety_summary: Optional[str] = ""
    report: Optional[str] = ""
    location_name: Optional[str] = "Coastal Sector"
    coordinates: Optional[Dict[str, float]] = None
    weather_metrics: Optional[Dict[str, Any]] = None
    pfz_recommendation: Optional[Dict[str, Any]] = None
    geospatial_info: Optional[Dict[str, Any]] = None
    timestamp: Optional[str] = None


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """System liveness and integration readiness diagnostic check."""
    return HealthResponse(
        status="healthy",
        version=settings.APP_VERSION,
        agents_registered=9,
        uptime_seconds=round(time.time() - START_TIME, 2),
        services={
            "weather_intelligence": "Open-Meteo Live API Ready",
            "ocean_analytics": "INCOIS Mock PFZ Engine Active (30+ Sectors)",
            "geospatial_reasoning": "Shapely Geofencing Active",
            "language_engine": "Bhashini ULCA / Claude Resilient Fallback Ready",
            "tts_engine": "Google Translate TTS (gTTS) Active",
            "pdf_engine": "ReportLab Localized Vector PDF Generator Active",
            "llm_engine": "Anthropic Claude / Resilient Fallback Active",
            "dissemination_router": "Multi-Channel Disseminator Active (App/SMS/NAVIC)"
        }
    )


@router.get("/zones")
async def get_restricted_zones():
    """Returns catalog of protected marine sanctuaries and naval perimeters."""
    return {"restricted_marine_zones": RESTRICTED_ZONES}


@router.get("/pfz")
async def get_pfz_feed(lat: float = 12.87, lon: float = 74.84, sector: str = None):
    """Direct lookup for INCOIS PFZ bulletins."""
    advisories = incois_provider.get_pfz_advisories(lat=lat, lon=lon, sector_name=sector)
    return {"sector": sector or "nearest", "advisories": advisories}


@router.get("/tts")
async def get_text_to_speech(text: str, language: str = "en"):
    """Synthesizes speech audio (MP3) for supported languages using backend gTTS."""
    if not text or not text.strip():
        raise HTTPException(status_code=400, detail="Text parameter is required for TTS")

    if not tts_provider.is_language_supported(language):
        raise HTTPException(
            status_code=404,
            detail=f"Language '{language}' is not supported by backend TTS (use browser speech synthesis fallback)."
        )

    audio_bytes = tts_provider.synthesize_speech(text=text, language=language)
    if not audio_bytes:
        raise HTTPException(status_code=500, detail="TTS synthesis failed")

    return StreamingResponse(
        io.BytesIO(audio_bytes),
        media_type="audio/mpeg",
        headers={"Content-Disposition": f'inline; filename="orca_tts_{language}.mp3"'}
    )


@router.post("/export-pdf")
async def export_advisory_pdf(req: PdfExportRequest, db: Session = Depends(get_db)):
    """Generates a downloadable, localized PDF marine advisory report with custom vector mini-map."""
    try:
        report = req.report
        verdict = req.verdict
        summary = req.safety_summary
        coords = req.coordinates or {"lat": 12.87, "lon": 74.84}
        loc_name = req.location_name or "Coastal Sector"
        weather_metrics = req.weather_metrics or {"wind_speed_kmh": "N/A", "wave_height_m": "N/A"}
        pfz_rec = req.pfz_recommendation
        geo_info = req.geospatial_info or {"status_description": "Clear of restricted zones"}

        if not report or report == "":
            record = db.query(QueryRecord).filter(QueryRecord.id == req.query_id).first()
            if record:
                report = record.report
                verdict = record.verdict
                if record.latitude and record.longitude:
                    coords = {"lat": record.latitude, "lon": record.longitude}

        pdf_bytes = generate_marine_advisory_pdf(
            query_id=req.query_id,
            verdict=verdict or "SAFE",
            safety_summary=summary or "",
            report_text=report or "",
            location_name=loc_name,
            coordinates=coords,
            weather_metrics=weather_metrics,
            pfz_recommendation=pfz_rec,
            geospatial_info=geo_info,
            language=req.language,
            timestamp=req.timestamp
        )

        filename = f"ORCA_Advisory_{req.query_id}_{req.language}.pdf"
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Access-Control-Expose-Headers": "Content-Disposition"
            }
        )
    except Exception as e:
        logger.error(f"Failed to generate advisory PDF: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"PDF Generation Error: {str(e)}"
        )
