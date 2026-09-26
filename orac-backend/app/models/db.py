"""SQLAlchemy database models and session setup."""
from datetime import datetime, timezone
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Text, JSON
from sqlalchemy.orm import declarative_base, sessionmaker
from app.core.config import settings

Base = declarative_base()


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


def init_db():
    """Initializes the database schema."""
    if "sqlite:///" in settings.DATABASE_URL:
        db_path = settings.DATABASE_URL.replace("sqlite:///", "")
        dir_name = os.path.dirname(db_path)
        if dir_name:
            os.makedirs(dir_name, exist_ok=True)
    Base.metadata.create_all(bind=engine)


# Ensure schema tables exist whenever models are imported
init_db()


def get_db():
    """FastAPI dependency for database sessions."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
