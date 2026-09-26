"""Weather Intelligence Agent.

Takes raw atmospheric and marine wave forecast data, evaluates safety thresholds
from safety_rules.py, and outputs a structured weather verdict with exact drivers.
"""
from typing import Dict, Any, Optional
from datetime import datetime, timezone
from app.models.schemas import AgentResult
from app.core.safety_rules import evaluate_weather_safety, SafetyVerdict
from app.core.temporal import resolve_time_range, filter_forecast_by_timerange


class WeatherIntelligenceAgent:
    """Agent evaluating wind, wave, gust, and convective storm safety over requested time windows."""

    name = "WeatherIntelligenceAgent"

    async def execute(
        self,
        weather_data: Optional[Dict[str, Any]] = None,
        location: Optional[Dict[str, float]] = None,
        time_range: Optional[Dict[str, Any]] = None
    ) -> AgentResult:
        now_iso = datetime.now(timezone.utc).isoformat()
        w_dict = weather_data if isinstance(weather_data, dict) else {}
        coords = location or w_dict.get("coordinates", {"lat": 12.87, "lon": 74.84})

        # If no time_range provided, resolve default (current)
        tr = time_range or resolve_time_range("now")
        is_current = tr.get("is_current", False)

        current = w_dict.get("current", {})
        forecast_hourly = (
            w_dict.get("forecast_hourly")
            or w_dict.get("forecast_24h")
            or w_dict.get("hourly")
            or {}
        )

        evaluated_window: Dict[str, Any] = {
            "start": tr.get("start", now_iso),
            "end": tr.get("end", now_iso),
            "label": tr.get("label", "Current Conditions"),
            "is_current": is_current
        }

        if is_current:
            # Evaluate current conditions directly
            wind_speed = current.get("wind_speed_kmh", 18.0)
            wave_height = current.get("wave_height_m", 1.2)
            wind_gust = current.get("wind_gust_kmh")
            has_storm = current.get("has_storm_alert", False)
            storm_desc = current.get("storm_description", "")
            w_code = current.get("weather_code")
            evaluated_window["data_points_evaluated"] = 1

            verdict, reasons, metrics = evaluate_weather_safety(
                wind_speed=wind_speed,
                wave_height=wave_height,
                wind_gust=wind_gust,
                has_storm_alert=has_storm,
                storm_description=storm_desc,
                weather_code=w_code
            )
            has_forecast = bool(forecast_hourly.get("times"))
            metrics["forecast_available"] = has_forecast

            # For current conditions, retain up to 12 hours of immediate forecast if present
            if has_forecast:
                hourly_series = {
                    "times": forecast_hourly.get("times", [])[:12],
                    "wind_speed_kmh": forecast_hourly.get("wind_speed_kmh", [])[:12],
                    "wave_height_m": forecast_hourly.get("wave_height_m", [])[:12],
                    "wind_gust_kmh": forecast_hourly.get("wind_gust_kmh", [])[:12],
                    "temperature_c": forecast_hourly.get("temperature_c", [])[:12],
                    "precipitation_mm": forecast_hourly.get("precipitation_mm", [])[:12],
                }
            else:
                hourly_series = {
                    "times": [],
                    "wind_speed_kmh": [],
                    "wave_height_m": [],
                    "wind_gust_kmh": [],
                    "temperature_c": [],
                    "precipitation_mm": []
                }
        else:
            # Filter hourly forecast points strictly inside the requested temporal window
            if forecast_hourly.get("times"):
                window_metrics = filter_forecast_by_timerange(forecast_hourly, tr)
            else:
                window_metrics = {"matched_points": 0}

            if window_metrics.get("matched_points", 0) > 0:
                wind_speed = window_metrics["max_wind_kmh"]
                wave_height = window_metrics["max_wave_m"]
                wind_gust = window_metrics["max_gust_kmh"]
                has_storm = window_metrics["has_storm_alert"]
                storm_desc = window_metrics["storm_description"]
                evaluated_window["data_points_evaluated"] = window_metrics["matched_points"]
                evaluated_window["peak_wind_kmh"] = wind_speed
                evaluated_window["peak_wave_m"] = wave_height
                evaluated_window["peak_gust_kmh"] = wind_gust
                evaluated_window["has_storm_alert"] = has_storm
                hourly_series = window_metrics.get("filtered_series", {})

                verdict, reasons, metrics = evaluate_weather_safety(
                    wind_speed=wind_speed,
                    wave_height=wave_height,
                    wind_gust=wind_gust,
                    has_storm_alert=has_storm,
                    storm_description=storm_desc
                )
                metrics["forecast_available"] = True
            else:
                # Window falls outside available forecast horizon or forecast series is unavailable
                horizon_end = forecast_hourly["times"][-1] if forecast_hourly.get("times") else "none (no forecast series)"
                evaluated_window["data_points_evaluated"] = 0
                evaluated_window["out_of_horizon"] = True
                evaluated_window["horizon_end"] = horizon_end
                hourly_series = {
                    "times": [],
                    "wind_speed_kmh": [],
                    "wave_height_m": [],
                    "wind_gust_kmh": [],
                    "temperature_c": [],
                    "precipitation_mm": []
                }
                
                wind_speed = None
                wave_height = None
                wind_gust = None
                has_storm = False
                storm_desc = ""

                verdict = SafetyVerdict.CAUTION
                reasons = [
                    f"ADVISORY: Target time window '{tr.get('label')}' ({tr.get('start')} to {tr.get('end')}) "
                    f"falls outside the available forecast horizon (coverage ends {horizon_end}). "
                    f"Sea safety cannot be confirmed without active meteorological forecast data."
                ]
                metrics = {
                    "wind_speed_kmh": None,
                    "wave_height_m": None,
                    "wind_gust_kmh": None,
                    "has_storm_alert": False,
                    "forecast_available": False
                }

        forecast_24h = weather_data.get("forecast_24h", {})
        forecast_winds = [w for w in forecast_24h.get("wind_speed_kmh", []) if w is not None]
        forecast_waves = [w for w in forecast_24h.get("wave_height_m", []) if w is not None]
        max_forecast_wind = max(forecast_winds) if forecast_winds else wind_speed
        max_forecast_wave = max(forecast_waves) if forecast_waves else wave_height

        result_time_range = {
            "start": tr.get("start", now_iso),
            "end": tr.get("end", now_iso),
            "label": tr.get("label", "Evaluated Window"),
            "is_current": is_current
        }

        payload = {
            "verdict": verdict.value,
            "metrics": metrics,
            "reasons": reasons,
            "sea_state": self._classify_sea_state(wave_height),
            "time_range": result_time_range,
            "evaluated_window": evaluated_window,
            "hourly_series": hourly_series,
            "forecast_peak_24h": {
                "peak_wind_kmh": round(max_forecast_wind, 1) if max_forecast_wind is not None else None,
                "peak_wave_m": round(max_forecast_wave, 2) if max_forecast_wave is not None else None
            }
        }

        warnings = [r for r in reasons if "HARD CONSTRAINT" in r or "ADVISORY" in r]

        is_out_of_horizon = bool(evaluated_window.get("out_of_horizon", False))
        return AgentResult(
            agent=self.name,
            status="partial" if is_out_of_horizon else "success",
            location=coords,
            time_range=result_time_range,
            result=payload,
            confidence=0.70 if is_out_of_horizon else 0.95,
            sources=[{"name": w_dict.get("source", "Open-Meteo"), "timestamp": w_dict.get("timestamp", now_iso)}],
            warnings=warnings
        )

    def _classify_sea_state(self, wave_height_m: Optional[float]) -> str:
        """WMO Sea State Code Classification."""
        if wave_height_m is None:
            return "Unknown (Data Unavailable)"
        if wave_height_m < 0.5:
            return "Calm (Glassy/Rippled)"
        elif wave_height_m < 1.25:
            return "Smooth"
        elif wave_height_m < 2.5:
            return "Slight to Moderate"
        elif wave_height_m < 4.0:
            return "Rough"
        else:
            return "Very Rough / High Sea"


weather_intelligence_agent = WeatherIntelligenceAgent()
