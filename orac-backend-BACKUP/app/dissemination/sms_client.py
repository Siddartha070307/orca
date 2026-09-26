"""SMS dissemination client for near-shore fishermen.

Enforces standard 160-character GSM SMS constraint.
Includes an interface for pluggable SMS gateways (Fast2SMS / Twilio / NIC SMS Gateway).
"""
from abc import ABC, abstractmethod
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)


class SMSGateway(ABC):
    """Abstract interface for carrier SMS transmission."""

    @abstractmethod
    def send_sms(self, recipient: str, text: str) -> Dict[str, Any]:
        pass


class MockSMSGateway(SMSGateway):
    """Simulated SMS transmission gateway logging output and checking character limits."""

    def send_sms(self, recipient: str, text: str) -> Dict[str, Any]:
        char_count = len(text)
        is_compliant = char_count <= 160
        logger.info(f"[SMS DISPATCH] Recipient: {recipient} | Length: {char_count} chars | Message: {text}")

        return {
            "status": "DELIVERED_SIMULATED",
            "gateway": "ORCA-MockSMSGateway",
            "recipient": recipient,
            "char_count": char_count,
            "within_160_limit": is_compliant,
            "text": text
        }


def format_near_shore_sms(
    verdict: str,
    location_name: str,
    wind_kmh: Optional[float] = 15.0,
    wave_m: Optional[float] = 1.2,
    pfz_distance_km: float = 0,
    pfz_bearing_deg: int = 0
) -> str:
    """Formats an ultra-compact SMS alert guaranteed to fit in <= 160 characters."""
    wind_val = wind_kmh if wind_kmh is not None else 0.0
    wave_val = wave_m if wave_m is not None else 0.0
    loc_short = (location_name or "Sea")[:8].upper()
    v_code = verdict.upper()

    if v_code == "UNSAFE":
        msg = f"[ORCA: DANGER] {loc_short}: Sea UNSAFE! Wind {wind_val:.0f}km/h, Wave {wave_val:.1f}m. DO NOT venture out. Return to harbor. CoastGuard: 1554"
    elif v_code == "CAUTION":
        msg = f"[ORCA: CAUTION] {loc_short}: Wind {wind_val:.0f}km/h, Wave {wave_val:.1f}m. Rough sea. Mechanized boats only with VHF. Nearest PFZ {pfz_distance_km:.0f}km@{pfz_bearing_deg}deg"
    else:
        msg = f"[ORCA: SAFE] {loc_short}: Sea SAFE. Wind {wind_val:.0f}km/h, Wave {wave_val:.1f}m. PFZ {pfz_distance_km:.0f}km@{pfz_bearing_deg}deg. Good catch potential. Wear lifejacket"

    # Truncate strictly at 160 if needed
    return msg[:160]


sms_gateway = MockSMSGateway()
