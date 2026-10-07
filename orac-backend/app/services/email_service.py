"""Email Provider abstraction, development (simulated) provider, and SMTP delivery for ORCA."""
import asyncio
import logging
import smtplib
from abc import ABC, abstractmethod
from email.message import EmailMessage
from typing import Optional, List, Dict
from app.core.config import settings

logger = logging.getLogger("orca.email")


class EmailProvider(ABC):
    """Abstract interface for transactional email dispatch."""

    @abstractmethod
    async def send_email(
        self,
        to_email: str,
        subject: str,
        text_content: str,
        html_content: Optional[str] = None
    ) -> bool:
        """Dispatches an email. Returns True only when delivery was accepted (real
        delivery, or the explicitly simulated development channel), False otherwise."""
        pass

    @abstractmethod
    async def send_welcome_email(self, to_email: str, full_name: str, role: str) -> bool:
        """Sends the standardized ORCA welcome notification."""
        pass

    @abstractmethod
    async def send_otp_email(self, to_email: str, otp: str, purpose: str) -> bool:
        """Sends an OTP authentication code via email."""
        pass


class DevelopmentEmailProvider(EmailProvider):
    """
    Local development email provider.
    Logs email details without invoking external SMTP or third-party email APIs.
    """

    def __init__(self):
        self.sent_emails: List[Dict[str, str]] = []

    async def send_email(
        self,
        to_email: str,
        subject: str,
        text_content: str,
        html_content: Optional[str] = None
    ) -> bool:
        if settings.AUTH_DEV_MODE:
            logger.info(
                f"[DEVELOPMENT EMAIL DISPATCH - simulated]\n"
                f"From: {settings.EMAIL_FROM}\n"
                f"To: {to_email}\n"
                f"Subject: {subject}\n"
                f"Body:\n{text_content}\n"
                f"----------------------------------------"
            )
            self.sent_emails.append({
                "to": to_email,
                "subject": subject,
                "text": text_content,
                "html": html_content or text_content
            })
            return True
        # Non-dev run on the development channel: explicitly simulated, nothing delivered.
        # Subject/body are withheld from logs so transactional content (e.g. OTP codes)
        # is never written to production logs.
        logger.warning(
            f"[SIMULATED EMAIL DISPATCH - NOT DELIVERED] From: {settings.EMAIL_FROM} | "
            f"To: {to_email} | Provider 'development' does not send real email outside "
            f"AUTH_DEV_MODE. Configure EMAIL_PROVIDER=smtp for production delivery."
        )
        return True

    async def send_welcome_email(self, to_email: str, full_name: str, role: str) -> bool:
        subject = f"Welcome to ORCA Marine Intelligence — Your {role.capitalize()} Account"
        text_body = (
            f"Congratulations, {full_name}!\n\n"
            f"Your ORCA {role} account has been successfully created.\n\n"
            f"Welcome to ORCA — Marine Ecosystem Reasoning with Collaborative Agents.\n\n"
            f"Username / Registered Email:\n{to_email}\n\n"
            f"You can now log in using the email/mobile number and the password you created during registration.\n\n"
            f"Regards,\n"
            f"ORCA Team (SIH 26176 / ISRO)"
        )
        return await self.send_email(to_email=to_email, subject=subject, text_content=text_body)

    async def send_otp_email(self, to_email: str, otp: str, purpose: str) -> bool:
        if not settings.AUTH_DEV_MODE:
            # Never write OTP codes to non-dev logs and never claim delivery that did not happen.
            logger.warning(
                f"[SIMULATED OTP EMAIL - NOT DELIVERED] To: {to_email} | Purpose: {purpose} | "
                f"Development email provider does not deliver outside AUTH_DEV_MODE."
            )
            return True
        subject = f"Your ORCA Verification Code: {otp}"
        text_body = (
            f"Hello,\n\n"
            f"Your one-time verification code (OTP) for {purpose.replace('_', ' ')} is:\n\n"
            f"    {otp}\n\n"
            f"This code will expire in {settings.OTP_EXPIRY_SECONDS // 60} minutes.\n"
            f"If you did not request this code, please ignore this email.\n\n"
            f"Regards,\n"
            f"ORCA Security Team"
        )
        return await self.send_email(to_email=to_email, subject=subject, text_content=text_body)


class SmtpEmailProvider(EmailProvider):
    """SMTP email delivery via the standard library (STARTTLS, optional auth)."""

    def __init__(self):
        self.host = settings.SMTP_HOST
        self.port = settings.SMTP_PORT
        self.user = settings.SMTP_USER
        self.password = settings.SMTP_PASSWORD

    def _deliver_sync(
        self,
        to_email: str,
        subject: str,
        text_content: str,
        html_content: Optional[str] = None
    ) -> None:
        """Blocking SMTP delivery; executed off the event loop."""
        msg = EmailMessage()
        msg["From"] = settings.EMAIL_FROM
        msg["To"] = to_email
        msg["Subject"] = subject
        msg.set_content(text_content)
        if html_content:
            msg.add_alternative(html_content, subtype="html")
        with smtplib.SMTP(self.host, self.port, timeout=15) as server:
            server.ehlo()
            try:
                server.starttls()
                server.ehlo()
            except smtplib.SMTPNotSupportedError:
                # Server does not support STARTTLS; still delivers, but unencrypted.
                logger.warning("SMTP server does not support STARTTLS; sending without transport encryption.")
            if self.user and self.password:
                server.login(self.user, self.password)
            server.send_message(msg)

    async def send_email(
        self,
        to_email: str,
        subject: str,
        text_content: str,
        html_content: Optional[str] = None
    ) -> bool:
        if not self.host:
            logger.error(
                f"[EMAIL NOT DELIVERED] SMTP host not configured (SMTP_HOST is empty); "
                f"email '{subject}' was NOT sent to {to_email}."
            )
            return False
        try:
            await asyncio.to_thread(self._deliver_sync, to_email, subject, text_content, html_content)
            logger.info(f"[SMTP] Email delivered to {to_email}")
            return True
        except Exception as e:
            logger.error(f"[EMAIL NOT DELIVERED] SMTP delivery to {to_email} failed: {e}")
            return False

    async def send_welcome_email(self, to_email: str, full_name: str, role: str) -> bool:
        return await self.send_email(
            to_email,
            f"Welcome to ORCA Marine Intelligence",
            f"Welcome to ORCA, {full_name}!"
        )

    async def send_otp_email(self, to_email: str, otp: str, purpose: str) -> bool:
        subject = f"ORCA Code: {otp}"
        body = (
            f"Your one-time verification code for {purpose.replace('_', ' ')} is: {otp}\n\n"
            f"This code expires in {settings.OTP_EXPIRY_SECONDS // 60} minutes. "
            f"If you did not request it, ignore this message."
        )
        return await self.send_email(to_email, subject, body)


def get_email_provider() -> EmailProvider:
    """Factory creating the active email provider instance."""
    provider_name = (settings.EMAIL_PROVIDER or "development").lower()
    if provider_name == "smtp":
        return SmtpEmailProvider()
    return DevelopmentEmailProvider()


email_provider = get_email_provider()

