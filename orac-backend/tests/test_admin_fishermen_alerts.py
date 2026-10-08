"""
Tests for the administrator Fisherman Alert Sending page:
  * server-side require_admin protection on send + history endpoints
  * dispatch through ORCA's existing SMS dissemination gateway (no parallel path)
  * 160-char GSM composition, template/note/vessel rules, audit persistence
  * duplicate-dispatch guard and history filtering / phone masking
"""
import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.models.db import (
    Base,
    get_db,
    User,
    FishermanProfile,
    SessionRecord,
    AlertRecord
)
from app.services.auth_security import hash_password, create_access_token, decode_access_token

TEST_DB_URL = "sqlite:///./test_orca_fishermen_alerts.db"
test_engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(autouse=True)
def setup_and_teardown_db():
    Base.metadata.create_all(bind=test_engine)
    app.dependency_overrides[get_db] = override_get_db
    yield
    Base.metadata.drop_all(bind=test_engine)
    app.dependency_overrides.pop(get_db, None)


client = TestClient(app)


def _issue_session(db, user):
    """Creates a real server-side session for the user and returns bearer headers."""
    token = create_access_token({"sub": str(user.id), "role": user.role})
    payload = decode_access_token(token)
    db.add(
        SessionRecord(
            id=payload["jti"],
            user_id=str(user.id),
            role=user.role,
            expires_at=datetime.fromtimestamp(payload["exp"], tz=timezone.utc),
            created_at=datetime.now(timezone.utc)
        )
    )
    db.commit()
    return {"Authorization": f"Bearer {token}"}


def _seed_admin():
    db = TestingSessionLocal()
    user = User(
        role="admin",
        first_name="Command",
        last_name="Administrator",
        full_name="Command Administrator",
        email="admin@orca-marine.gov.in",
        password_hash=hash_password("AdminSecure2026!"),
        is_active=True,
        is_verified=True,
        created_at=datetime.now(timezone.utc)
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    headers = _issue_session(db, user)
    user_id = str(user.id)
    db.close()
    return {"user_id": user_id, "headers": headers}


def _seed_fisherman(phone="+919876500111", name="Ramesh Fisher", active=True):
    db = TestingSessionLocal()
    user = User(
        role="fisherman",
        first_name=name.split()[0],
        last_name=" ".join(name.split()[1:]),
        full_name=name,
        phone_number=phone,
        is_active=active,
        is_verified=True,
        created_at=datetime.now(timezone.utc)
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    profile = FishermanProfile(
        user_id=user.id,
        age=34,
        location="Machilipatnam Fishing Harbour",
        vessel_name="Sri Lakshmi",
        vessel_registration_number="IND-AP-02-MM-1024",
        fishing_type="Mechanized trawl",
        preferred_language="te",
        emergency_contact="+919876500112",
        safety_tracking_consent=False
    )
    db.add(profile)
    db.commit()

    headers = _issue_session(db, user)
    user_id = str(user.id)
    db.close()
    return {"user_id": user_id, "headers": headers, "phone": phone}


# -----------------------------------------------------------------------------
# Endpoint protection (admin-only, preserves existing RBAC)
# -----------------------------------------------------------------------------
def test_alert_endpoints_require_authentication():
    assert client.post("/auth/admin/fishermen/alerts", json={}).status_code == 401
    assert client.get("/auth/admin/fishermen/alerts").status_code == 401


def test_alert_endpoints_forbid_non_admin_roles():
    fisherman = _seed_fisherman()
    payload = {"recipient_user_id": fisherman["user_id"], "alert_type": "CYCLONE"}

    assert client.post(
        "/auth/admin/fishermen/alerts", json=payload, headers=fisherman["headers"]
    ).status_code == 403
    assert client.get(
        "/auth/admin/fishermen/alerts", headers=fisherman["headers"]
    ).status_code == 403


# -----------------------------------------------------------------------------
# Dispatch behaviour (existing dissemination gateway)
# -----------------------------------------------------------------------------
def test_admin_send_alert_dispatches_and_records_audit():
    admin = _seed_admin()
    fisherman = _seed_fisherman()

    resp = client.post(
        "/auth/admin/fishermen/alerts",
        json={"recipient_user_id": fisherman["user_id"], "alert_type": "CYCLONE"},
        headers=admin["headers"]
    )
    assert resp.status_code == 201
    data = resp.json()

    assert data["success"] is True
    assert data["alert_type"] == "CYCLONE"
    assert data["status"] == "ACCEPTED"
    # Routed through ORCA's existing pluggable SMS gateway
    assert data["provider"] == "ORCA-MockSMSGateway"
    assert data["char_count"] <= 160
    assert data["within_160_limit"] is True
    assert data["message_preview"].startswith("ORCA ALERT:")
    # Phone masked in the response
    assert "0111" in data["recipient_masked"]
    assert fisherman["phone"] not in data["recipient_masked"]

    # Audit row persisted with recipient snapshot + admin actor
    db = TestingSessionLocal()
    record = db.query(AlertRecord).filter(AlertRecord.id == data["alert_id"]).first()
    assert record is not None
    assert record.alert_type == "CYCLONE"
    assert record.status == "ACCEPTED"
    assert record.recipient_user_id == fisherman["user_id"]
    assert record.sent_by_admin_id == admin["user_id"]
    assert record.vessel_name == "Sri Lakshmi"
    db.close()


def test_general_alert_appends_custom_note_and_vessel():
    admin = _seed_admin()
    fisherman = _seed_fisherman()

    resp = client.post(
        "/auth/admin/fishermen/alerts",
        json={
            "recipient_user_id": fisherman["user_id"],
            "alert_type": "GENERAL",
            "custom_message": "Avoid Mandapam sector until 18:00 IST."
        },
        headers=admin["headers"]
    )
    assert resp.status_code == 201
    preview = resp.json()["message_preview"]
    assert "Avoid Mandapam sector until 18:00 IST." in preview
    assert "Sri Lakshmi" in preview
    assert len(preview) <= 160


def test_send_alert_rejects_unknown_recipient():
    admin = _seed_admin()

    resp = client.post(
        "/auth/admin/fishermen/alerts",
        json={"recipient_user_id": "does-not-exist", "alert_type": "CYCLONE"},
        headers=admin["headers"]
    )
    assert resp.status_code == 404


def test_send_alert_rejects_non_fisherman_recipient():
    admin = _seed_admin()

    # An administrator account is not a valid alert recipient
    resp = client.post(
        "/auth/admin/fishermen/alerts",
        json={"recipient_user_id": admin["user_id"], "alert_type": "CYCLONE"},
        headers=admin["headers"]
    )
    assert resp.status_code == 404


def test_send_alert_rejects_unknown_alert_type():
    admin = _seed_admin()
    fisherman = _seed_fisherman()

    resp = client.post(
        "/auth/admin/fishermen/alerts",
        json={"recipient_user_id": fisherman["user_id"], "alert_type": "MADE_UP"},
        headers=admin["headers"]
    )
    assert resp.status_code == 400
    assert "Unknown alert type" in resp.json()["detail"]


def test_send_alert_rejects_deactivated_fisherman():
    admin = _seed_admin()
    fisherman = _seed_fisherman(active=False)

    resp = client.post(
        "/auth/admin/fishermen/alerts",
        json={"recipient_user_id": fisherman["user_id"], "alert_type": "CYCLONE"},
        headers=admin["headers"]
    )
    assert resp.status_code == 400
    assert "deactivated" in resp.json()["detail"]


def test_duplicate_alert_within_window_is_rate_limited():
    admin = _seed_admin()
    fisherman = _seed_fisherman()
    payload = {"recipient_user_id": fisherman["user_id"], "alert_type": "HIGH_WAVE"}

    first = client.post(
        "/auth/admin/fishermen/alerts", json=payload, headers=admin["headers"]
    )
    assert first.status_code == 201

    second = client.post(
        "/auth/admin/fishermen/alerts", json=payload, headers=admin["headers"]
    )
    assert second.status_code == 429


# -----------------------------------------------------------------------------
# History endpoint
# -----------------------------------------------------------------------------
def test_alert_history_lists_dispatches_with_masked_phone():
    admin = _seed_admin()
    fisherman = _seed_fisherman()

    client.post(
        "/auth/admin/fishermen/alerts",
        json={"recipient_user_id": fisherman["user_id"], "alert_type": "EMERGENCY"},
        headers=admin["headers"]
    )

    resp = client.get("/auth/admin/fishermen/alerts", headers=admin["headers"])
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1

    item = data["alerts"][0]
    assert item["alert_type"] == "EMERGENCY"
    assert item["status"] == "ACCEPTED"
    assert item["recipient_name"] == "Ramesh Fisher"
    assert item["vessel_name"] == "Sri Lakshmi"
    # Masked in history — full number never leaves the server
    assert fisherman["phone"] not in item["recipient_masked"]


def test_alert_history_filters_by_type():
    admin = _seed_admin()
    fisherman = _seed_fisherman()

    client.post(
        "/auth/admin/fishermen/alerts",
        json={"recipient_user_id": fisherman["user_id"], "alert_type": "CYCLONE"},
        headers=admin["headers"]
    )
    client.post(
        "/auth/admin/fishermen/alerts",
        json={"recipient_user_id": fisherman["user_id"], "alert_type": "RETURN_TO_SHORE"},
        headers=admin["headers"]
    )

    resp = client.get(
        "/auth/admin/fishermen/alerts?alert_type=CYCLONE", headers=admin["headers"]
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert data["alerts"][0]["alert_type"] == "CYCLONE"


def test_alert_history_empty_state():
    admin = _seed_admin()

    resp = client.get("/auth/admin/fishermen/alerts", headers=admin["headers"])
    assert resp.status_code == 200
    assert resp.json() == {"alerts": [], "total": 0}
