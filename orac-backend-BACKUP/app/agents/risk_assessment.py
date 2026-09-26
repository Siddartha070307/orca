"""Risk Assessment Agent.

Synthesizes Weather, Ocean, and Geospatial findings through the deterministic
safety rule hierarchy to produce an indisputable safety verdict with explicit evidence drivers.
"""
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from app.models.schemas import AgentResult
from app.core.safety_rules import arbitrate_safety_hierarchy, SafetyVerdict


class RiskAssessmentAgent:
    """Arbiter agent applying the deterministic safety rule hierarchy."""

    name = "RiskAssessmentAgent"

    async def execute(
        self,
        weather_result: Optional[AgentResult] = None,
        ocean_result: Optional[AgentResult] = None,
        geospatial_result: Optional[AgentResult] = None,
        location: Optional[Dict[str, float]] = None
    ) -> AgentResult:
        now_iso = datetime.now(timezone.utc).isoformat()
        coords = location or (weather_result.location if weather_result else None)

        # Extract structured outputs defensively
        w_payload = weather_result.result if (weather_result and weather_result.result) else {}
        w_verdict_str = w_payload.get("verdict", "CAUTION" if not weather_result or weather_result.status == "error" else "SAFE")
        try:
            w_verdict = SafetyVerdict(w_verdict_str)
        except ValueError:
            w_verdict = SafetyVerdict.CAUTION
        w_reasons = list(w_payload.get("reasons", []))
        if not weather_result or weather_result.status == "error":
            w_reasons.append("Weather data incomplete or unavailable; conservative caution applied.")

        g_payload = geospatial_result.result if (geospatial_result and geospatial_result.result) else {}
        g_verdict_str = g_payload.get("verdict", "CAUTION" if not geospatial_result or geospatial_result.status == "error" else "SAFE")
        try:
            g_verdict = SafetyVerdict(g_verdict_str)
        except ValueError:
            g_verdict = SafetyVerdict.CAUTION
        g_reasons = list(g_payload.get("reasons", []))
        if not geospatial_result or geospatial_result.status == "error":
            g_reasons.append("Geospatial geofence evaluation incomplete; conservative caution applied.")

        o_payload = ocean_result.result if (ocean_result and ocean_result.result) else {}
        o_verdict = o_payload.get("verdict", "SUBOPTIMAL" if not ocean_result else "FAVORABLE")
        o_reasons = []
        if o_verdict != "FAVORABLE":
            o_reasons.append("PFZ thermal front suitability below optimum operational threshold.")

        # Run strict deterministic arbitration
        final_verdict, combined_reasons, risk_score = arbitrate_safety_hierarchy(
            weather_verdict=w_verdict,
            weather_reasons=w_reasons,
            geospatial_verdict=g_verdict,
            geospatial_reasons=g_reasons,
            ocean_verdict=o_verdict,
            ocean_reasons=o_reasons
        )

        # Actionable directive
        if final_verdict == SafetyVerdict.UNSAFE:
            action = "STAY ASHORE / RETURN TO PORT IMMEDIATELY. Sea venturing is prohibited."
        elif final_verdict == SafetyVerdict.CAUTION:
            action = "PROCEED WITH HEIGHTENED VIGILANCE. Restricted to mechanized vessels with VHF/NAVIC safety gear."
        else:
            action = "NORMAL FISHING OPERATIONS AUTHORIZED. Favorable marine conditions."

        payload = {
            "verdict": final_verdict.value,
            "risk_score": risk_score,
            "primary_drivers": combined_reasons,
            "actionable_directive": action,
            "weather_summary": {
                "verdict": w_verdict_str,
                "metrics": w_payload.get("metrics", {})
            },
            "geospatial_summary": {
                "verdict": g_verdict_str,
                "is_restricted": g_payload.get("is_inside_restricted", False)
            },
            "ocean_summary": {
                "verdict": o_verdict,
                "recommended_pfz_id": o_payload.get("recommended_pfz", {}).get("id") if o_payload.get("recommended_pfz") else None
            }
        }

        warnings = [r for r in combined_reasons if "HARD CONSTRAINT" in r or "ADVISORY" in r]

        sources = [{"name": "Deterministic Safety Hierarchy (safety_rules.py)", "timestamp": now_iso}]
        if weather_result and weather_result.sources:
            sources.extend(weather_result.sources)
        if geospatial_result and geospatial_result.sources:
            sources.extend(geospatial_result.sources)

        return AgentResult(
            agent=self.name,
            status="success",
            location=coords,
            time_range=(weather_result.time_range if weather_result else None) or {"start": now_iso, "end": now_iso},
            result=payload,
            confidence=0.99,
            sources=sources,
            warnings=warnings
        )


risk_assessment_agent = RiskAssessmentAgent()
