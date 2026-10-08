"""SQLAlchemy database models and session setup."""
from datetime import datetime, timezone
import logging
import uuid
from sqlalchemy import (
    create_engine, Column, Integer, String, Float, DateTime, Text, JSON,
    Boolean, ForeignKey, UniqueConstraint, inspect as sqlalchemy_inspect, text
)
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from app.core.config import settings

logger = logging.getLogger("orca.db")

Base = declarative_base()


class User(Base):
    """Core user account model across all ORCA personas."""
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    role = Column(String(20), nullable=False, index=True)  # fisherman, researcher, authority
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=True)
    full_name = Column(String(200), nullable=False)
    phone_number = Column(String(20), unique=True, index=True, nullable=True)
    email = Column(String(255), unique=True, index=True, nullable=True)
    password_hash = Column(String(255), nullable=True)  # Nullable for OTP-only fisherman login
    is_active = Column(Boolean, default=True, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False
    )
    last_login_at = Column(DateTime, nullable=True)

    # Profile Relationships
    fisherman_profile = relationship("FishermanProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    researcher_profile = relationship("ResearcherProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    authority_profile = relationship("AuthorityProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    sessions = relationship("SessionRecord", back_populates="user", cascade="all, delete-orphan")


class FishermanProfile(Base):
    """Operational profile attributes for registered fishermen."""
    __tablename__ = "fisherman_profiles"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    age = Column(Integer, nullable=False)
    location = Column(String(200), nullable=False)
    vessel_name = Column(String(100), nullable=True)
    vessel_registration_number = Column(String(50), nullable=True)
    fishing_type = Column(String(50), nullable=True)
    preferred_language = Column(String(20), default="en", nullable=False)
    emergency_contact = Column(String(20), nullable=True)

    # --- Registration add-ons (integrated from the reference vessel.zip
    # --- registration flow, adapted to ORCA's existing profile table).
    # --- Additive columns only: no new tables, users, or role models.
    government_id_type = Column(String(30), nullable=True)          # e.g. Aadhaar / Voter ID / Fishing licence
    government_id_number = Column(String(50), nullable=True)
    emergency_contact_name = Column(String(100), nullable=True)
    emergency_contact_relation = Column(String(50), nullable=True)  # e.g. Spouse, Parent, Crew
    safety_tracking_consent = Column(Boolean, default=False, nullable=False)

    user = relationship("User", back_populates="fisherman_profile")


# Columns added after the first release of `fisherman_profiles`.
# Base.metadata.create_all() never alters an existing table, so these are
# appended with a guarded ALTER TABLE on startup (additive, never destructive).
FISHERMAN_PROFILE_ADDITIVE_COLUMNS = (
    ("government_id_type", "VARCHAR(30)"),
    ("government_id_number", "VARCHAR(50)"),
    ("emergency_contact_name", "VARCHAR(100)"),
    ("emergency_contact_relation", "VARCHAR(50)"),
    ("safety_tracking_consent", "BOOLEAN DEFAULT FALSE"),
)


class ResearcherProfile(Base):
    """Scientific research profile attributes."""
    __tablename__ = "researcher_profiles"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    area_of_research = Column(String(200), nullable=False)
    institution = Column(String(200), nullable=True)
    research_specialization = Column(String(200), nullable=True)

    user = relationship("User", back_populates="researcher_profile")


class AuthorityProfile(Base):
    """Enforcement and surveillance profile for Port Authorities and Coast Guard."""
    __tablename__ = "authority_profiles"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    designation = Column(String(100), nullable=False)
    department = Column(String(150), nullable=False)
    official_email = Column(String(255), unique=True, index=True, nullable=False)
    employee_id = Column(String(100), unique=True, index=True, nullable=False)
    state_region = Column(String(100), nullable=False)
    area_of_responsibility = Column(String(200), nullable=False)
    # Verification & Admin review status: pending, approved, rejected, suspended
    status = Column(String(20), default="pending", nullable=False, index=True)
    reviewed_by = Column(String(100), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    rejection_reason = Column(String(500), nullable=True)

    user = relationship("User", back_populates="authority_profile")


class OtpVerification(Base):
    """Secure OTP audit record with hashing, expiration, and rate-limiting counters."""
    __tablename__ = "otp_verifications"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    identifier = Column(String(255), nullable=False, index=True)  # Normalized phone or email
    user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    purpose = Column(String(64), nullable=False, index=True)  # e.g., fisherman_login, researcher_signup, etc.
    otp_hash = Column(String(255), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    attempt_count = Column(Integer, default=0, nullable=False)
    max_attempts = Column(Integer, default=5, nullable=False)
    resend_after = Column(DateTime, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)
    verified_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)


class SessionRecord(Base):
    """Active server-side authenticated sessions / token records."""
    __tablename__ = "sessions"

    id = Column(String(64), primary_key=True)  # JWT jti or session token
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(20), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    is_revoked = Column(Boolean, default=False, nullable=False)

    user = relationship("User", back_populates="sessions")


class QueryRecord(Base):
    __tablename__ = "query_records"

    id = Column(String(64), primary_key=True, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    user_type = Column(String(32), nullable=False)
    original_query = Column(Text, nullable=False)
    detected_language = Column(String(16), default="en")
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    verdict = Column(String(16), nullable=False)
    report = Column(Text, nullable=False)
    dissemination_channel = Column(String(32), nullable=False)
    dispatched_content = Column(Text, nullable=True)
    agent_traces_json = Column(JSON, nullable=True)


engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


import os


def ensure_fisherman_profile_columns(bind=None) -> None:
    """
    Additive, guarded migration for `fisherman_profiles`.

    `Base.metadata.create_all()` only creates missing tables — it never adds
    columns to tables that already exist (e.g. a pre-existing orca.db). This
    helper inspects the live table and appends any registration columns that
    are still missing. It never drops, renames, or rewrites existing columns.
    """
    target = bind or engine
    try:
        inspector = sqlalchemy_inspect(target)
        if "fisherman_profiles" not in inspector.get_table_names():
            return
        existing = {col["name"] for col in inspector.get_columns("fisherman_profiles")}
        missing = [col for col in FISHERMAN_PROFILE_ADDITIVE_COLUMNS if col[0] not in existing]
        if not missing:
            return
        with target.begin() as connection:
            for name, ddl_type in missing:
                connection.execute(
                    text(f"ALTER TABLE fisherman_profiles ADD COLUMN {name} {ddl_type}")
                )
        logger.info(
            "Added %d missing column(s) to fisherman_profiles: %s",
            len(missing),
            ", ".join(name for name, _ in missing),
        )
    except Exception as exc:  # pragma: no cover - never block application startup
        logger.warning("Unable to ensure fisherman_profiles columns: %s", exc)


def init_db():
    """Initializes the database schema."""
    if "sqlite:///" in settings.DATABASE_URL:
        db_path = settings.DATABASE_URL.replace("sqlite:///", "")
        dir_name = os.path.dirname(db_path)
        if dir_name:
            os.makedirs(dir_name, exist_ok=True)
    Base.metadata.create_all(bind=engine)
    ensure_fisherman_profile_columns(engine)


# Ensure schema tables exist whenever models are imported
init_db()


def get_db():
    """FastAPI dependency for database sessions."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
