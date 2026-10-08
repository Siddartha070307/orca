"""SMS dissemination clients for ORCA.

Supports:
- Mock SMS gateway for development/tests
- TextBee real SMS gateway for live SMS transmission

The gateway is selected through SMS_PROVIDER in the backend environment.
"""

from abc import ABC, abstractmethod
import logging
from typing import Dict, Any, Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


class SMSGateway(ABC):
    """Abstract interface for carrier SMS transmission."""

    @abstractmethod
    def send_sms(self, recipient: str, text: str) -> Dict[str, Any]:
        pass


class MockSMSGateway(SMSGateway):
    """Simulated SMS transmission gateway."""

    def send_sms(self, recipient: str, text: str) -> Dict[str, Any]:
        char_count = len(text)
        is_compliant = char_count <= 160

        logger.info(
            "[SMS DISPATCH - MOCK] Recipient: %s | Length: %s | Message: %s",
            recipient,
            char_count,
            text
        )

        return {
            "success": is_compliant,
            "status": "DELIVERED_SIMULATED",
            "gateway": "ORCA-MockSMSGateway",
            "recipient": recipient,
            "char_count": char_count,
            "within_160_limit": is_compliant,
            "text": text
        }


class TextBeeSMSGateway(SMSGateway):
    """Real SMS gateway backed by TextBee.dev."""

    def __init__(
        self,
        api_key: str,
        base_url: str,
        device_id: Optional[str] = None,
        sim_subscription_id: Optional[int] = None,
        timeout_seconds: float = 15.0,
    ):
        self.api_key = api_key.strip()
        self.base_url = base_url.rstrip("/")
        self.device_id = device_id.strip() if device_id else None
        self.sim_subscription_id = sim_subscription_id
        self.timeout_seconds = timeout_seconds

    def send_sms(self, recipient: str, text: str) -> Dict[str, Any]:
        char_count = len(text)

        if char_count > 160:
            return {
                "success": False,
                "status": "FAILED",
                "gateway": "TextBee",
                "recipient": recipient,
                "char_count": char_count,
                "within_160_limit": False,
                "failure_reason": "Message exceeds the 160-character GSM limit.",
                "text": text,
            }

        payload = {
            "recipients": [recipient],
            "message": text,
        }

        if self.device_id:
            payload["deviceId"] = self.device_id

        if self.sim_subscription_id is not None:
            payload["simSubscriptionId"] = self.sim_subscription_id

        url = f"{self.base_url}/gateway/send-sms"

        headers = {
            "x-api-key": self.api_key,
            "Content-Type": "application/json",
        }

        logger.info(
            "[SMS DISPATCH - TEXTBEE] Recipient: %s | Length: %s",
            recipient,
            char_count,
        )

        try:
            response = httpx.post(
                url,
                headers=headers,
                json=payload,
                timeout=self.timeout_seconds,
            )
        except httpx.RequestError as exc:
            logger.error("TextBee request failed: %s", exc)

            return {
                "success": False,
                "status": "FAILED",
                "gateway": "TextBee",
                "recipient": recipient,
                "char_count": char_count,
                "within_160_limit": True,
                "failure_reason": f"TextBee connection failed: {exc}",
                "text": text,
            }

        try:
            response_data = response.json()
        except ValueError:
            response_data = {}

        if response.status_code != 200:
            provider_message = (
                response_data.get("message")
                or response_data.get("error")
                or f"TextBee returned HTTP {response.status_code}"
            )

            logger.error(
                "TextBee rejected SMS: HTTP %s - %s",
                response.status_code,
                provider_message,
            )

            return {
                "success": False,
                "status": "FAILED",
                "gateway": "TextBee",
                "recipient": recipient,
                "char_count": char_count,
                "within_160_limit": True,
                "failure_reason": provider_message,
                "text": text,
            }

        data = response_data.get("data") or {}
        sms_batch_id = data.get("smsBatchId")

        if data.get("success") is False:
            return {
                "success": False,
                "status": "FAILED",
                "gateway": "TextBee",
                "recipient": recipient,
                "char_count": char_count,
                "within_160_limit": True,
                "failure_reason": data.get("message") or "TextBee rejected the SMS.",
                "text": text,
            }

        logger.info(
            "TextBee accepted SMS for queue: recipient=%s batch=%s",
            recipient,
            sms_batch_id,
        )

        return {
            "success": True,
            "status": "QUEUED",
            "gateway": "TextBee",
            "recipient": recipient,
            "char_count": char_count,
            "within_160_limit": True,
            "provider_message_id": sms_batch_id,
            "text": text,
        }


def build_sms_gateway() -> SMSGateway:
    """Build the configured SMS gateway."""

    provider = (settings.SMS_PROVIDER or "mock").strip().lower()

    if provider == "textbee":
        if not settings.TEXTBEE_API_KEY:
            raise RuntimeError(
                "SMS_PROVIDER=textbee but TEXTBEE_API_KEY is not configured."
            )

        logger.info("ORCA SMS gateway: TextBee")

        return TextBeeSMSGateway(
            api_key=settings.TEXTBEE_API_KEY,
            base_url=settings.TEXTBEE_BASE_URL,
            device_id=settings.TEXTBEE_DEVICE_ID,
            sim_subscription_id=settings.TEXTBEE_SIM_SUBSCRIPTION_ID,
            timeout_seconds=settings.TEXTBEE_TIMEOUT_SECONDS,
        )

    logger.info("ORCA SMS gateway: Mock")
    return MockSMSGateway()


def format_near_shore_sms(
    verdict: str,
    location_name: str,
    wind_kmh: Optional[float] = 15.0,
    wave_m: Optional[float] = 1.2,
    pfz_distance_km: float = 0,
    pfz_bearing_deg: int = 0
) -> str:
    """Formats an ultra-compact SMS alert guaranteed to fit <=160 chars."""

    wind_val = wind_kmh if wind_kmh is not None else 0.0
    wave_val = wave_m if wave_m is not None else 0.0
    loc_short = (location_name or "Sea")[:8].upper()
    v_code = verdict.upper()

    if v_code == "UNSAFE":
        msg = (
            f"[ORCA: DANGER] {loc_short}: Sea UNSAFE! "
            f"Wind {wind_val:.0f}km/h, Wave {wave_val:.1f}m. "
            "DO NOT venture out. Return to harbor. CoastGuard: 1554"
        )
    elif v_code == "CAUTION":
        msg = (
            f"[ORCA: CAUTION] {loc_short}: Wind {wind_val:.0f}km/h, "
            f"Wave {wave_val:.1f}m. Rough sea. Mechanized boats only with VHF. "
            f"Nearest PFZ {pfz_distance_km:.0f}km@{pfz_bearing_deg}deg"
        )
    else:
        msg = (
            f"[ORCA: SAFE] {loc_short}: Sea SAFE. "
            f"Wind {wind_val:.0f}km/h, Wave {wave_val:.1f}m. "
            f"PFZ {pfz_distance_km:.0f}km@{pfz_bearing_deg}deg. "
            "Good catch potential. Wear lifejacket"
        )

    return msg[:160]


sms_gateway = build_sms_gateway()