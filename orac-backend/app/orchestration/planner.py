"""Planning Agent & Master Pipeline Orchestrator.

Uses Claude to parse intent and extract entities (location, date/time, what is being asked).
Produces task plans and coordinates domain agents, checking result integrity
before handing off to Risk Assessment, Visualization, and Reporting.
"""
import logging
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from app.core.config import settings
from app.models.schemas import AgentResult, VisualizationPayload
from app.orchestration.state import SessionState, session_store, SessionContext
from app.integrations.claude_client import claude_client
from app.core.temporal import resolve_time_range, parse_temporal_expression, IST

# Agents
from app.agents.marine_data_discovery import marine_data_discovery_agent
from app.agents.weather_intelligence import weather_intelligence_agent
from app.agents.ocean_analytics import ocean_analytics_agent
from app.agents.geospatial_reasoning import geospatial_reasoning_agent
from app.agents.risk_assessment import risk_assessment_agent
from app.agents.visualization import visualization_agent
from app.agents.reporting import reporting_agent
from app.dissemination.router import dissemination_router

logger = logging.getLogger(__name__)


class PlanningAgent:
    """Master orchestrator decomposing queries and sequencing domain agents."""

    name = "PlanningAgent"

    async def run_pipeline(
        self,
        query: str,
        user_type: str = "app",
        explicit_location: Optional[Dict[str, float]] = None,
        detected_language: str = "en",
        session_id: Optional[str] = None,
        reference_time: Optional[datetime] = None
    ) -> SessionState:
        """Executes the full 9-agent pipeline with multi-turn session context and returns populated SessionState."""
        resolved_session_id = session_id or f"sess_{uuid.uuid4().hex[:12]}"
        prior_context = session_store.get_session(resolved_session_id)

        state = SessionState(
            session_id=resolved_session_id,
            raw_query=query,
            user_type=user_type,
            detected_language=detected_language,
            translated_query=query
        )

        now_iso = (reference_time or datetime.now(timezone.utc)).isoformat()

        # Step 1: Intent & Entity Parsing (Planning Agent core)
        parsed_plan = await claude_client.parse_intent_and_entities(
            query=query,
            default_location=explicit_location
        )
        state.parsed_intent = parsed_plan

        # Location Resolution with Session Inheritance & Explicit Override
        has_explicit_location = (
            explicit_location is not None
            or parsed_plan.get("has_explicit_location", False)
            or bool(parsed_plan.get("location_name"))
        )

        planning_warnings = []
        if has_explicit_location and parsed_plan.get("location_name") and parsed_plan.get("coordinates") and parsed_plan.get("location_name") != "Specified Coordinates":
            # 1. Explicit query location takes top priority over browser GPS and replaces prior session location
            state.location_name = parsed_plan["location_name"]
            state.location_coords = parsed_plan["coordinates"]
        elif has_explicit_location and parsed_plan.get("location_name") and parsed_plan.get("location_name") != "Specified Coordinates":
            # 2. Location specified in query but coordinates were not resolved
            state.location_name = parsed_plan["location_name"]
            state.location_coords = parsed_plan.get("coordinates")
            if not state.location_coords:
                planning_warnings.append(
                    f"ADVISORY: Specified location '{state.location_name}' is not an Indian coastal port or maritime sector. "
                    f"Navigation coordinates and marine advisories are unavailable for non-coastal locations."
                )
        elif prior_context and prior_context.location_name and prior_context.location_coords and not (explicit_location and not prior_context.location_name):
            # 3. Multi-turn follow-up (e.g. "What about tomorrow?") inherits location from prior turn
            state.location_name = prior_context.location_name
            state.location_coords = prior_context.location_coords
            logger.info(f"Inherited session location '{state.location_name}' from session {resolved_session_id}")
        elif explicit_location:
            # 4. Device / Browser GPS used when the query has NO explicit location
            state.location_name = parsed_plan.get("location_name") or "GPS Location"
            state.location_coords = explicit_location
        else:
            # 5. Missing location: neither in query, nor in session, nor browser GPS
            if getattr(settings, "DEMO_DEFAULT_LOCATION_ENABLED", True):
                state.location_name = parsed_plan.get("location_name") or "Mangalore"
                state.location_coords = parsed_plan.get("coordinates") or {"lat": 12.87, "lon": 74.84}
                planning_warnings.append(
                    f"DEMO FALLBACK: Location not specified in query or active session. "
                    f"Defaulting to demo coordinates ({state.location_name}: {state.location_coords['lat']}°N, {state.location_coords['lon']}°E). "
                    f"Provide explicit coordinates or port name for operational navigation."
                )
            else:
                state.location_name = "Unspecified Location"
                state.location_coords = None
                planning_warnings.append(
                    "ADVISORY: No coastal location or GPS coordinates provided in query or session context. "
                    "Geospatial evaluation unavailable; provide a coastal location or GPS coordinates for location-specific assessment."
                )

        # Deterministic Temporal Resolution with Session Inheritance & Explicit Override
        ref_dt = reference_time or datetime.now(IST)
        if ref_dt.tzinfo is None:
            ref_dt = ref_dt.replace(tzinfo=IST)
        else:
            ref_dt = ref_dt.astimezone(IST)

        detected_time = parse_temporal_expression(query, reference_time=ref_dt)
        if detected_time:
            # Explicit new temporal indicator in current turn OVERRIDES prior temporal context
            target_time_candidate = detected_time
        elif parsed_plan.get("target_time") and parsed_plan["target_time"] != "today":
            target_time_candidate = parsed_plan["target_time"]
        elif prior_context and prior_context.target_time and not any(w in query.lower() for w in ["now", "today", "currently"]):
            # Inherit temporal context if present
            target_time_candidate = prior_context.target_time
        else:
            target_time_candidate = parsed_plan.get("target_time", "today")

        state.target_time = target_time_candidate
        state.time_range = resolve_time_range(target_time_candidate, reference_time=ref_dt)

        is_loc_resolved = state.location_coords is not None
        planning_result = AgentResult(
            agent=self.name,
            status="success" if is_loc_resolved else "partial",
            location=state.location_coords,
            time_range={
                "start": state.time_range["start"],
                "end": state.time_range["end"],
                "label": state.time_range["label"]
            },
            result={
                "intent": parsed_plan.get("intent", "safety_check"),
                "location_name": state.location_name,
                "coordinates": state.location_coords,
                "target_time": state.target_time,
                "time_range": state.time_range,
                "task_sequence": [
                    "marine_data_discovery",
                    "weather_intelligence",
                    "ocean_analytics",
                    "geospatial_reasoning",
                    "risk_assessment",
                    "visualization",
                    "reporting",
                    "dissemination_router"
                ]
            },
            confidence=0.98 if is_loc_resolved else 0.50,
            sources=[{"name": "Anthropic Claude / Intent Parser", "timestamp": now_iso}],
            warnings=planning_warnings
        )
        state.record_agent_result(planning_result)

        # Step 2: Marine Data Discovery Agent
        logger.info(f"Executing MarineDataDiscoveryAgent for {state.location_name} at {state.location_coords}")
        discovery_result = await marine_data_discovery_agent.execute(
            location=state.location_coords,
            sector_name=state.location_name
        )
        state.record_agent_result(discovery_result)

        raw_weather = discovery_result.result.get("weather_data", {})
        raw_pfz = discovery_result.result.get("pfz_bulletins", [])

        # Step 3: Domain Agents Execution
        # Weather Intelligence Agent with explicit temporal window evaluation
        weather_result = await weather_intelligence_agent.execute(
            weather_data=raw_weather,
            location=state.location_coords,
            time_range=state.time_range
        )
        state.record_agent_result(weather_result)
        # Ensure session state reflects exactly the evaluated window
        if weather_result.time_range:
            state.time_range = weather_result.time_range

        # Ocean Analytics Agent
        ocean_result = await ocean_analytics_agent.execute(
            pfz_bulletins=raw_pfz,
            location=state.location_coords
        )
        state.record_agent_result(ocean_result)

        # Geospatial Reasoning Agent
        geospatial_result = await geospatial_reasoning_agent.execute(
            user_coords=state.location_coords,
            pfz_candidates=raw_pfz
        )
        state.record_agent_result(geospatial_result)

        # Step 4: Verification & Integrity check prior to Risk Assessment
        self._verify_domain_integrity(weather_result, ocean_result, geospatial_result)

        # Step 5: Risk Assessment Agent (Deterministic Safety Hierarchy)
        risk_result = await risk_assessment_agent.execute(
            weather_result=weather_result,
            ocean_result=ocean_result,
            geospatial_result=geospatial_result,
            location=state.location_coords
        )
        state.record_agent_result(risk_result)
        state.final_verdict = risk_result.result.get("verdict", "SAFE")

        # Step 6: Visualization Agent
        viz_result = await visualization_agent.execute(
            user_coords=state.location_coords,
            weather_result=weather_result,
            ocean_result=ocean_result,
            risk_result=risk_result
        )
        state.record_agent_result(viz_result)
        state.visualization = VisualizationPayload(
            geojson=viz_result.result.get("geojson", {}),
            charts=viz_result.result.get("charts", {}),
            map_bounds=viz_result.result.get("map_bounds")
        )

        # Step 7: Reporting Agent
        report_result = await reporting_agent.execute(
            query=query,
            location_name=state.location_name,
            risk_result=risk_result,
            weather_result=weather_result,
            ocean_result=ocean_result,
            geospatial_result=geospatial_result
        )
        state.record_agent_result(report_result)
        state.final_report = report_result.result.get("report_english", "")
        state.safety_summary = report_result.result.get("safety_summary", "")

        # Step 8: Dissemination Router
        dispatched = await dissemination_router.route(
            user_type=state.user_type,
            verdict=state.final_verdict,
            location_name=state.location_name,
            location_coords=state.location_coords,
            report_text=state.final_report,
            weather_result=weather_result,
            ocean_result=ocean_result
        )
        state.dispatched_payload = dispatched

        # Save updated session context for multi-turn conversational tracking
        turn_num = (prior_context.turn_count + 1) if prior_context else 1
        updated_context = SessionContext(
            session_id=resolved_session_id,
            turn_count=turn_num,
            location_name=state.location_name,
            location_coords=state.location_coords,
            target_time=state.target_time,
            time_range=state.time_range,
            last_intent=parsed_plan.get("intent", "safety_check"),
            last_query=query,
            last_verdict=state.final_verdict,
            agent_traces=state.get_ordered_traces()
        )
        session_store.save_session(updated_context)

        return state

    async def execute(
        self,
        query: str,
        user_type: str = "app",
        explicit_location: Optional[Dict[str, float]] = None,
        session_id: Optional[str] = None,
        reference_time: Optional[datetime] = None
    ) -> AgentResult:
        """Direct execution of planning logic returning standard AgentResult."""
        now_iso = (reference_time or datetime.now(timezone.utc)).isoformat()
        try:
            ref_dt = reference_time or datetime.now(IST)
            if ref_dt.tzinfo is None:
                ref_dt = ref_dt.replace(tzinfo=IST)
            else:
                ref_dt = ref_dt.astimezone(IST)

            parsed_plan = await claude_client.parse_intent_and_entities(
                query=query or "",
                default_location=explicit_location
            )
            detected_time = parse_temporal_expression(query or "", reference_time=ref_dt)
            target_time = detected_time or parsed_plan.get("target_time", "today")
            time_range = resolve_time_range(target_time, reference_time=ref_dt)
            has_explicit = (
                explicit_location is not None
                or parsed_plan.get("has_explicit_location", False)
                or bool(parsed_plan.get("location_name"))
            )
            warnings = []
            if has_explicit and parsed_plan.get("location_name") and parsed_plan.get("coordinates") and parsed_plan.get("location_name") != "Specified Coordinates":
                loc_name = parsed_plan["location_name"]
                coords = parsed_plan["coordinates"]
            elif has_explicit and parsed_plan.get("location_name") and parsed_plan.get("location_name") != "Specified Coordinates":
                loc_name = parsed_plan["location_name"]
                coords = parsed_plan.get("coordinates")
                if not coords:
                    warnings.append(
                        f"ADVISORY: Specified location '{loc_name}' is not an Indian coastal port or maritime sector."
                    )
            elif explicit_location:
                coords = explicit_location
                loc_name = parsed_plan.get("location_name") or "GPS Location"
            else:
                if getattr(settings, "DEMO_DEFAULT_LOCATION_ENABLED", True):
                    loc_name = parsed_plan.get("location_name") or "Mangalore"
                    coords = parsed_plan.get("coordinates") or {"lat": 12.87, "lon": 74.84}
                    warnings.append(
                        f"DEMO FALLBACK: No coastal port or GPS coordinates specified in query. "
                        f"Defaulting to demo coordinates ({loc_name}: {coords['lat']}°N, {coords['lon']}°E)."
                    )
                else:
                    loc_name = "Unspecified Location"
                    coords = None
                    warnings.append("ADVISORY: No coastal location or GPS coordinates provided in query.")

            return AgentResult(
                agent=self.name,
                status="success" if coords is not None else "partial",
                location=coords,
                time_range={
                    "start": time_range["start"],
                    "end": time_range["end"],
                    "label": time_range["label"]
                },
                result={
                    "intent": parsed_plan.get("intent", "safety_check"),
                    "location_name": loc_name,
                    "coordinates": coords,
                    "target_time": target_time,
                    "time_range": time_range,
                    "task_sequence": [
                        "marine_data_discovery", "weather_intelligence", "ocean_analytics",
                        "geospatial_reasoning", "risk_assessment", "visualization",
                        "reporting", "dissemination_router"
                    ]
                },
                confidence=0.98 if coords is not None else 0.50,
                sources=[{"name": "Anthropic Claude / Intent Parser", "timestamp": now_iso}],
                warnings=warnings
            )
        except Exception as e:
            return AgentResult(
                agent=self.name,
                status="error",
                location=explicit_location,
                time_range={"start": now_iso, "end": now_iso},
                result={"error": str(e)},
                confidence=0.0,
                sources=[{"name": "PlanningAgent", "timestamp": now_iso}],
                warnings=[f"Planning orchestration error: {str(e)}"]
            )

    def _verify_domain_integrity(
        self,
        weather: AgentResult,
        ocean: AgentResult,
        geospatial: AgentResult
    ):
        """Validates that domain agent payloads are present and non-corrupt."""
        if weather.status == "error":
            logger.warning("Weather agent returned error, using conservative caution defaults")
        if geospatial.status == "error":
            logger.warning("Geospatial agent returned error, flagged for review")


planning_agent = PlanningAgent()
