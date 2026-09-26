"""Visualization Agent.

Constructs ready-to-render GeoJSON layers (user point, PFZ target, navigation corridor,
restricted sanctuary polygons) and time-series chart data for frontend consumption.
"""
from typing import Dict, Any, List, Optional
import math
from datetime import datetime, timezone
from app.models.schemas import AgentResult
from shapely.geometry import Point, Polygon
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
        risk_result: Optional[AgentResult] = None,
        geospatial_result: Optional[AgentResult] = None
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

        # 2. PFZ Candidate Features (All candidates with rank and recommendation status)
        ocean_payload = ocean_result.result if ocean_result else {}
        candidates = ocean_payload.get("candidates", [])
        recommended_pfz = ocean_payload.get("recommended_pfz")

        if not candidates and recommended_pfz:
            candidates = [recommended_pfz]

        rec_id = recommended_pfz.get("id") if recommended_pfz else (candidates[0].get("id") if candidates else None)
        rec_lat = None
        rec_lon = None
        rec_nav_dist = None
        rec_nav_bearing = None

        # Build Polygon list for restricted zones geofence checks
        zone_polygons_shapely = []
        for zone in RESTRICTED_ZONES:
            try:
                zone_polygons_shapely.append(Polygon(zone["coordinates"]))
            except Exception:
                pass

        for idx, c in enumerate(candidates):
            if not c or "lat" not in c or "lon" not in c or c["lat"] is None or c["lon"] is None:
                continue

            c_lat = float(c["lat"])
            c_lon = float(c["lon"])

            # Rank and recommendation status
            rank = c.get("pfz_rank", idx + 1)
            is_rec = (c.get("is_recommended") is True) or (c.get("id") == rec_id) or (rank == 1 and not recommended_pfz)

            # User-relative navigation distance and bearing
            if has_coords:
                nav_dist = round(_haversine_km(u_lat, u_lon, c_lat, c_lon), 1)
                nav_bearing = _calculate_bearing(u_lat, u_lon, c_lat, c_lon)
            else:
                nav_dist = c.get("distance_user_km") or c.get("calculated_distance_km") or c.get("distance_km")
                nav_bearing = c.get("bearing_user_deg") or c.get("calculated_bearing_deg") or c.get("bearing_deg")

            # Source bulletin metadata from coastal port
            source_dist = c.get("source_distance_km")
            source_bearing = c.get("source_bearing_deg")
            if source_dist is None and "distance_km" in c:
                source_dist = c.get("distance_km")
            if source_bearing is None and "bearing_deg" in c:
                source_bearing = c.get("bearing_deg")

            # Check restricted zone status
            if "is_in_restricted_zone" in c:
                in_restricted = bool(c["is_in_restricted_zone"])
            else:
                pt = Point(c_lon, c_lat)
                in_restricted = any(poly.covers(pt) for poly in zone_polygons_shapely)

            if is_rec and rec_lat is None:
                rec_lat = c_lat
                rec_lon = c_lon
                rec_nav_dist = nav_dist
                rec_nav_bearing = nav_bearing

            features.append({
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [c_lon, c_lat]  # RFC 7946: [lon, lat]
                },
                "properties": {
                    "id": c.get("id", f"PFZ-CANDIDATE-{rank}"),
                    "title": f"PFZ: {c.get('id')}" if is_rec else f"PFZ #{rank}: {c.get('id')}",
                    "category": "pfz",
                    "pfz_rank": rank,
                    "is_recommended": is_rec,
                    "marker-color": "#059669" if is_rec else "#0d9488",
                    "marker-symbol": "star" if is_rec else "circle",
                    "lat": c_lat,
                    "lon": c_lon,
                    "sst_celsius": c.get("sst_c"),
                    "chlorophyll_mg_m3": c.get("chlorophyll_mg_m3"),
                    "suitability_score": c.get("evaluated_suitability", c.get("suitability_score")),
                    "fish_density_index": c.get("fish_density_index"),
                    "bearing_deg": nav_bearing,
                    "distance_km": nav_dist,
                    "distance_user_km": nav_dist,
                    "bearing_user_deg": nav_bearing,
                    "calculated_distance_km": nav_dist,
                    "calculated_bearing_deg": nav_bearing,
                    "source_distance_km": source_dist,
                    "source_bearing_deg": source_bearing,
                    "target_species": c.get("target_species", []),
                    "is_in_restricted_zone": in_restricted,
                    "ocean_feature": c.get("feature", ""),
                    "depth_m": c.get("depth_m")
                }
            })

        # 3. Navigational Vector LineString (connects to Recommended PFZ if coords available)
        if has_coords and rec_lat is not None and rec_lon is not None:
            features.append({
                "type": "Feature",
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [u_lon, u_lat],
                        [rec_lon, rec_lat]
                    ]
                },
                "properties": {
                    "id": "nav-course-vector",
                    "title": f"Course Vector ({rec_nav_dist} km @ {rec_nav_bearing}°)",
                    "stroke": "#0284c7",
                    "stroke-width": 2.5,
                    "stroke-dasharray": "5, 5",
                    "distance_km": rec_nav_dist,
                    "bearing_deg": rec_nav_bearing,
                    "target_pfz_id": rec_id
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
            lats = [u_lat]
            lons = [u_lon]
            for f in features:
                if f.get("properties", {}).get("category") == "pfz":
                    coords = f.get("geometry", {}).get("coordinates")
                    if coords and len(coords) >= 2:
                        lons.append(coords[0])
                        lats.append(coords[1])
            margin = 0.25
            min_lon = min(lons) - margin
            max_lon = max(lons) + margin
            min_lat = min(lats) - margin
            max_lat = max(lats) + margin
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
