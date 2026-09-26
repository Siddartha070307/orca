"""Dissemination Router.

Directs compiled marine advisories and telemetry to the appropriate transmission channel:
1. 'app': Rich interactive JSON for modern web / mobile dashboard.
2. 'boat_near_shore': Compact GSM SMS string (under 160 characters) for 2G marine feature phones.
3. 'boat_open_sea': Compact NMEA binary frame simulating ISRO NAVIC / MSS satellite uplink for deep-sea vessels beyond cellular reach.
"""
import logging
import math
from typing import Dict, Any
from app.models.schemas import DispatchedPayload, AgentResult
from app.dissemination.sms_client import sms_gateway, format_near_shore_sms
from app.dissemination.satellite_client import satellite_client

logger = logging.getLogger(__name__)


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


class DisseminationRouter:
    """Dispatches marine intelligence based on vessel profile and connectivity tier."""

    async def route(
        self,
        user_type: str,
        verdict: str,
        location_name: str,
        location_coords: Dict[str, float],
        report_text: str,
        weather_result: AgentResult,
        ocean_result: AgentResult
    ) -> DispatchedPayload:
        w_payload = weather_result.result if (weather_result and weather_result.result) else {}
        w_metrics = w_payload.get("metrics", {})
        wind = w_metrics.get("wind_speed_kmh")
        if wind is None:
            wind = 15.0
        wave = w_metrics.get("wave_height_m")
        if wave is None:
            wave = 1.2

        pfz_candidates = ocean_result.result.get("candidates", [])
        recommended = ocean_result.result.get("recommended_pfz") or (pfz_candidates[0] if pfz_candidates else {})

        # Coordinate availability check
        has_user_coords = bool(
            location_coords
            and isinstance(location_coords, dict)
            and location_coords.get("lat") is not None
            and location_coords.get("lon") is not None
        )
        has_pfz_coords = bool(
            recommended
            and isinstance(recommended, dict)
            and recommended.get("lat") is not None
            and recommended.get("lon") is not None
        )

        if has_user_coords and has_pfz_coords:
            u_lat = float(location_coords["lat"])
            u_lon = float(location_coords["lon"])
            p_lat = float(recommended["lat"])
            p_lon = float(recommended["lon"])
            pfz_dist = round(_haversine_km(u_lat, u_lon, p_lat, p_lon), 1)
            pfz_bearing = _calculate_bearing(u_lat, u_lon, p_lat, p_lon)
        else:
            # When coordinates are not available, use explicit normalized dynamic fields only;
            # NEVER treat an ambiguous source/bulletin distance_km or bearing_deg as vessel-relative navigation data
            pfz_dist = recommended.get("distance_user_km") or recommended.get("calculated_distance_km") or 0.0
            pfz_bearing = recommended.get("bearing_user_deg") or recommended.get("calculated_bearing_deg") or 0

        # Channel 1: Mobile / Web App (Primary demo path)
        if user_type == "app":
            return DispatchedPayload(
                channel="app",
                status="DELIVERED_IN_RESPONSE",
                content={
                    "format": "rich_dashboard",
                    "text_summary": report_text,
                    "target_ui": "ORCA Web/Mobile Client",
                    "protocol": "HTTPS_REST_API"
                },
                metadata={
                    "resolution": "high",
                    "includes_interactive_geojson": True,
                    "includes_charts": True
                }
            )

        # Channel 2: Boat Near Shore (SMS <= 160 chars)
        elif user_type == "boat_near_shore":
            sms_text = format_near_shore_sms(
                verdict=verdict,
                location_name=location_name,
                wind_kmh=wind,
                wave_m=wave,
                pfz_distance_km=pfz_dist,
                pfz_bearing_deg=pfz_bearing
            )
            # Send through pluggable SMS gateway
            dispatch_info = sms_gateway.send_sms(recipient="+91-COMMUNITY-BROADCAST", text=sms_text)
            return DispatchedPayload(
                channel="boat_near_shore",
                status="DISPATCHED_SMS",
                content=dispatch_info,
                metadata={
                    "carrier": "GSM Cellular",
                    "char_limit": 160,
                    "char_count": len(sms_text),
                    "raw_sms": sms_text
                }
            )

        # Channel 3: Boat Open Sea (Simulated ISRO NAVIC / MSS Satellite Broadcast)
        elif user_type == "boat_open_sea":
            lat = location_coords.get("lat", 12.87)
            lon = location_coords.get("lon", 74.84)
            sat_record = satellite_client.dispatch_navic_alert(
                lat=lat,
                lon=lon,
                verdict=verdict,
                wind_kmh=wind,
                wave_m=wave,
                pfz_bearing=pfz_bearing,
                pfz_dist_km=pfz_dist
            )
            return DispatchedPayload(
                channel="boat_open_sea",
                status="DISPATCHED_SATELLITE",
                content=sat_record,
                metadata={
                    "protocol": "ISRO NAVIC / MSS DAT Telegram",
                    "uplink_verified": True,
                    "is_simulated": True,
                    "stand_in_note": "Simulated NAVIC S-Band transmission stand-in for government satellite API"
                }
            )

        # Default fallback to App
        return DispatchedPayload(
            channel=user_type,
            status="DELIVERED_IN_RESPONSE",
            content={"message": report_text},
            metadata={}
        )


dissemination_router = DisseminationRouter()
