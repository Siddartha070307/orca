"""Visualization Agent.

Constructs ready-to-render GeoJSON layers (user point, PFZ target, navigation corridor,
restricted sanctuary polygons) and time-series chart data for frontend consumption.
"""
from typing import Dict, Any, List, Optional
import math
from datetime import datetime, timezone
from app.models.schemas import AgentResult
from app.agents.geospatial_reasoning import RESTRICTED_ZONES
from app.core.safety_rules import MarineSafetyThresholds


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Computes great-circle distance in km between two points."""
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2.0) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2.0) ** 2
    return 2.0 * r * math.atan2(math.sqrt(a), math.sqrt(max(0.0, 1.0 - a)))


def _calculate_bearing(lat1: float, lon1: float, lat2: float, lon2: float) -> int:
    """Computes navigational forward azimuth bearing in degrees (0-360)."""
    lat1_r, lat2_r = math.radians(lat1), math.radians(lat2)
    dlon = math.radians(lon2 - lon1)
    y = math.sin(dlon) * math.cos(lat2_r)
    x = math.cos(lat1_r) * math.sin(lat2_r) - math.sin(lat1_r) * math.cos(lat2_r) * math.cos(dlon)
    bearing = math.degrees(math.atan2(y, x))
    return int((bearing + 360) % 360)


class VisualizationAgent:
    """Agent producing GeoJSON maps and time-series telemetry charts."""

    name = "VisualizationAgent"

    async def execute(
        self,
        user_coords: Optional[Dict[str, float]] = None,
        weather_result: Optional[AgentResult] = None,
        ocean_result: Optional[AgentResult] = None,
        risk_result: Optional[AgentResult] = None
    ) -> AgentResult:
        now_iso = datetime.now(timezone.utc).isoformat()
        has_coords = bool(user_coords and isinstance(user_coords, dict) and "lat" in user_coords and "lon" in user_coords and user_coords["lat"] is not None and user_coords["lon"] is not None)
        u_lat = float(user_coords["lat"]) if has_coords else None
        u_lon = float(user_coords["lon"]) if has_coords else None

        features = []
        warnings = []

        # 1. User Position Feature (only if valid coordinates provided)
        if has_coords:
            features.append({
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [u_lon, u_lat]
                },
                "properties": {
                    "id": "user-vessel",
                    "title": "Vessel / Port Location",
                    "category": "user",
                    "marker-color": "#2563eb",
                    "marker-symbol": "ferry"
                }
            })

        # 2. Recommended PFZ Candidate Feature
        ocean_payload = ocean_result.result if ocean_result else {}
        recommended_pfz = ocean_payload.get("recommended_pfz")
        if recommended_pfz and "lat" in recommended_pfz and "lon" in recommended_pfz:
            pfz_lat = float(recommended_pfz["lat"])
            pfz_lon = float(recommended_pfz["lon"])

            # Compute or retrieve user-relative navigation distance and bearing
            if has_coords:
                # If user coordinates AND PFZ coordinates are available, calculate directly from coordinates
                # Do NOT use ambiguous distance_km/bearing_deg as navigation data
                nav_dist = round(_haversine_km(u_lat, u_lon, pfz_lat, pfz_lon), 1)
                nav_bearing = _calculate_bearing(u_lat, u_lon, pfz_lat, pfz_lon)
            else:
                nav_dist = recommended_pfz.get("distance_user_km") or recommended_pfz.get("calculated_distance_km")
                nav_bearing = recommended_pfz.get("bearing_user_deg") or recommended_pfz.get("calculated_bearing_deg")

            # Preserve legitimate source metadata separately without confusing with vessel navigation
            source_dist = recommended_pfz.get("source_distance_km")
            source_bearing = recommended_pfz.get("source_bearing_deg")
            if source_dist is None and "distance_km" in recommended_pfz:
                source_dist = recommended_pfz.get("distance_km")
            if source_bearing is None and "bearing_deg" in recommended_pfz:
                source_bearing = recommended_pfz.get("bearing_deg")

            features.append({
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [pfz_lon, pfz_lat]
                },
                "properties": {
                    "id": recommended_pfz.get("id", "PFZ-TARGET"),
                    "title": f"PFZ: {recommended_pfz.get('id')}",
                    "category": "pfz",
                    "marker-color": "#059669",
                    "marker-symbol": "star",
                    "sst_celsius": recommended_pfz.get("sst_c"),
                    "chlorophyll_mg_m3": recommended_pfz.get("chlorophyll_mg_m3"),
                    "suitability_score": recommended_pfz.get("evaluated_suitability", recommended_pfz.get("suitability_score")),
                    "bearing_deg": nav_bearing,
                    "distance_km": nav_dist,
                    "distance_user_km": nav_dist,
                    "bearing_user_deg": nav_bearing,
                    "calculated_distance_km": nav_dist,
                    "calculated_bearing_deg": nav_bearing,
                    "source_distance_km": source_dist,
                    "source_bearing_deg": source_bearing,
                    "target_species": recommended_pfz.get("target_species", [])
                }
            })

            # 3. Navigational Vector LineString (if user coords available)
            if has_coords:
                features.append({
                    "type": "Feature",
                    "geometry": {
                        "type": "LineString",
                        "coordinates": [
                            [u_lon, u_lat],
                            [pfz_lon, pfz_lat]
                        ]
                    },
                    "properties": {
                        "id": "nav-course-vector",
                        "title": f"Course Vector ({nav_dist} km @ {nav_bearing}°)",
                        "stroke": "#0284c7",
                        "stroke-width": 2.5,
                        "stroke-dasharray": "5, 5",
                        "distance_km": nav_dist,
                        "bearing_deg": nav_bearing
                    }
                })

        # 4. Restricted Marine Zones Polygons
        for zone in RESTRICTED_ZONES:
            features.append({
                "type": "Feature",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [zone["coordinates"]]
                },
                "properties": {
                    "id": f"restricted-{zone['name'][:10]}",
                    "title": zone["name"],
                    "category": "restricted_zone",
                    "zone_type": zone["type"],
                    "fill": "#dc2626",
                    "fill-opacity": 0.25,
                    "stroke": "#b91c1c",
                    "stroke-width": 2
                }
            })

        geojson_collection = {
            "type": "FeatureCollection",
            "features": features
        }

        # 5. Chart Time Series Data from actual forecast data (ZERO synthetic fabrication)
        w_payload = weather_result.result if weather_result else {}
        w_metrics = w_payload.get("metrics", {})
        hourly_series = w_payload.get("hourly_series", {})
        raw_times = hourly_series.get("times", [])
        forecast_available = w_metrics.get("forecast_available", True) and bool(raw_times)

        src_name = (weather_result.sources[0].get("name") if weather_result and weather_result.sources else "Open-Meteo API")
        chart_source = {
            "name": src_name,
            "is_simulated": "simulated" in src_name.lower() or "mock" in src_name.lower()
        }

        if forecast_available and raw_times:
            labels = []
            for t_str in raw_times:
                try:
                    dt = datetime.fromisoformat(t_str)
                    labels.append(dt.strftime("%H:%M"))
                except Exception:
                    labels.append(t_str[-8:-3] if len(t_str) >= 8 else t_str)

            chart_data = {
                "available": True,
                "labels": labels,
                "timestamps": raw_times,
                "source": chart_source,
                "wave_series": {
                    "name": "Significant Wave Height (m)",
                    "unit": "m",
                    "data": hourly_series.get("wave_height_m", []),
                    "caution_threshold": MarineSafetyThresholds.WAVE_SAFE_MAX,
                    "danger_threshold": MarineSafetyThresholds.WAVE_UNSAFE_MIN
                },
                "wind_series": {
                    "name": "Wind Speed (km/h)",
                    "unit": "km/h",
                    "data": hourly_series.get("wind_speed_kmh", []),
                    "caution_threshold": MarineSafetyThresholds.WIND_SAFE_MAX,
                    "danger_threshold": MarineSafetyThresholds.WIND_UNSAFE_MIN
                }
            }

            if hourly_series.get("wind_gust_kmh"):
                chart_data["gust_series"] = {
                    "name": "Wind Gusts (km/h)",
                    "unit": "km/h",
                    "data": hourly_series.get("wind_gust_kmh", []),
                    "caution_threshold": MarineSafetyThresholds.GUST_CAUTION_MIN,
                    "danger_threshold": MarineSafetyThresholds.GUST_UNSAFE_MIN
                }
            if hourly_series.get("temperature_c"):
                chart_data["temperature_series"] = {
                    "name": "Air Temperature (°C)",
                    "unit": "°C",
                    "data": hourly_series.get("temperature_c", [])
                }
            if hourly_series.get("precipitation_mm"):
                chart_data["precipitation_series"] = {
                    "name": "Precipitation (mm)",
                    "unit": "mm",
                    "data": hourly_series.get("precipitation_mm", [])
                }
        else:
            # Data unavailable or out-of-horizon: explicit partial representation, ZERO fabrication
            warn_msg = "Hourly forecast telemetry unavailable for requested temporal window; charts not generated."
            warnings.append(warn_msg)
            chart_data = {
                "available": False,
                "warning": warn_msg,
                "labels": [],
                "timestamps": [],
                "source": chart_source,
                "wave_series": {
                    "name": "Significant Wave Height (m)",
                    "unit": "m",
                    "data": [],
                    "caution_threshold": MarineSafetyThresholds.WAVE_SAFE_MAX,
                    "danger_threshold": MarineSafetyThresholds.WAVE_UNSAFE_MIN
                },
                "wind_series": {
                    "name": "Wind Speed (km/h)",
                    "unit": "km/h",
                    "data": [],
                    "caution_threshold": MarineSafetyThresholds.WIND_SAFE_MAX,
                    "danger_threshold": MarineSafetyThresholds.WIND_UNSAFE_MIN
                },
                "gust_series": {
                    "name": "Wind Gusts (km/h)",
                    "unit": "km/h",
                    "data": [],
                    "caution_threshold": MarineSafetyThresholds.GUST_CAUTION_MIN,
                    "danger_threshold": MarineSafetyThresholds.GUST_UNSAFE_MIN
                },
                "temperature_series": {
                    "name": "Air Temperature (°C)",
                    "unit": "°C",
                    "data": []
                },
                "precipitation_series": {
                    "name": "Precipitation (mm)",
                    "unit": "mm",
                    "data": []
                }
            }

        # Calculate bounding box [min_lon, min_lat, max_lon, max_lat]
        if has_coords:
            min_lon = min(u_lon, u_lon - 0.5)
            max_lon = max(u_lon, u_lon + 0.5)
            min_lat = min(u_lat, u_lat - 0.5)
            max_lat = max(u_lat, u_lat + 0.5)
            map_bounds = [round(min_lon, 3), round(min_lat, 3), round(max_lon, 3), round(max_lat, 3)]
        else:
            map_bounds = None

        payload = {
            "geojson": geojson_collection,
            "charts": chart_data,
            "map_bounds": map_bounds,
            "total_layers": len(features)
        }

        return AgentResult(
            agent=self.name,
            status="success" if chart_data.get("available", False) else "partial",
            location={"lat": u_lat, "lon": u_lon} if has_coords else None,
            time_range=(weather_result.time_range if weather_result else None) or {"start": now_iso, "end": now_iso},
            result=payload,
            confidence=1.0 if chart_data.get("available", False) else 0.7,
            sources=[{"name": "ORCA GeoJSON & Telemetry Rendering Engine", "timestamp": now_iso}],
            warnings=warnings
        )


visualization_agent = VisualizationAgent()
