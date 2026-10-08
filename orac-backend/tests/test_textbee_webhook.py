"""
Tests for the TextBee SMS delivery webhook.

Covers:
  * HMAC-SHA256 signature verification
  * malformed/missing signatures
  * malformed JSON
  * TextBee event validation
  * idempotency / duplicate webhook delivery
  * smsBatchId + recipient alert matching
  * delivery status transitions
  * status regression protection
  * UNKNOWN_STATE handling
"""

import hashlib
import hmac
import json
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import app.api.auth_routes as auth_routes
from app.core.config import settings
from app.main import app
from app.models.db import (
    AlertRecord,
    Base,
    FishermanProfile,
    User,
    get_db,
)


TEST_DB_URL = "sqlite:///./test_orca_textbee_webhook.db"

test_engine = create_engine(
    TEST_DB_URL,
    connect_args={"check_same_thread": False},
)

TestingSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=test_engine,
)


WEBHOOK_SECRET = "test-textbee-webhook-secret"


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(autouse=True)
def setup_and_teardown_db(monkeypatch):
    """Isolated database and webhook secret for every test."""
    Base.metadata.create_all(bind=test_engine)
    app.dependency_overrides[get_db] = override_get_db

    monkeypatch.setattr(
        settings,
        "TEXTBEE_WEBHOOK_SECRET",
        WEBHOOK_SECRET,
    )

    yield

    app.dependency_overrides.pop(get_db, None)
    Base.metadata.drop_all(bind=test_engine)


client = TestClient(app)


def _sign_payload(payload: dict) -> tuple[bytes, str]:
    """Return raw JSON bytes and its TextBee-style HMAC signature."""
    raw_body = json.dumps(
        payload,
        separators=(",", ":"),
    ).encode("utf-8")

    signature = hmac.new(
        WEBHOOK_SECRET.encode("utf-8"),
        raw_body,
        hashlib.sha256,
    ).hexdigest()

    return raw_body, signature


def _post_webhook(payload: dict, signature: str | None = None):
    raw_body, generated_signature = _sign_payload(payload)

    headers = {
        "Content-Type": "application/json",
        "X-Signature": signature or generated_signature,
    }

    return client.post(
        "/auth/webhooks/textbee",
        content=raw_body,
        headers=headers,
    )


def _seed_alert(
    *,
    status="ACCEPTED",
    batch_id="batch-test-001",
    phone="+919876500111",
):
    db = TestingSessionLocal()

    fisherman = User(
        role="fisherman",
        first_name="Ramesh",
        last_name="Fisher",
        full_name="Ramesh Fisher",
        phone_number=phone,
        is_active=True,
        is_verified=True,
        created_at=datetime.now(timezone.utc),
    )
    db.add(fisherman)
    db.commit()
    db.refresh(fisherman)

    profile = FishermanProfile(
        user_id=fisherman.id,
        age=34,
        location="Machilipatnam Fishing Harbour",
        vessel_name="Sri Lakshmi",
        vessel_registration_number="IND-AP-02-MM-1024",
        fishing_type="Mechanized trawl",
        preferred_language="te",
        emergency_contact="+919876500112",
        safety_tracking_consent=False,
    )
    db.add(profile)

    alert = AlertRecord(
        id="ORCA-ALERT-TEST001",
        alert_type="CYCLONE",
        message="ORCA ALERT: Severe cyclone near your fishing area.",
        recipient_user_id=str(fisherman.id),
        recipient_phone=phone,
        recipient_name=fisherman.full_name,
        vessel_name=profile.vessel_name,
        status=status,
        provider="TextBee",
        provider_message_id=batch_id,
        char_count=54,
        created_at=datetime.now(timezone.utc),
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)

    alert_id = alert.id
    db.close()

    return alert_id


# -----------------------------------------------------------------------------
# Signature / request validation
# -----------------------------------------------------------------------------


def test_webhook_accepts_valid_signature():
    _seed_alert()

    payload = {
        "webhookEvent": "MESSAGE_SENT",
        "idempotencyKey": "idem-valid-001",
        "smsId": "sms-001",
        "smsBatchId": "batch-test-001",
        "recipient": "+919876500111",
    }

    response = _post_webhook(payload)

    assert response.status_code == 200
    assert response.json()["success"] is True
    assert response.json()["processed"] is True


def test_webhook_rejects_missing_signature():
    payload = {
        "webhookEvent": "MESSAGE_SENT",
        "idempotencyKey": "idem-missing-signature",
        "smsId": "sms-002",
        "smsBatchId": "batch-test-001",
        "recipient": "+919876500111",
    }

    raw_body, _ = _sign_payload(payload)

    response = client.post(
        "/auth/webhooks/textbee",
        content=raw_body,
        headers={"Content-Type": "application/json"},
    )

    assert response.status_code == 401


def test_webhook_rejects_invalid_signature():
    payload = {
        "webhookEvent": "MESSAGE_SENT",
        "idempotencyKey": "idem-invalid-signature",
        "smsId": "sms-003",
        "smsBatchId": "batch-test-001",
        "recipient": "+919876500111",
    }

    response = _post_webhook(
        payload,
        signature="definitely-not-a-valid-signature",
    )

    assert response.status_code == 401


def test_webhook_rejects_malformed_json():
    raw_body = b'{"webhookEvent": "MESSAGE_SENT"'

    signature = hmac.new(
        WEBHOOK_SECRET.encode("utf-8"),
        raw_body,
        hashlib.sha256,
    ).hexdigest()

    response = client.post(
        "/auth/webhooks/textbee",
        content=raw_body,
        headers={
            "Content-Type": "application/json",
            "X-Signature": signature,
        },
    )

    assert response.status_code == 400


def test_webhook_rejects_missing_required_fields():
    response = _post_webhook(
        {
            "webhookEvent": "MESSAGE_SENT",
        }
    )

    assert response.status_code == 400


# -----------------------------------------------------------------------------
# Delivery state transitions
# -----------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("event_type", "expected_status"),
    [
        ("MESSAGE_SENT", "SENT"),
        ("MESSAGE_DELIVERED", "DELIVERED"),
        ("MESSAGE_FAILED", "FAILED"),
        ("UNKNOWN_STATE", "UNKNOWN"),
    ],
)
def test_webhook_updates_delivery_status(event_type, expected_status):
    alert_id = _seed_alert()

    payload = {
        "webhookEvent": event_type,
        "idempotencyKey": f"idem-{event_type.lower()}",
        "smsId": f"sms-{event_type.lower()}",
        "smsBatchId": "batch-test-001",
        "recipient": "+919876500111",
    }

    if event_type == "MESSAGE_FAILED":
        payload["errorMessage"] = "SIM delivery failure"

    response = _post_webhook(payload)

    assert response.status_code == 200
    assert response.json()["processed"] is True
    assert response.json()["status"] == expected_status

    db = TestingSessionLocal()
    alert = db.query(AlertRecord).filter(AlertRecord.id == alert_id).first()

    assert alert is not None
    assert alert.status == expected_status

    if event_type == "MESSAGE_FAILED":
        assert alert.failure_reason == "SIM delivery failure"

    if event_type == "UNKNOWN_STATE":
        assert "unknown SMS delivery state" in alert.failure_reason

    db.close()


# -----------------------------------------------------------------------------
# Idempotency
# -----------------------------------------------------------------------------


def test_duplicate_idempotency_key_is_ignored():
    _seed_alert()

    payload = {
        "webhookEvent": "MESSAGE_SENT",
        "idempotencyKey": "idem-duplicate-001",
        "smsId": "sms-duplicate-001",
        "smsBatchId": "batch-test-001",
        "recipient": "+919876500111",
    }

    first = _post_webhook(payload)
    second = _post_webhook(payload)

    assert first.status_code == 200
    assert first.json()["processed"] is True

    assert second.status_code == 200
    assert second.json()["processed"] is False
    assert second.json()["duplicate"] is True


# -----------------------------------------------------------------------------
# Matching / isolation
# -----------------------------------------------------------------------------


def test_webhook_does_not_update_wrong_batch():
    alert_id = _seed_alert()

    response = _post_webhook(
        {
            "webhookEvent": "MESSAGE_DELIVERED",
            "idempotencyKey": "idem-wrong-batch",
            "smsId": "sms-wrong-batch",
            "smsBatchId": "different-batch",
            "recipient": "+919876500111",
        }
    )

    assert response.status_code == 200
    assert response.json()["processed"] is False

    db = TestingSessionLocal()
    alert = db.query(AlertRecord).filter(AlertRecord.id == alert_id).first()

    assert alert.status == "ACCEPTED"
    db.close()


def test_webhook_does_not_update_wrong_recipient():
    alert_id = _seed_alert()

    response = _post_webhook(
        {
            "webhookEvent": "MESSAGE_DELIVERED",
            "idempotencyKey": "idem-wrong-recipient",
            "smsId": "sms-wrong-recipient",
            "smsBatchId": "batch-test-001",
            "recipient": "+919999999999",
        }
    )

    assert response.status_code == 200
    assert response.json()["processed"] is False

    db = TestingSessionLocal()
    alert = db.query(AlertRecord).filter(AlertRecord.id == alert_id).first()

    assert alert.status == "ACCEPTED"
    db.close()


# -----------------------------------------------------------------------------
# Status regression protection
# -----------------------------------------------------------------------------


def test_delivered_status_cannot_regress_to_sent():
    alert_id = _seed_alert(status="DELIVERED")

    response = _post_webhook(
        {
            "webhookEvent": "MESSAGE_SENT",
            "idempotencyKey": "idem-regression-sent",
            "smsId": "sms-regression-sent",
            "smsBatchId": "batch-test-001",
            "recipient": "+919876500111",
        }
    )

    assert response.status_code == 200
    assert response.json()["final_status"] == "DELIVERED"
    assert response.json()["processed"] is False

    db = TestingSessionLocal()
    alert = db.query(AlertRecord).filter(AlertRecord.id == alert_id).first()

    assert alert.status == "DELIVERED"
    db.close()


def test_failed_status_cannot_regress_to_sent():
    alert_id = _seed_alert(status="FAILED")

    response = _post_webhook(
        {
            "webhookEvent": "MESSAGE_SENT",
            "idempotencyKey": "idem-regression-failed",
            "smsId": "sms-regression-failed",
            "smsBatchId": "batch-test-001",
            "recipient": "+919876500111",
        }
    )

    assert response.status_code == 200
    assert response.json()["final_status"] == "FAILED"

    db = TestingSessionLocal()
    alert = db.query(AlertRecord).filter(AlertRecord.id == alert_id).first()

    assert alert.status == "FAILED"
    db.close()


def test_unknown_state_does_not_overwrite_delivered():
    alert_id = _seed_alert(status="DELIVERED")

    response = _post_webhook(
        {
            "webhookEvent": "UNKNOWN_STATE",
            "idempotencyKey": "idem-regression-unknown",
            "smsId": "sms-regression-unknown",
            "smsBatchId": "batch-test-001",
            "recipient": "+919876500111",
        }
    )

    assert response.status_code == 200

    db = TestingSessionLocal()
    alert = db.query(AlertRecord).filter(AlertRecord.id == alert_id).first()

    assert alert.status == "DELIVERED"
    db.close()


# -----------------------------------------------------------------------------
# Unsupported event
# -----------------------------------------------------------------------------


def test_unsupported_event_is_acknowledged_without_processing():
    payload = {
        "webhookEvent": "SOME_FUTURE_EVENT",
        "idempotencyKey": "idem-future-event",
        "smsId": "sms-future-event",
        "smsBatchId": "batch-test-001",
        "recipient": "+919876500111",
    }

    response = _post_webhook(payload)

    assert response.status_code == 200
    assert response.json()["processed"] is False