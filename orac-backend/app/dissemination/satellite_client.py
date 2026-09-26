"""Simulated ISRO NAVIC / MSS / DAT (Distress Alert Transmitter) Satellite Dissemination.

========================================================================================
NOTE: STAND-IN FOR REAL GOVERNMENT SATELLITE INTEGRATION
In production, this module packages telemetry into compact NMEA/binary frames and uplinks
via ISRO GSAT-6 / NAVIC MSS (Mobile Satellite Services) or INCOIS S-Band ocean broadcast.
========================================================================================
"""
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)


class SatelliteClient:
    """Dispatches low-bandwidth telemetry packets over simulated satellite downlink."""

    @staticmethod
    def _compute_nmea_checksum(sentence: str) -> str:
        """Computes XOR checksum for NMEA standard formatting."""
        csum = 0
        for char in sentence:
            csum ^= ord(char)
        return f"{csum:02X}"

    def dispatch_navic_alert(
        self,
        lat: float,
        lon: float,
        verdict: str,
        wind_kmh: Optional[float],
        wave_m: Optional[float],
        pfz_bearing: int,
        pfz_dist_km: float
    ) -> Dict[str, Any]:
        """Encodes and simulates uplink of a NAVIC short-burst data frame."""
        now = datetime.now(timezone.utc)
        timestamp_str = now.strftime("%H%M%S")
        v_code = {"SAFE": 0, "CAUTION": 1, "UNSAFE": 2}.get(verdict, 1)
        wind_val = wind_kmh if wind_kmh is not None else 0.0
        wave_val = wave_m if wave_m is not None else 0.0

        # Structure NMEA-like compact marine frame
        # $ORCA,TIME,LAT,LON,VERDICT,WIND_KMH,WAVE_M,PFZ_BEAR,PFZ_DIST
        body = f"ORCA,{timestamp_str},{lat:.4f},{lon:.4f},{v_code},{wind_val:.1f},{wave_val:.1f},{pfz_bearing},{pfz_dist_km:.1f}"
        checksum = self._compute_nmea_checksum(body)
        raw_telegram = f"${body}*{checksum}"

        dispatch_record = {
            "protocol": "ISRO_NAVIC_MSS_SATELLITE_SIMULATED",
            "frequency_band": "S-Band (2.5 GHz MSS Uplink)",
            "satellite_constellation": "NavIC / IRNSS-1I / GSAT-6",
            "coverage_zone": "Indian Ocean Region (IOR) & EEZ",
            "raw_telegram": raw_telegram,
            "decoded_telemetry": {
                "utc_time": now.isoformat(),
                "vessel_lat": lat,
                "vessel_lon": lon,
                "verdict_code": v_code,
                "verdict_label": verdict,
                "wind_speed_kmh": wind_kmh,
                "wave_height_m": wave_m,
                "pfz_vector": f"{pfz_dist_km:.1f} km @ {pfz_bearing}°"
            },
            "dispatch_status": "BROADCAST_TRANSMITTED_SIMULATED"
        }

        logger.info(f"[NAVIC SATELLITE DISPATCH] Telegram: {raw_telegram} | Sector: ({lat}, {lon})")
        return dispatch_record


satellite_client = SatelliteClient()
