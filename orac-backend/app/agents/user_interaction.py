"""User Interaction Agent.

Entry and exit gateway for ORCA:
- Ingress: Ingests raw multi-lingual query, invokes Bhashini to detect language and translate to English.
- Pipeline Delegation: Forwards query to Planning Agent orchestrator.
- Egress: Receives Reporting & Visualization payloads, translates answer back to native Indian language,
  and packages final QueryResponse.
"""
import logging
import time
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from app.models.schemas import QueryRequest, QueryResponse, AgentResult
from app.integrations.bhashini_client import bhashini_client
from app.orchestration.planner import planning_agent
from app.core.temporal import parse_iso_datetime

logger = logging.getLogger(__name__)


class UserInteractionAgent:
    """Agent managing multi-lingual ingress translation, session lifecycle, and egress response packaging."""

    name = "UserInteractionAgent"

    async def execute(
        self,
        request: Optional[QueryRequest] = None,
        text: Optional[str] = None,
        language: Optional[str] = None,
        location: Optional[Dict[str, float]] = None,
        user_type: str = "app"
    ) -> AgentResult:
        """Executes ingress language processing and returns an AgentResult."""
        now_iso = datetime.now(timezone.utc).isoformat()
        try:
            query_text = (request.text if request else text) or ""
            target_lang = (request.language if request else language)
            u_type = (request.user_type if request else user_type)
            coords = None
            if request and request.location:
                coords = {"lat": request.location.lat, "lon": request.location.lon}
            elif location:
                coords = location

            detected_lang, translated_text = await bhashini_client.detect_and_translate_to_english(
                text=query_text,
                user_specified_lang=target_lang
            )
            return AgentResult(
                agent=self.name,
                status="success",
                location=coords,
                time_range={"start": now_iso, "end": now_iso},
                result={
                    "original_query": query_text,
                    "detected_language": detected_lang,
                    "translated_query": translated_text,
                    "user_type": u_type,
                    "pipeline_stage": "ingress_complete"
                },
                confidence=0.99,
                sources=[{"name": "Bhashini ULCA / Language Gateway", "timestamp": now_iso}],
                warnings=[]
            )
        except Exception as e:
            return AgentResult(
                agent=self.name,
                status="error",
                location=None,
                time_range={"start": now_iso, "end": now_iso},
                result={"error": str(e)},
                confidence=0.0,
                sources=[{"name": "Bhashini ULCA / Language Gateway", "timestamp": now_iso}],
                warnings=[f"Ingress translation failed: {str(e)}"]
            )

    async def handle_query(self, request: QueryRequest) -> QueryResponse:
        t0 = time.time()
        # 1. Ingress Language Detection & Translation via execute()
        ingress_trace = await self.execute(request=request)
        detected_lang = ingress_trace.result.get("detected_language", "en")
        translated_english_text = ingress_trace.result.get("translated_query", request.text)
        logger.info(f"Ingress query: '{request.text}' | Detected Lang: {detected_lang} | English: '{translated_english_text}'")

        explicit_coords = ingress_trace.location

        ref_time = None
        if request and request.timestamp:
            try:
                ref_time = parse_iso_datetime(request.timestamp)
            except Exception as e:
                logger.warning(f"Failed to parse request timestamp '{request.timestamp}': {e}")

        # 2. Hand off to Planning Agent Orchestrator
        session_state = await planning_agent.run_pipeline(
            query=translated_english_text,
            user_type=request.user_type,
            explicit_location=explicit_coords,
            detected_language=detected_lang,
            session_id=request.session_id,
            reference_time=ref_time
        )

        # Prepend the UserInteraction ingress trace
        all_traces = [ingress_trace] + session_state.get_ordered_traces()

        # 4. Egress Translation if detected language is not English
        final_report = session_state.final_report
        final_summary = session_state.safety_summary
        translation_status = "original" if detected_lang == "en" else "translated"

        if detected_lang != "en":
            try:
                translated_report, report_status = await bhashini_client.translate_from_english_with_status(
                    text=final_report,
                    target_lang=detected_lang
                )
                if translated_report:
                    final_report = translated_report
                if report_status == "fallback_en":
                    translation_status = "fallback_en"

                translated_sum, sum_status = await bhashini_client.translate_from_english_with_status(
                    text=final_summary,
                    target_lang=detected_lang
                )
                if translated_sum:
                    final_summary = translated_sum
            except Exception as e:
                logger.warning(f"Egress translation to {detected_lang} failed: {e}")
                translation_status = "fallback_en"

        # 5. Assemble and return final QueryResponse
        response = QueryResponse(
            query_id=session_state.query_id,
            session_id=session_state.session_id,
            timestamp=session_state.created_at,
            user_type=session_state.user_type,
            original_query=request.text,
            detected_language=detected_lang,
            translated_query=translated_english_text,
            location_name=session_state.location_name,
            verdict=session_state.final_verdict,
            safety_summary=final_summary,
            report=final_report,
            dissemination_channel=session_state.dispatched_payload.channel if session_state.dispatched_payload else "app",
            dispatched_payload=session_state.dispatched_payload,
            visualization=session_state.visualization,
            agent_traces=all_traces,
            time_range=session_state.time_range,
            translation_status=translation_status
        )

        elapsed_ms = round((time.time() - t0) * 1000, 1)
        logger.info(f"Query {response.query_id} completed in {elapsed_ms}ms | Verdict: {response.verdict} | Channel: {response.dissemination_channel}")

        return response


user_interaction_agent = UserInteractionAgent()
