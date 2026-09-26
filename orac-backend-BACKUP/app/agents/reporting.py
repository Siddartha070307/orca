import re
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone
from app.models.schemas import AgentResult
from app.integrations.claude_client import claude_client


class ReportingAgent:
    """Agent writing evidence-backed advisories using Claude / Anthropic API."""

    name = "ReportingAgent"

    async def execute(
        self,
        query: str,
        location_name: str,
        risk_result: Optional[AgentResult] = None,
        weather_result: Optional[AgentResult] = None,
        ocean_result: Optional[AgentResult] = None,
        geospatial_result: Optional[AgentResult] = None
    ) -> AgentResult:
        now_iso = datetime.now(timezone.utc).isoformat()
        coords = (risk_result.location if risk_result else None) or (weather_result.location if weather_result else None)

        # 1. Safe extraction of upstream findings
        r_res = risk_result.result if (risk_result and risk_result.result) else {}
        verdict = r_res.get("verdict", "CAUTION")
        primary_drivers = r_res.get("primary_drivers", [])

        w_res = weather_result.result if (weather_result and weather_result.result) else {}
        weather_metrics = dict(w_res.get("metrics", {}))
        # Ensure fallback metrics if metrics dict is incomplete
        if "wind_speed_kmh" not in weather_metrics and "max_wind_kmh" in w_res:
            weather_metrics["wind_speed_kmh"] = w_res["max_wind_kmh"]
        if "wave_height_m" not in weather_metrics and "max_wave_m" in w_res:
            weather_metrics["wave_height_m"] = w_res["max_wave_m"]
        if "wind_gust_kmh" not in weather_metrics and "max_gust_kmh" in w_res:
            weather_metrics["wind_gust_kmh"] = w_res["max_gust_kmh"]
        if "precipitation_mm" not in weather_metrics and "max_precip_mm" in w_res:
            weather_metrics["precipitation_mm"] = w_res["max_precip_mm"]

        o_res = ocean_result.result if (ocean_result and ocean_result.result) else {}
        pfz_candidates = o_res.get("candidates", [])

        g_res = geospatial_result.result if (geospatial_result and geospatial_result.result) else {}

        time_range = weather_result.time_range if (weather_result and weather_result.time_range) else {}
        time_label = time_range.get("label") if isinstance(time_range, dict) else None

        # 2. Synthesize report via Claude client
        report_text = await claude_client.generate_marine_report(
            query=query or "Marine safety assessment",
            verdict=verdict,
            safety_reasons=primary_drivers,
            weather_metrics=weather_metrics,
            pfz_recommendations=pfz_candidates,
            geospatial_info=g_res,
            target_location=location_name or "Operating Sector",
            time_label=time_label,
            time_range=time_range
        )

        # 3. Deterministic Verdict Contradiction Detection
        text_upper = report_text.upper()
        contradiction = False
        if verdict == "UNSAFE":
            safe_phrases = ["SAFE TO SAIL", "CONDITIONS ARE SAFE", "PERFECTLY SAFE", "PLEASANT TODAY", "FAVORABLE CONDITIONS", "CAN SAIL SAFELY", "PERFECTLY FINE"]
            if any(p in text_upper for p in safe_phrases) or not any(k in text_upper for k in ["UNSAFE", "DANGEROUS", "PROHIBITED", "WARNING", "HAZARDOUS"]):
                contradiction = True
        elif verdict == "CAUTION":
            safe_phrases = ["SAFE TO SAIL", "PERFECTLY SAFE", "NO RISK", "FAVORABLE CONDITIONS", "PERFECTLY FINE"]
            if any(p in text_upper for p in safe_phrases) or not any(k in text_upper for k in ["CAUTION", "VIGILANCE", "WARNING", "RESTRICTED", "MARGINAL"]):
                contradiction = True
        elif verdict == "SAFE":
            unsafe_phrases = ["UNSAFE", "PROHIBITED", "DO NOT SAIL", "DANGEROUS", "HAZARDOUS"]
            if any(p in text_upper for p in unsafe_phrases):
                contradiction = True

        # 4. Numerical Evidence Cross-Check (> 20% discrepancy guard)
        auth_wind = weather_metrics.get("wind_speed_kmh")
        auth_wave = weather_metrics.get("wave_height_m")

        discrepancy = False
        if auth_wind is not None:
            try:
                w_val = float(auth_wind)
                if w_val > 0:
                    for m in re.finditer(r'(\d+(?:\.\d+)?)\s*(?:km/h|kmph)', report_text, re.IGNORECASE):
                        cited = float(m.group(1))
                        if abs(cited - w_val) / w_val > 0.20:
                            discrepancy = True
                            break
            except Exception:
                pass

        if auth_wave is not None and not discrepancy:
            try:
                wv_val = float(auth_wave)
                if wv_val > 0:
                    for m in re.finditer(r'(\d+(?:\.\d+)?)\s*(?:m\b|meters?\b)', report_text, re.IGNORECASE):
                        cited = float(m.group(1))
                        if abs(cited - wv_val) / wv_val > 0.20:
                            discrepancy = True
                            break
            except Exception:
                pass

        # 5. Strictly override contradictory text or faulty numbers with authoritative deterministic report
        if contradiction or discrepancy:
            report_text = claude_client._fallback_report_synthesizer(
                query=query,
                verdict=verdict,
                safety_reasons=primary_drivers,
                weather_metrics=weather_metrics,
                pfz_recommendations=pfz_candidates,
                geospatial_info=g_res,
                target_location=location_name or "Operating Sector",
                time_label=time_label,
                time_range=time_range
            )
        else:
            # Enforce authoritative header if not already prefixed
            if verdict == "UNSAFE" and "SAFETY ADVISORY: UNSAFE TO SAIL" not in report_text:
                report_text = f"**SAFETY ADVISORY: UNSAFE TO SAIL.**\n\n{report_text}"
            elif verdict == "CAUTION" and "SAFETY ADVISORY: PROCEED WITH CAUTION" not in report_text:
                report_text = f"**SAFETY ADVISORY: PROCEED WITH CAUTION.**\n\n{report_text}"
            elif verdict == "SAFE" and "SAFETY ADVISORY: SAFE FOR OPERATIONS" not in report_text:
                report_text = f"**SAFETY ADVISORY: SAFE FOR OPERATIONS.**\n\n{report_text}"

            # Temporal Window Label Check
            if time_label and time_label.lower() not in report_text.lower():
                report_text = f"**Forecast Period:** {time_label}\n\n{report_text}"

        # 6. Safety summary line
        wind_display = auth_wind if auth_wind is not None else "N/A"
        wave_display = auth_wave if auth_wave is not None else "N/A"
        time_prefix = f"[{time_label}] " if time_label else ""
        summary_line = f"{time_prefix}Status: {verdict} | Wind: {wind_display} km/h | Wave: {wave_display} m"
        if pfz_candidates:
            pfz_user_dist = pfz_candidates[0].get("distance_user_km") or pfz_candidates[0].get("calculated_distance_km") or pfz_candidates[0].get("distance_km", "N/A")
            summary_line += f" | PFZ: {pfz_user_dist}km offshore"

        payload = {
            "verdict": verdict,
            "safety_summary": summary_line,
            "report_english": report_text,
            "temporal_window": time_label,
            "evidence_cited": {
                "wind_speed_kmh": wind_display,
                "wave_height_m": wave_display,
                "drivers": primary_drivers,
                "nearest_pfz": pfz_candidates[0].get("id") if pfz_candidates else None
            }
        }

        return AgentResult(
            agent=self.name,
            status="success",
            location=coords,
            time_range=time_range or {"start": now_iso, "end": now_iso},
            result=payload,
            confidence=0.96,
            sources=[{"name": "Anthropic Claude (ORCA Reporting Agent)", "timestamp": now_iso}],
            warnings=[]
        )


reporting_agent = ReportingAgent()

