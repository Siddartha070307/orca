"""
Tests for fisherman registration management:
  * administrator-only directory / create / edit endpoints (server-side require_admin)
  * fisherman self-service profile edit scoped to the session identity
  * no cross-fisherman read or write access for normal fishermen
  * additive fisherman_profiles column migration helper
"""
import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect as sqlalchemy_inspect
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.models.db import (
    Base,
    get_db,
    User,
    FishermanProfile,
    SessionRecord,
    FISHERMAN_PROFILE_ADDITIVE_COLUMNS,
    ensure_fisherman_profile_columns
)
from app.services.auth_security import hash_password, create_access_token, decode_access_token

TEST_DB_URL = "sqlite:///./test_orca_fishermen.db"
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


def _seed_fisherman(phone="+919876500111", name="Ramesh Fisher", location="Machilipatnam Fishing Harbour"):
    db = TestingSessionLocal()
    user = User(
        role="fisherman",
        first_name=name.split()[0],
        last_name=" ".join(name.split()[1:]),
        full_name=name,
        phone_number=phone,
        is_active=True,
        is_verified=True,
        created_at=datetime.now(timezone.utc)
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    profile = FishermanProfile(
        user_id=user.id,
        age=34,
        location=location,
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
# Administrator endpoint protection
# -----------------------------------------------------------------------------
def test_admin_fishermen_endpoints_require_authentication():
    assert client.get("/auth/admin/fishermen").status_code == 401
    assert client.post("/auth/admin/fishermen", json={}).status_code == 401
    assert client.put("/auth/admin/fishermen/some-id", json={}).status_code == 401


def test_admin_fishermen_endpoints_forbid_non_admin_roles():
    fisherman = _seed_fisherman()

    assert client.get("/auth/admin/fishermen", headers=fisherman["headers"]).status_code == 403
    assert client.get(
        "/auth/admin/fishermen", headers=fisherman["headers"]
    ).json()["detail"].startswith("Access forbidden")
    assert client.post(
        "/auth/admin/fishermen",
        headers=fisherman["headers"],
        json={
            "phone_number": "+919876500999",
            "name": "Intruder Fisher",
            "age": 30,
            "location": "Kakinada"
        }
    ).status_code == 403
    assert client.put(
        "/auth/admin/fishermen/whatever",
        headers=fisherman["headers"],
        json={"age": 40}
    ).status_code == 403


def test_admin_directory_lists_only_fishermen():
    admin = _seed_admin()
    target = _seed_fisherman(phone="+919876500111", name="Ramesh Fisher")

    db = TestingSessionLocal()
    researcher = User(
        role="researcher",
        first_name="Maya",
        last_name="Science",
        full_name="Maya Science",
        email="maya@example.org",
        password_hash=hash_password("ResearcherSecure2026!"),
        is_active=True,
        is_verified=True,
        created_at=datetime.now(timezone.utc)
    )
    db.add(researcher)
    db.commit()
    db.close()

    res = client.get("/auth/admin/fishermen", headers=admin["headers"])
    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 1
    assert [f["id"] for f in body["fishermen"]] == [target["user_id"]]
    assert all(f["role"] == "fisherman" for f in body["fishermen"])
    entry = body["fishermen"][0]
    assert entry["profile"]["location"] == "Machilipatnam Fishing Harbour"
    assert entry["profile"]["safety_tracking_consent"] is False
    # Secrets must never leak
    assert "password_hash" not in entry


def test_admin_directory_search_filters_by_name_and_port():
    admin = _seed_admin()
    _seed_fisherman(phone="+919876500111", name="Ramesh Fisher")
    _seed_fisherman(phone="+919876500222", name="Anita Boatswain", location="Kakinada Fishery Jetty")

    res = client.get("/auth/admin/fishermen", headers=admin["headers"], params={"search": "Anita"})
    assert res.status_code == 200
    assert res.json()["total"] == 1
    assert res.json()["fishermen"][0]["full_name"] == "Anita Boatswain"

    res = client.get("/auth/admin/fishermen", headers=admin["headers"], params={"search": "Machilipatnam"})
    assert res.status_code == 200
    assert res.json()["total"] == 1


# -----------------------------------------------------------------------------
# Administrator create / edit flow
# -----------------------------------------------------------------------------
def test_admin_can_register_a_new_fisherman():
    admin = _seed_admin()

    res = client.post(
        "/auth/admin/fishermen",
        headers=admin["headers"],
        json={
            "phone_number": "9876500555",
            "name": "Sita Devi",
            "age": 29,
            "location": "Gilakaladindi Village",
            "vessel_name": "Sea Falcon",
            "vessel_registration_number": "ind-ap-02-mm-2024",
            "fishing_type": "Artisanal",
            "preferred_language": "te",
            "emergency_contact": "9876500556",
            "government_id_type": "Aadhaar",
            "government_id_number": "1234 5678 9012",
            "emergency_contact_name": "Ravi Kumar",
            "emergency_contact_relation": "Spouse",
            "safety_tracking_consent": True
        }
    )
    assert res.status_code == 201
    body = res.json()
    assert body["role"] == "fisherman"
    assert body["phone_number"] == "+919876500555"  # normalized
    assert body["is_active"] is True and body["is_verified"] is True
    profile = body["profile"]
    assert profile["vessel_registration_number"] == "IND-AP-02-MM-2024"  # upper-cased
    assert profile["government_id_type"] == "Aadhaar"
    assert profile["emergency_contact_name"] == "Ravi Kumar"
    assert profile["emergency_contact_relation"] == "Spouse"
    assert profile["safety_tracking_consent"] is True

    # Account is immediately usable with the standard session flow
    listed = client.get("/auth/admin/fishermen", headers=admin["headers"], params={"search": "Sita"})
    assert listed.json()["total"] == 1


def test_admin_cannot_register_duplicate_mobile_number():
    admin = _seed_admin()
    _seed_fisherman(phone="+919876500111", name="Ramesh Fisher")

    res = client.post(
        "/auth/admin/fishermen",
        headers=admin["headers"],
        json={"phone_number": "9876500111", "name": "Copy Cat", "age": 31, "location": "Kochi"}
    )
    assert res.status_code == 400
    assert "already exists" in res.json()["detail"]


def test_admin_can_update_profile_and_activation_state():
    admin = _seed_admin()
    target = _seed_fisherman()

    res = client.put(
        f"/auth/admin/fishermen/{target['user_id']}",
        headers=admin["headers"],
        json={
            "location": "Vizag Harbour",
            "emergency_contact_name": "Lakshmi",
            "emergency_contact_relation": "Mother",
            "safety_tracking_consent": True,
            "is_active": False
        }
    )
    assert res.status_code == 200
    profile = res.json()["profile"]
    assert profile["location"] == "Vizag Harbour"
    assert profile["emergency_contact_name"] == "Lakshmi"
    assert profile["safety_tracking_consent"] is True
    # Untouched fields are preserved
    assert profile["vessel_name"] == "Sri Lakshmi"
    assert profile["age"] == 34
    assert res.json()["is_active"] is False

    # Deactivation is enforced by the shared session validation
    res = client.get("/auth/me", headers=target["headers"])
    assert res.status_code == 401


def test_admin_update_of_unknown_fisherman_returns_404():
    admin = _seed_admin()
    res = client.put(
        "/auth/admin/fishermen/00000000-0000-0000-0000-000000000000",
        headers=admin["headers"],
        json={"age": 40}
    )
    assert res.status_code == 404


# -----------------------------------------------------------------------------
# Fisherman self-service profile (identity scoping)
# -----------------------------------------------------------------------------
def test_fisherman_can_edit_own_registration_profile():
    fisherman = _seed_fisherman()

    res = client.put(
        "/auth/fishermen/me/profile",
        headers=fisherman["headers"],
        json={
            "age": 36,
            "vessel_name": "Sri Lakshmi II",
            "government_id_type": "Fishing Licence",
            "government_id_number": "FL-AP-99123",
            "emergency_contact_name": "Sita Devi",
            "emergency_contact_relation": "Spouse",
            "safety_tracking_consent": True
        }
    )
    assert res.status_code == 200
    profile = res.json()["profile"]
    assert profile["age"] == 36
    assert profile["vessel_name"] == "Sri Lakshmi II"
    assert profile["government_id_number"] == "FL-AP-99123"
    assert profile["safety_tracking_consent"] is True
    assert profile["location"] == "Machilipatnam Fishing Harbour"  # untouched

    # Persisted: a fresh read returns the same values
    res = client.get("/auth/me", headers=fisherman["headers"])
    assert res.status_code == 200
    assert res.json()["profile"]["government_id_number"] == "FL-AP-99123"


def test_fisherman_profile_edit_rejects_out_of_range_values():
    fisherman = _seed_fisherman()
    res = client.put(
        "/auth/fishermen/me/profile",
        headers=fisherman["headers"],
        json={"age": 12}
    )
    assert res.status_code in (400, 422)


def test_fisherman_cannot_edit_another_fisherman_registration():
    """There is no user-addressed write route for the fisherman role at all."""
    attacker = _seed_fisherman(phone="+919876500777", name="Curious Fisher")
    victim = _seed_fisherman(phone="+919876500888", name="Unsuspecting Fisher")

    # The self endpoint takes no user_id parameter
    res = client.put(
        f"/auth/fishermen/{victim['user_id']}/profile",
        headers=attacker["headers"],
        json={"age": 99}
    )
    assert res.status_code in (403, 404, 405)

    # And the admin route is closed to the fisherman role
    res = client.put(
        f"/auth/admin/fishermen/{victim['user_id']}",
        headers=attacker["headers"],
        json={"age": 99}
    )
    assert res.status_code == 403

    # Victim's data is untouched
    res = client.get("/auth/me", headers=victim["headers"])
    assert res.status_code == 200
    assert res.json()["profile"]["age"] == 34


def test_other_roles_cannot_use_fisherman_self_profile_endpoint():
    admin = _seed_admin()
    res = client.put(
        "/auth/fishermen/me/profile",
        headers=admin["headers"],
        json={"age": 44}
    )
    assert res.status_code == 403


def test_fisherman_profile_endpoint_requires_authentication():
    res = client.put("/auth/fishermen/me/profile", json={"age": 44})
    assert res.status_code == 401


# -----------------------------------------------------------------------------
# Additive schema migration helper
# -----------------------------------------------------------------------------
def test_additive_registration_columns_present_and_migration_is_idempotent():
    inspector = sqlalchemy_inspect(test_engine)
    existing = {c["name"] for c in inspector.get_columns("fisherman_profiles")}

    for column_name, _ddl in FISHERMAN_PROFILE_ADDITIVE_COLUMNS:
        assert column_name in existing, f"missing additive column: {column_name}"

    # Running the guarded migration again must be a safe no-op
    ensure_fisherman_profile_columns(test_engine)
    ensure_fisherman_profile_columns(test_engine)

    inspector = sqlalchemy_inspect(test_engine)
    existing = {c["name"] for c in inspector.get_columns("fisherman_profiles")}
    for column_name, _ddl in FISHERMAN_PROFILE_ADDITIVE_COLUMNS:
        assert column_name in existing
