import re
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Tuple
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.db import OtpVerification
from app.services.auth_security import (
    generate_numeric_otp,
    hash_otp,
    verify_otp_hash,
    normalize_phone,
    normalize_email
)
from app.services.email_service import email_provider

logger = logging.getLogger("orca.otp")

# Dispatch outcome modes reported to clients (kept honest: never claim live delivery
# unless a real gateway actually accepted the message).
MODE_DEVELOPMENT = "development"  # AUTH_DEV_MODE: code exposed to the client, console delivery
MODE_SIMULATED = "simulated"      # non-dev run with a simulated/log-only channel: NOT delivered
MODE_LIVE = "live"                # a configured external gateway accepted the message


@dataclass
class OtpDispatchResult:
    """Outcome of an OTP generation + dispatch attempt.

    status_code is only meaningful when success is False:
      429 = rate limited (cooldown), 503 = dispatch infrastructure failure.
    """
    success: bool
    message: str
    dev_otp: Optional[str] = None
    cooldown_seconds: int = 0
    mode: str = MODE_DEVELOPMENT
    status_code: int = 429


def dispatch_mode(provider_name: Optional[str]) -> str:
    """Classifies the configured dispatch channel honestly (development | simulated | live)."""
    if settings.AUTH_DEV_MODE:
        return MODE_DEVELOPMENT
    name = (provider_name or "development").lower()
    if name in ("twilio", "msg91", "smtp"):
        # External gateway explicitly configured; delivery is attempted for real.
        return MODE_LIVE
    return MODE_SIMULATED


class OtpProvider(ABC):
    """Abstract interface for multi-channel OTP dispatch providers."""

    @abstractmethod
    async def send_otp(self, identifier: str, otp: str, purpose: str) -> bool:
        """
        Dispatches an OTP code to a recipient identifier (phone or email).
        Returns True only when the dispatch was genuinely accepted for delivery
        (a real gateway in live mode, or the explicitly simulated development
        channel while AUTH_DEV_MODE is enabled). Returns False when the code
        could NOT be handed to any channel — callers must not claim delivery.
        """
        pass


class DevelopmentOtpProvider(OtpProvider):
    """
    Local development provider.
    Logs OTP to console (dev mode only) and stores in-memory for test inspection.
    Never calls external SMS/email APIs, and never pretends to.
    """

    def __init__(self):
        self._sent_cache: Dict[str, str] = {}

    async def send_otp(self, identifier: str, otp: str, purpose: str) -> bool:
        if settings.AUTH_DEV_MODE:
            logger.info(
                f"[DEVELOPMENT OTP DISPATCH] "
                f"Purpose: {purpose} | Destination: {identifier} | OTP: {otp} | "
                f"Delivery: simulated console output only (no external SMS/Email gateway configured)"
            )
            self._sent_cache[f"{purpose}:{identifier}"] = otp
            return True
        # Production run on the development channel: accept the dispatch ONLY as an
        # explicitly simulated one. The code is never logged and never returned to the
        # client, so nothing about the recipient's OTP can leak; callers must report
        # mode="simulated" and state clearly that nothing was actually delivered.
        logger.warning(
            f"[SIMULATED OTP DISPATCH - NOT DELIVERED] Purpose: {purpose} | Destination: {identifier} | "
            f"Provider 'development' does not deliver outside AUTH_DEV_MODE; no SMS/Email was sent. "
            f"Configure a live SMS/Email provider for production delivery."
        )
        return True

    def get_last_otp(self, identifier: str, purpose: str) -> Optional[str]:
        return self._sent_cache.get(f"{purpose}:{identifier}")


class TwilioOtpProvider(OtpProvider):
    """Placeholder architecture for Twilio SMS API integration."""

    def __init__(self, account_sid: Optional[str] = None, auth_token: Optional[str] = None):
        self.account_sid = account_sid or settings.SMS_API_KEY
        self.auth_token = auth_token or settings.SMS_API_SECRET

    async def send_otp(self, identifier: str, otp: str, purpose: str) -> bool:
        if not self.account_sid or not self.auth_token:
            logger.error(
                f"[OTP NOT DELIVERED] Twilio credentials not configured (SMS_API_KEY/SMS_API_SECRET); "
                f"OTP for {purpose} was NOT sent to {identifier}."
            )
            return False
        logger.error(
            f"[OTP NOT DELIVERED] Twilio SMS integration is not implemented in this build; "
            f"OTP for {purpose} was NOT sent to {identifier} despite configured credentials."
        )
        return False


class Msg91OtpProvider(OtpProvider):
    """Placeholder architecture for MSG91 SMS API integration."""

    def __init__(self, auth_key: Optional[str] = None):
        self.auth_key = auth_key or settings.SMS_API_KEY

    async def send_otp(self, identifier: str, otp: str, purpose: str) -> bool:
        if not self.auth_key:
            logger.error(
                f"[OTP NOT DELIVERED] MSG91 credentials not configured (SMS_API_KEY); "
                f"OTP for {purpose} was NOT sent to {identifier}."
            )
            return False
        logger.error(
            f"[OTP NOT DELIVERED] MSG91 integration is not implemented in this build; "
            f"OTP for {purpose} was NOT sent to {identifier} despite configured credentials."
        )
        return False


def get_otp_provider() -> OtpProvider:
    """Factory creating the configured OTP provider instance."""
    provider_name = (settings.OTP_PROVIDER or "development").lower()
    if provider_name == "twilio":
        return TwilioOtpProvider()
    elif provider_name == "msg91":
        return Msg91OtpProvider()
    return DevelopmentOtpProvider()


otp_provider = get_otp_provider()


class OtpService:
    """Orchestrates OTP generation, cooldowns, attempts, and verification state."""

    @staticmethod
    async def generate_and_send_otp(
        db: Session,
        identifier: str,
        purpose: str,
        user_id: Optional[str] = None
    ) -> OtpDispatchResult:
        """
        Creates an OTP record and dispatches it through the configured channel
        (email provider when the identifier is an email address, SMS provider otherwise).
        Dispatch reporting is honest: the returned message/mode never claims live
        delivery unless a real gateway actually accepted the message.
        """
        now = datetime.now(timezone.utc)
        clean_id = normalize_phone(identifier) if identifier.startswith("+") or any(c.isdigit() for c in identifier) and "@" not in identifier else normalize_email(identifier)

        # Check for active record with unexpired cooldown
        recent_record = db.query(OtpVerification).filter(
            OtpVerification.identifier == clean_id,
            OtpVerification.purpose == purpose,
            OtpVerification.is_verified == False
        ).order_by(OtpVerification.created_at.desc()).first()

        if recent_record:
            # Check resend cooldown
            # Convert resend_after to timezone-aware if needed
            resend_after = recent_record.resend_after
            if resend_after.tzinfo is None:
                resend_after = resend_after.replace(tzinfo=timezone.utc)
            
            if now < resend_after:
                remaining = int((resend_after - now).total_seconds())
                return OtpDispatchResult(
                    success=False,
                    message=f"Please wait {remaining} seconds before requesting another OTP.",
                    cooldown_seconds=remaining,
                    mode=dispatch_mode(settings.OTP_PROVIDER),
                    status_code=429
                )

        # Invalidate any prior active OTPs for the same identifier and purpose
        db.query(OtpVerification).filter(
            OtpVerification.identifier == clean_id,
            OtpVerification.purpose == purpose,
            OtpVerification.is_verified == False
        ).update({"expires_at": now})
        db.commit()

        # Generate fresh OTP
        raw_otp = generate_numeric_otp(6)
        hashed = hash_otp(raw_otp, salt=clean_id)
        expires_at = now + timedelta(seconds=settings.OTP_EXPIRY_SECONDS)
        resend_after = now + timedelta(seconds=settings.OTP_RESEND_COOLDOWN_SECONDS)

        new_record = OtpVerification(
            identifier=clean_id,
            user_id=user_id,
            purpose=purpose,
            otp_hash=hashed,
            expires_at=expires_at,
            attempt_count=0,
            max_attempts=settings.OTP_MAX_ATTEMPTS,
            resend_after=resend_after,
            is_verified=False,
            created_at=now
        )
        db.add(new_record)
        db.commit()

        # Dispatch through the right channel for this identifier
        is_email = "@" in clean_id
        channel_name = (settings.EMAIL_PROVIDER if is_email else settings.OTP_PROVIDER) or "development"
        if is_email:
            delivered = await email_provider.send_otp_email(clean_id, raw_otp, purpose)
            channel_label = "email"
        else:
            delivered = await otp_provider.send_otp(clean_id, raw_otp, purpose)
            channel_label = "SMS"

        mode = dispatch_mode(channel_name)

        # Expose dev OTP only in explicit development mode
        dev_otp_value = raw_otp if settings.AUTH_DEV_MODE else None

        if not delivered:
            return OtpDispatchResult(
                success=False,
                message=(
                    f"OTP dispatch failed: the configured {channel_label} provider could not "
                    f"accept the code, so it was NOT delivered to {clean_id}. "
                    f"Configure a live provider (or enable AUTH_DEV_MODE for local testing) and try again."
                ),
                dev_otp=None,
                cooldown_seconds=settings.OTP_RESEND_COOLDOWN_SECONDS,
                mode=mode,
                status_code=503
            )

        if mode == MODE_DEVELOPMENT:
            message = (
                f"OTP generated for {clean_id} (development mode: the code is returned in this "
                f"response instead of being sent over {channel_label})."
            )
        elif mode == MODE_SIMULATED:
            message = (
                f"OTP generated for {clean_id}. {channel_label} delivery is simulated in this "
                f"deployment — the code was NOT actually sent."
            )
        else:
            message = f"OTP dispatched to {clean_id} via {channel_label}."

        return OtpDispatchResult(
            success=True,
            message=message,
            dev_otp=dev_otp_value,
            cooldown_seconds=settings.OTP_RESEND_COOLDOWN_SECONDS,
            mode=mode
        )

    @staticmethod
    def verify_otp(
        db: Session,
        identifier: str,
        purpose: str,
        otp_code: str
    ) -> Tuple[bool, str]:
        """
        Validates OTP, enforcing max attempts, expiration, and single-use invalidation.
        Returns (is_valid, error_or_success_message).
        """
        clean_otp = (otp_code or "").strip()
        if not re.match(r"^\d{6}$", clean_otp):
            return False, "OTP must be exactly 6 numeric digits."

        now = datetime.now(timezone.utc)
        clean_id = normalize_phone(identifier) if identifier.startswith("+") or any(c.isdigit() for c in identifier) and "@" not in identifier else normalize_email(identifier)

        # Find latest pending OTP record for identifier & purpose
        record = db.query(OtpVerification).filter(
            OtpVerification.identifier == clean_id,
            OtpVerification.purpose == purpose,
            OtpVerification.is_verified == False
        ).order_by(OtpVerification.created_at.desc()).first()

        if not record:
            return False, "No active OTP request found. Please request a new OTP."

        # Check expiration
        expires_at = record.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)

        if now > expires_at:
            return False, "OTP has expired. Please request a new OTP."

        # Check attempt count limit
        if record.attempt_count >= record.max_attempts:
            return False, "Maximum verification attempts exceeded. Please request a new OTP."

        # Increment attempt count
        record.attempt_count += 1

        # Check OTP hash match
        is_match = verify_otp_hash(clean_otp, record.otp_hash, salt=clean_id)
        if not is_match:
            remaining = record.max_attempts - record.attempt_count
            db.commit()
            if remaining <= 0:
                return False, "Incorrect OTP. Maximum attempts reached. Please request a new OTP."
            return False, f"Incorrect OTP. You have {remaining} attempt(s) remaining."

        # Successful verification: mark verified and invalidate
        record.is_verified = True
        record.verified_at = now
        db.commit()
        return True, "OTP verified successfully."

    @staticmethod
    def has_valid_recent_verification(
        db: Session,
        identifier: str,
        purpose: str,
        validity_minutes: int = 15
    ) -> bool:
        """
        Checks whether the given identifier was successfully verified
        for the specified purpose within the last N minutes.
        """
        now = datetime.now(timezone.utc)
        cutoff = now - timedelta(minutes=validity_minutes)
        clean_id = normalize_phone(identifier) if identifier.startswith("+") or any(c.isdigit() for c in identifier) and "@" not in identifier else normalize_email(identifier)

        record = db.query(OtpVerification).filter(
            OtpVerification.identifier == clean_id,
            OtpVerification.purpose == purpose,
            OtpVerification.is_verified == True,
            OtpVerification.verified_at >= cutoff
        ).order_by(OtpVerification.verified_at.desc()).first()

        return record is not None

