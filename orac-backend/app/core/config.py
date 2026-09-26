"""Configuration management for ORCA marine intelligence backend."""
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


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
    CORS_ORIGINS: str = "*"
    DEMO_DEFAULT_LOCATION_ENABLED: bool = True

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()
