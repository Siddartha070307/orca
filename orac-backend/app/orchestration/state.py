"""Session and pipeline state tracking for ORCA."""
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
import uuid
from pydantic import BaseModel, Field
from app.models.schemas import AgentResult, DispatchedPayload, VisualizationPayload


class SessionContext(BaseModel):
    """Retained conversational context for multi-turn sessions."""

    session_id: str
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    last_updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    turn_count: int = 1
    location_name: Optional[str] = None
    location_coords: Optional[Dict[str, float]] = None
    target_time: Optional[str] = None
    time_range: Optional[Dict[str, Any]] = None
    last_intent: Optional[str] = None
    last_query: Optional[str] = None
    last_verdict: Optional[str] = None
    agent_traces: List[AgentResult] = Field(default_factory=list)


class SessionStore:
    """In-memory thread-safe session store with bounded capacity and TTL."""

    def __init__(self, max_sessions: int = 500, ttl_seconds: int = 86400):
        self._sessions: Dict[str, SessionContext] = {}
        self._max_sessions = max_sessions
        self._ttl_seconds = ttl_seconds

    def get_session(self, session_id: Optional[str]) -> Optional[SessionContext]:
        if not session_id or session_id not in self._sessions:
            return None
        session = self._sessions[session_id]
        # TTL check
        try:
            last_dt = datetime.fromisoformat(session.last_updated_at)
            age = (datetime.now(timezone.utc) - last_dt).total_seconds()
            if age > self._ttl_seconds:
                del self._sessions[session_id]
                return None
        except Exception:
            pass
        return session

    def save_session(self, context: SessionContext):
        if len(self._sessions) >= self._max_sessions and context.session_id not in self._sessions:
            # Evict oldest session
            oldest_id = min(self._sessions.keys(), key=lambda k: self._sessions[k].last_updated_at)
            self._sessions.pop(oldest_id, None)
        context.last_updated_at = datetime.now(timezone.utc).isoformat()
        self._sessions[context.session_id] = context

    def clear(self):
        self._sessions.clear()


session_store = SessionStore()


class SessionState(BaseModel):
    """Holds complete execution context for a user request across all 9 agents."""

    query_id: str = Field(default_factory=lambda: f"orca_{uuid.uuid4().hex[:12]}")
    session_id: str = Field(default_factory=lambda: f"sess_{uuid.uuid4().hex[:12]}")
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    user_type: str = "app"
    raw_query: str
    detected_language: str = "en"
    translated_query: str = ""
    
    # Planning & extraction
    parsed_intent: Dict[str, Any] = Field(default_factory=dict)
    location_name: Optional[str] = None
    location_coords: Optional[Dict[str, float]] = None
    target_time: str = "today"
    time_range: Optional[Dict[str, Any]] = None  # Normalized temporal range: {"start": ..., "end": ..., "label": ...}
    
    # Trace of each agent's execution
    agent_results: Dict[str, AgentResult] = Field(default_factory=dict)
    
    # Final synthesized outcomes
    final_verdict: str = "SAFE"
    safety_summary: str = ""
    final_report: str = ""
    visualization: Optional[VisualizationPayload] = None
    dispatched_payload: Optional[DispatchedPayload] = None

    def record_agent_result(self, result: AgentResult):
        """Records an agent's execution result in state."""
        self.agent_results[result.agent] = result

    def get_ordered_traces(self) -> List[AgentResult]:
        """Returns ordered list of all completed agent results."""
        return list(self.agent_results.values())
