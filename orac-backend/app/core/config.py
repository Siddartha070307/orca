"""Configuration management for ORCA marine intelligence backend."""
import logging
import secrets
from typing import Optional
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)

# Placeholder values that must never be used to sign tokens in any environment.
_SECRET_KEY_PLACEHOLDERS = {
    "change_me_to_a_long_random_secret",
    "replace-with-a-long-random-secret",
    "changeme",
    "secret",
}


class Settings(BaseSettings):
    # LLM Settings
    ANTHROPIC_API_KEY: Optional[str] = None
    CLAUDE_MODEL: str = "claude-3-5-sonnet-20241022"

    # Bhashini ULCA API Settings
    BHASHINI_USER_ID: Optional[str] = None
    BHASHINI_API_KEY: Optional[str] = None
    BHASHINI_PIPELINE_ID: Optional[str] = None
    BHASHINI_ULCA_URL: str = "https://dhruva-api.bhashini.gov.in/services/inference/pipeline"

    # Database Settings
    DATABASE_URL: str = "sqlite:///./orca.db"

    # Application Settings
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    DEBUG: bool = False
    APP_NAME: str = "ORCA Marine Intelligence Platform"
    APP_VERSION: str = "1.0.0"
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,http://127.0.0.1:3000"
    DEMO_DEFAULT_LOCATION_ENABLED: bool = True

    # Authentication & Security Settings
    # No hard-coded signing secret. Operators must provide SECRET_KEY via environment/.env
    # in production. When unset (local development / tests), an ephemeral random key is
    # generated at startup so tokens are still signed with an unpredictable value; such
    # tokens intentionally do not survive a process restart.
    SECRET_KEY: Optional[str] = None
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    AUTH_DEV_MODE: bool = False  # False by default; set to true in local .env for testing
    AUTH_COOKIE_SECURE: bool = False  # False in dev; set to true in production HTTPS
    AUTH_COOKIE_SAMESITE: str = "lax"

    # Administrator Bootstrap Settings (Part 1)
    ADMIN_EMAIL: str = "admin@orca-marine.gov.in"
    ADMIN_PASSWORD: Optional[str] = None  # Configured via env; no hard-coded production password in source code
    # Opt-in only: an administrator account is seeded solely when this is explicitly
    # enabled AND ADMIN_PASSWORD is provided via environment configuration.
    ADMIN_SEED_ENABLED: bool = False

    # OTP Provider Settings
    OTP_PROVIDER: str = "development"
    OTP_EXPIRY_SECONDS: int = 300  # 5 minutes
    OTP_MAX_ATTEMPTS: int = 5
    OTP_RESEND_COOLDOWN_SECONDS: int = 30

    # SMS Integration
    SMS_PROVIDER: str = "mock"

    # Legacy provider compatibility (deprecated aliases for older integrations)
    SMS_API_KEY: Optional[str] = None
    SMS_API_SECRET: Optional[str] = None

    # TextBee SMS Gateway
    TEXTBEE_API_KEY: Optional[str] = None
    TEXTBEE_BASE_URL: str = "https://api.textbee.dev/api/v1"
    TEXTBEE_DEVICE_ID: Optional[str] = None
    TEXTBEE_SIM_SUBSCRIPTION_ID: Optional[int] = None
    TEXTBEE_TIMEOUT_SECONDS: float = 15.0
    TEXTBEE_WEBHOOK_SECRET: Optional[str] = None

    # Email Provider Settings
    EMAIL_PROVIDER: str = "development"
    EMAIL_FROM: str = "noreply@orca-marine.gov.in"
    EMAIL_PROVIDER_API_KEY: Optional[str] = None
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None

    # Session Settings
    SESSION_EXPIRY_SECONDS: int = 86400

    @model_validator(mode="after")
    def _resolve_secret_key(self) -> "Settings":
        """Refuse placeholder secrets; fall back to an ephemeral random key."""
        key = (self.SECRET_KEY or "").strip()
        if not key or key.lower() in _SECRET_KEY_PLACEHOLDERS:
            if key.lower() in _SECRET_KEY_PLACEHOLDERS:
                logger.error(
                    "SECRET_KEY is a well-known placeholder value; refusing to use it for token signing."
                )
            self.SECRET_KEY = secrets.token_urlsafe(48)
            logger.warning(
                "SECRET_KEY is not set. Generated an ephemeral random signing key for this process; "
                "all sessions/JWTs will be invalidated on restart. "
                "Set a persistent SECRET_KEY in the environment for production deployments."
            )
        return self

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()
