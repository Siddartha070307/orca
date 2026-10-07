"""Administrator bootstrap service for ORCA platform."""
import logging
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.core.config import settings
from app.models.db import User
from app.services.auth_security import hash_password, normalize_email

logger = logging.getLogger("orca.admin")


def seed_default_admin(db: Session) -> None:
    """
    Safely seeds the default administrator account from environment configuration.
    Never creates an admin if ADMIN_PASSWORD is empty or ADMIN_SEED_ENABLED is false.
    """
    if not settings.ADMIN_SEED_ENABLED or not settings.ADMIN_PASSWORD:
        return

    admin_email = normalize_email(settings.ADMIN_EMAIL)
    existing = db.query(User).filter(User.email == admin_email, User.role == "admin").first()
    if not existing:
        admin = User(
            role="admin",
            first_name="System",
            last_name="Administrator",
            full_name="ORCA System Administrator",
            email=admin_email,
            phone_number=None,
            password_hash=hash_password(settings.ADMIN_PASSWORD),
            is_active=True,
            is_verified=True,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc)
        )
        db.add(admin)
        db.commit()
        logger.info(f"Administrator bootstrap completed for '{admin_email}'.")
