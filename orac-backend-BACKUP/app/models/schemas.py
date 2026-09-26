"""Data schemas and Agent Message Contract for ORCA."""
from typing import Literal, Optional, List, Dict, Any
from pydantic import BaseModel, Field


# ----------------------------------------------------
# Standard Agent Message Contract (Specified in Brief)
# ----------------------------------------------------
class AgentResult(BaseModel):
    agent: str
    status: Literal["success", "partial", "error"]
    location: Optional[Dict[str, float]] = None        # {"lat": float, "lon": float}
    time_range: Optional[Dict[str, Any]] = None        # {"start": iso8601, "end": iso8601, "label": str}
    result: Dict[str, Any] = Field(default_factory=dict) # agent-specific payload
    confidence: float = 1.0                            # 0.0 - 1.0
    sources: List[Dict[str, Any]] = Field(default_factory=list) # [{"name": str, "timestamp": iso8601}]
    warnings: List[str] = Field(default_factory=list)


# ----------------------------------------------------
# API Request / Response Schemas
# ----------------------------------------------------
class QueryLocation(BaseModel):
    lat: float = Field(..., description="Latitude in decimal degrees", ge=-90.0, le=90.0)
    lon: float = Field(..., description="Longitude in decimal degrees", ge=-180.0, le=180.0)


class QueryRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000, description="Natural language question")
    session_id: Optional[str] = Field(
        default=None,
        description="Optional multi-turn session ID. If omitted, a new session is initialized."
    )
    user_type: Literal["app", "boat_near_shore", "boat_open_sea"] = Field(
        default="app",
        description="Target user profile and transmission tier"
    )
    location: Optional[QueryLocation] = Field(
        default=None,
        description="Optional GPS coordinate of the user. If omitted, parsed from text."
    )
    language: Optional[str] = Field(
        default=None,
        description="Optional language code (e.g. 'hi', 'kn', 'ta', 'en')"
    )
    timestamp: Optional[str] = Field(
        default=None,
        description="Optional ISO 8601 request timestamp for deterministic testing or client clock synchronization"
    )


class DispatchedPayload(BaseModel):
    channel: str
    status: str
    content: Any
    metadata: Dict[str, Any] = Field(default_factory=dict)


class VisualizationPayload(BaseModel):
    geojson: Dict[str, Any] = Field(default_factory=dict)
    charts: Dict[str, Any] = Field(default_factory=dict)
    map_bounds: Optional[List[float]] = None  # [min_lon, min_lat, max_lon, max_lat]


class QueryResponse(BaseModel):
    query_id: str
    session_id: Optional[str] = Field(
        default=None,
        description="Active multi-turn session ID for conversational context tracking."
    )
    timestamp: str
    user_type: str
    original_query: str
    detected_language: str
    translated_query: str
    verdict: str  # SAFE / CAUTION / UNSAFE
    safety_summary: str
    report: str
    dissemination_channel: str
    dispatched_payload: DispatchedPayload
    visualization: VisualizationPayload
    agent_traces: List[AgentResult] = Field(default_factory=list)
    time_range: Optional[Dict[str, Any]] = None  # Evaluated temporal window: {"start": ..., "end": ..., "label": ...}
    translation_status: Optional[str] = Field(
        default="translated",
        description="Translation delivery status: 'translated', 'original', or 'fallback_en'"
    )


class HealthResponse(BaseModel):
    status: str
    version: str
    agents_registered: int
    uptime_seconds: Optional[float] = None
    services: Dict[str, str]
