"""Comprehensive backend tests for ORCA Role-Based Authentication System.
Covers strict session boundaries, administrator authorization, OTP hardening, and persona lifecycles.
"""
import pytest
from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.models.db import (
    Base,
    get_db,
    User,
    FishermanProfile,
    ResearcherProfile,
    AuthorityProfile,
    SessionRecord,
    OtpVerification
)
from app.core.config import settings
from app.services.auth_security import (
    hash_password,
    create_access_token,
    decode_access_token
)

# Test SQLite in-memory / temporary database
TEST_DB_URL = "sqlite:///./test_orca_auth.db"
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
    """Isolated database lifecycle per test with clean dependency override management."""
    # Temporarily activate development auth mode for test suite OTP delivery
    original_dev_mode = settings.AUTH_DEV_MODE
    settings.AUTH_DEV_MODE = True

    Base.metadata.create_all(bind=test_engine)
    app.dependency_overrides[get_db] = override_get_db
    yield
    Base.metadata.drop_all(bind=test_engine)
    app.dependency_overrides.pop(get_db, None)
    settings.AUTH_DEV_MODE = original_dev_mode


client = TestClient(app)


# -----------------------------------------------------------------------------
# Fixtures for Test Personas
# -----------------------------------------------------------------------------
@pytest.fixture
def admin_account():
    """Creates a seeded administrator account and server session."""
    db = TestingSessionLocal()
    admin_user = User(
        role="admin",
        first_name="Command",
        last_name="Administrator",
        full_name="Command Administrator",
        email="admin@orca-marine.gov.in",
        phone_number=None,
        password_hash=hash_password("AdminSecure2026!"),
        is_active=True,
        is_verified=True,
        created_at=datetime.now(timezone.utc)
    )
    db.add(admin_user)
    db.commit()
    db.refresh(admin_user)

    user_id = str(admin_user.id)
    token = create_access_token({"sub": user_id, "role": "admin"})
    payload = decode_access_token(token)
    session_rec = SessionRecord(
        id=payload["jti"],
        user_id=user_id,
        role="admin",
        expires_at=datetime.fromtimestamp(payload["exp"], tz=timezone.utc),
        created_at=datetime.now(timezone.utc)
    )
    db.add(session_rec)
    db.commit()
    db.close()

    return {
        "user_id": user_id,
        "token": token,
        "headers": {"Authorization": f"Bearer {token}"}
    }


@pytest.fixture
def fisherman_account():
    """Creates an active fisherman account and server session."""
    db = TestingSessionLocal()
    user = User(
        role="fisherman",
        first_name="Ramesh",
        last_name="Fisher",
        full_name="Ramesh Fisher",
        phone_number="+919876500001",
        email=None,
        password_hash=None,
        is_active=True,
        is_verified=True,
        created_at=datetime.now(timezone.utc)
    )
    db.add(user)
    db.flush()
    profile = FishermanProfile(
        user_id=user.id,
        age=40,
        location="Mangalore",
        vessel_name="Ocean Star",
        vessel_registration_number="IND-KA-01-MM-01",
        preferred_language="kn"
    )
    db.add(profile)
    db.commit()
    db.refresh(user)

    user_id = str(user.id)
    token = create_access_token({"sub": user_id, "role": "fisherman"})
    payload = decode_access_token(token)
    session_rec = SessionRecord(
        id=payload["jti"],
        user_id=user_id,
        role="fisherman",
        expires_at=datetime.fromtimestamp(payload["exp"], tz=timezone.utc),
        created_at=datetime.now(timezone.utc)
    )
    db.add(session_rec)
    db.commit()
    db.close()

    return {
        "user_id": user_id,
        "token": token,
        "headers": {"Authorization": f"Bearer {token}"}
    }


@pytest.fixture
def researcher_account():
    """Creates an active researcher account and server session."""
    db = TestingSessionLocal()
    user = User(
        role="researcher",
        first_name="Dr. Sunita",
        last_name="Rao",
        full_name="Dr. Sunita Rao",
        email="srao@ocean.res.in",
        phone_number="+919876500002",
        password_hash=hash_password("ResearcherPass123!"),
        is_active=True,
        is_verified=True,
        created_at=datetime.now(timezone.utc)
    )
    db.add(user)
    db.flush()
    profile = ResearcherProfile(
        user_id=user.id,
        area_of_research="Marine Biodiversity",
        institution="NIO Goa"
    )
    db.add(profile)
    db.commit()
    db.refresh(user)

    user_id = str(user.id)
    token = create_access_token({"sub": user_id, "role": "researcher"})
    payload = decode_access_token(token)
    session_rec = SessionRecord(
        id=payload["jti"],
        user_id=user_id,
        role="researcher",
        expires_at=datetime.fromtimestamp(payload["exp"], tz=timezone.utc),
        created_at=datetime.now(timezone.utc)
    )
    db.add(session_rec)
    db.commit()
    db.close()

    return {
        "user_id": user_id,
        "token": token,
        "headers": {"Authorization": f"Bearer {token}"}
    }


@pytest.fixture
def approved_authority_account():
    """Creates an approved authority officer account and server session."""
    db = TestingSessionLocal()
    user = User(
        role="authority",
        first_name="Commander",
        last_name="Verma",
        full_name="Commander Verma",
        email="cverma@coastguard.gov.in",
        phone_number="+919876500003",
        password_hash=hash_password("AuthorityPass123!"),
        is_active=True,
        is_verified=True,
        created_at=datetime.now(timezone.utc)
    )
    db.add(user)
    db.flush()
    profile = AuthorityProfile(
        user_id=user.id,
        designation="Operations Officer",
        department="Indian Coast Guard",
        official_email="cverma@coastguard.gov.in",
        employee_id="ICG-9021",
        state_region="Goa",
        area_of_responsibility="Coastal Patrol",
        status="approved"
    )
    db.add(profile)
    db.commit()
    db.refresh(user)

    user_id = str(user.id)
    token = create_access_token({"sub": user_id, "role": "authority"})
    payload = decode_access_token(token)
    session_rec = SessionRecord(
        id=payload["jti"],
        user_id=user_id,
        role="authority",
        expires_at=datetime.fromtimestamp(payload["exp"], tz=timezone.utc),
        created_at=datetime.now(timezone.utc)
    )
    db.add(session_rec)
    db.commit()
    db.close()

    return {
        "user_id": user_id,
        "token": token,
        "headers": {"Authorization": f"Bearer {token}"}
    }


# =============================================================================
# 1. PART 1 & 22: CRITICAL ADMIN AUTHORIZATION & RBAC TESTS
# =============================================================================
def test_admin_endpoints_unauthenticated_rejected():
    """Unauthenticated requests to admin endpoints must return 401."""
    resp1 = client.get("/auth/admin/authority-requests")
    assert resp1.status_code == 401

    resp2 = client.post("/auth/admin/approve-authority", json={
        "authority_user_id": "test-id",
        "action": "approve"
    })
    assert resp2.status_code == 401


def test_admin_endpoints_non_admin_roles_rejected_403(
    fisherman_account,
    researcher_account,
    approved_authority_account
):
    """Ordinary authenticated users (fisherman, researcher, authority) must receive 403 Forbidden."""
    # Fisherman access attempt
    fish_get = client.get("/auth/admin/authority-requests", headers=fisherman_account["headers"])
    assert fish_get.status_code == 403

    fish_post = client.post(
        "/auth/admin/approve-authority",
        headers=fisherman_account["headers"],
        json={"authority_user_id": "target-id", "action": "approve"}
    )
    assert fish_post.status_code == 403

    # Researcher access attempt
    res_get = client.get("/auth/admin/authority-requests", headers=researcher_account["headers"])
    assert res_get.status_code == 403

    # Ordinary approved authority access attempt (must NOT have admin privilege)
    auth_get = client.get("/auth/admin/authority-requests", headers=approved_authority_account["headers"])
    assert auth_get.status_code == 403


def test_admin_login_and_privileged_review_flow(admin_account):
    """Admin can list requests and execute approve/reject/suspend with state validation."""
    # 1. Admin login via credentials
    login_resp = client.post("/auth/admin/login", json={
        "email": "admin@orca-marine.gov.in",
        "password": "AdminSecure2026!"
    })
    assert login_resp.status_code == 200
    admin_auth = login_resp.json()
    assert admin_auth["user"]["role"] == "admin"
    # Cookie-only auth: the JWT must never appear in the JSON body
    assert "access_token" not in admin_auth
    admin_headers = {"Authorization": f"Bearer {login_resp.cookies.get('orca_token')}"}

    # 2. Create a pending authority user directly in DB
    db = TestingSessionLocal()
    pending_user = User(
        role="authority",
        first_name="Officer",
        last_name="Sharma",
        full_name="Officer Sharma",
        email="osharma@port.gov.in",
        phone_number="+919876511111",
        is_active=True,
        is_verified=True,
        created_at=datetime.now(timezone.utc)
    )
    db.add(pending_user)
    db.flush()
    profile = AuthorityProfile(
        user_id=pending_user.id,
        designation="Port Safety Officer",
        department="Port Trust",
        official_email="osharma@port.gov.in",
        employee_id="MPT-1001",
        state_region="Maharashtra",
        area_of_responsibility="Port Navigation",
        status="pending"
    )
    db.add(profile)
    db.commit()
    target_id = pending_user.id
    db.close()

    # 3. Admin lists authority requests -> 200
    list_resp = client.get("/auth/admin/authority-requests", headers=admin_headers)
    assert list_resp.status_code == 200
    data = list_resp.json()
    assert data["total"] >= 1
    found = next((r for r in data["requests"] if r["user_id"] == target_id), None)
    assert found is not None
    assert found["status"] == "pending"

    # 4. State transition: pending -> approve -> 200
    appr_resp = client.post("/auth/admin/approve-authority", headers=admin_headers, json={
        "authority_user_id": target_id,
        "action": "approve"
    })
    assert appr_resp.status_code == 200
    assert appr_resp.json()["status"] == "approved"

    # 5. Invalid transition: cannot re-approve already approved account -> 400
    bad_appr = client.post("/auth/admin/approve-authority", headers=admin_headers, json={
        "authority_user_id": target_id,
        "action": "approve"
    })
    assert bad_appr.status_code == 400

    # 6. State transition: approved -> suspend with reason -> 200
    susp_resp = client.post("/auth/admin/approve-authority", headers=admin_headers, json={
        "authority_user_id": target_id,
        "action": "suspend",
        "reason": "Administrative inquiry pending."
    })
    assert susp_resp.status_code == 200
    assert susp_resp.json()["status"] == "suspended"

    # 7. State transition: suspended -> restore (approve) -> 200
    rest_resp = client.post("/auth/admin/approve-authority", headers=admin_headers, json={
        "authority_user_id": target_id,
        "action": "approve"
    })
    assert rest_resp.status_code == 200
    assert rest_resp.json()["status"] == "approved"


def test_admin_rejection_reason_persistence(admin_account):
    """Rejection must persist the provided administrative reason."""
    db = TestingSessionLocal()
    user = User(
        role="authority",
        first_name="Reject",
        last_name="Candidate",
        full_name="Reject Candidate",
        email="reject@port.gov.in",
        is_active=True,
        is_verified=True,
        created_at=datetime.now(timezone.utc)
    )
    db.add(user)
    db.flush()
    profile = AuthorityProfile(
        user_id=user.id,
        designation="Inspector",
        department="Fisheries",
        official_email="reject@port.gov.in",
        employee_id="FISH-9999",
        state_region="Kerala",
        area_of_responsibility="Coast",
        status="pending"
    )
    db.add(profile)
    db.commit()
    uid = user.id
    db.close()

    # Reject with specific reason
    reject_reason = "Official ID card could not be validated against government registry."
    resp = client.post("/auth/admin/approve-authority", headers=admin_account["headers"], json={
        "authority_user_id": uid,
        "action": "reject",
        "reason": reject_reason
    })
    assert resp.status_code == 200
    assert resp.json()["status"] == "rejected"

    # Verify persisted in database
    db = TestingSessionLocal()
    check_prof = db.query(AuthorityProfile).filter(AuthorityProfile.user_id == uid).first()
    assert check_prof.status == "rejected"
    assert check_prof.rejection_reason == reject_reason
    db.close()


# =============================================================================
# 2. PART 23: SERVER-SIDE SESSION SECURITY BOUNDARY TESTS
# =============================================================================
def test_valid_session_authenticates_200(fisherman_account):
    """Valid token with corresponding server session succeeds."""
    resp = client.get("/auth/me", headers=fisherman_account["headers"])
    assert resp.status_code == 200
    assert resp.json()["role"] == "fisherman"


def test_logout_revokes_server_session_and_rejects_subsequent_calls(fisherman_account):
    """Logout invalidates session; old token must be rejected with 401."""
    # Pre-logout: valid
    assert client.get("/auth/me", headers=fisherman_account["headers"]).status_code == 200

    # Logout
    logout_resp = client.post("/auth/logout", headers=fisherman_account["headers"])
    assert logout_resp.status_code == 200

    # Post-logout: token rejected
    me_resp = client.get("/auth/me", headers=fisherman_account["headers"])
    assert me_resp.status_code == 401
    assert "revoked" in me_resp.json()["detail"].lower()


def test_jwt_with_nonexistent_session_jti_rejected_401(fisherman_account):
    """JWT with valid signature but nonexistent DB session record returns 401."""
    fake_token = create_access_token({"sub": fisherman_account["user_id"], "role": "fisherman"})
    # Notice: we did NOT insert fake_token's jti into SessionRecord table
    resp = client.get("/auth/me", headers={"Authorization": f"Bearer {fake_token}"})
    assert resp.status_code == 401
    assert "session" in resp.json()["detail"].lower()


def test_expired_server_session_rejected_401(fisherman_account):
    """Session whose DB expiration timestamp has passed returns 401."""
    db = TestingSessionLocal()
    payload = decode_access_token(fisherman_account["token"])
    session_rec = db.query(SessionRecord).filter(SessionRecord.id == payload["jti"]).first()
    # Force expire in DB
    session_rec.expires_at = datetime.now(timezone.utc) - timedelta(minutes=10)
    db.commit()
    db.close()

    resp = client.get("/auth/me", headers=fisherman_account["headers"])
    assert resp.status_code == 401
    assert "expired" in resp.json()["detail"].lower()


def test_mismatched_jwt_user_and_session_user_rejected_401():
    """Token associated with another user's session record is rejected with 401."""
    db = TestingSessionLocal()
    # Create User A
    user_a = User(
        role="fisherman", first_name="A", full_name="User A",
        phone_number="+919999900010", is_active=True, is_verified=True
    )
    # Create User B
    user_b = User(
        role="fisherman", first_name="B", full_name="User B",
        phone_number="+919999900011", is_active=True, is_verified=True
    )
    db.add_all([user_a, user_b])
    db.commit()

    user_a_id = str(user_a.id)
    user_b_id = str(user_b.id)

    # Session created for User A
    session_id = "test-session-cross-bind"
    session_rec = SessionRecord(
        id=session_id,
        user_id=user_a_id,
        role="fisherman",
        expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
        created_at=datetime.now(timezone.utc)
    )
    db.add(session_rec)
    db.commit()
    db.close()

    # Craft token with sub=User B, but jti=Session A
    data = {"sub": user_b_id, "role": "fisherman", "jti": session_id}
    cross_token = create_access_token(data)

    resp = client.get("/auth/me", headers={"Authorization": f"Bearer {cross_token}"})
    assert resp.status_code == 401
    assert "subject" in resp.json()["detail"].lower()


def test_mismatched_role_and_user_role_rejected_401(fisherman_account):
    """If DB user role differs from session/token role, returns 401."""
    # Craft token claiming to be 'admin' but user_id is fisherman
    tampered_token = create_access_token({
        "sub": fisherman_account["user_id"],
        "role": "admin",
        "jti": decode_access_token(fisherman_account["token"])["jti"]
    })
    resp = client.get("/auth/me", headers={"Authorization": f"Bearer {tampered_token}"})
    assert resp.status_code == 401


def test_inactive_user_session_rejected_401(fisherman_account):
    """Deactivated user account returns 401."""
    db = TestingSessionLocal()
    user = db.query(User).filter(User.id == fisherman_account["user_id"]).first()
    user.is_active = False
    db.commit()
    db.close()

    resp = client.get("/auth/me", headers=fisherman_account["headers"])
    assert resp.status_code == 401
    assert "inactive" in resp.json()["detail"].lower()


# =============================================================================
# 3. PART 24: STRICT OTP VALIDATION & SECURITY TESTS
# =============================================================================
def test_otp_strict_six_digits_enforced():
    """OTP validation strictly enforces ^\\d{6}$ (rejects 4, 5, 7, 8 digits, letters)."""
    phone = "+919876543210"

    # 4 digits -> 422
    resp_4 = client.post("/auth/fisherman/verify-otp", json={
        "phone_number": phone, "otp": "1234", "purpose": "signup"
    })
    assert resp_4.status_code == 422

    # 5 digits -> 422
    resp_5 = client.post("/auth/fisherman/verify-otp", json={
        "phone_number": phone, "otp": "12345", "purpose": "signup"
    })
    assert resp_5.status_code == 422

    # 7 digits -> 422
    resp_7 = client.post("/auth/fisherman/verify-otp", json={
        "phone_number": phone, "otp": "1234567", "purpose": "signup"
    })
    assert resp_7.status_code == 422

    # Non-numeric letters -> 422
    resp_alpha = client.post("/auth/fisherman/verify-otp", json={
        "phone_number": phone, "otp": "ABCDEF", "purpose": "signup"
    })
    assert resp_alpha.status_code == 422


def test_otp_attempt_lockout_and_expiration():
    """Verify maximum 5 attempts lockout and expiration."""
    phone = "+919999911111"
    client.post("/auth/fisherman/send-otp", json={"phone_number": phone, "purpose": "signup"})

    # 5 incorrect attempts
    for _ in range(5):
        resp = client.post("/auth/fisherman/verify-otp", json={
            "phone_number": phone, "otp": "000000", "purpose": "signup"
        })
        assert resp.status_code == 400

    # 6th attempt is locked out
    locked = client.post("/auth/fisherman/verify-otp", json={
        "phone_number": phone, "otp": "000000", "purpose": "signup"
    })
    assert locked.status_code == 400
    assert "maximum" in locked.json()["detail"].lower()


def test_otp_resend_cooldown_enforced():
    """Requesting an OTP within the 30-second cooldown window returns 429."""
    phone = "+919999922222"
    r1 = client.post("/auth/fisherman/send-otp", json={"phone_number": phone, "purpose": "signup"})
    assert r1.status_code == 200

    # Immediate second request
    r2 = client.post("/auth/fisherman/send-otp", json={"phone_number": phone, "purpose": "signup"})
    assert r2.status_code == 429
    assert "please wait" in r2.json()["detail"].lower()


def test_otp_cannot_be_reused():
    """Once verified, an OTP cannot be used a second time."""
    phone = "+919999933333"
    r = client.post("/auth/fisherman/send-otp", json={"phone_number": phone, "purpose": "signup"})
    otp = r.json()["dev_otp"]

    # First verification -> 200
    v1 = client.post("/auth/fisherman/verify-otp", json={
        "phone_number": phone, "otp": otp, "purpose": "signup"
    })
    assert v1.status_code == 200

    # Second verification with same OTP -> 400 (already verified / inactive)
    v2 = client.post("/auth/fisherman/verify-otp", json={
        "phone_number": phone, "otp": otp, "purpose": "signup"
    })
    assert v2.status_code == 400


def test_otp_purpose_separation_and_identifier_binding():
    """Signup OTP cannot be used for login, and OTP for phone A cannot verify phone B."""
    phone_a = "+919999944444"
    phone_b = "+919999955555"

    r = client.post("/auth/fisherman/send-otp", json={"phone_number": phone_a, "purpose": "signup"})
    otp = r.json()["dev_otp"]

    # Purpose mismatch: signup OTP sent to verify as 'login' -> 400
    purpose_mismatch = client.post("/auth/fisherman/verify-otp", json={
        "phone_number": phone_a, "otp": otp, "purpose": "login"
    })
    assert purpose_mismatch.status_code == 400

    # Identifier mismatch: OTP generated for phone A submitted for phone B -> 400
    id_mismatch = client.post("/auth/fisherman/verify-otp", json={
        "phone_number": phone_b, "otp": otp, "purpose": "signup"
    })
    assert id_mismatch.status_code == 400


# =============================================================================
# 4. PART 25: PASSWORD POLICY & CONFIRMATION TESTS
# =============================================================================
def test_password_policy_after_verified_email():
    """Verify email first, then assert short password fails validation."""
    email = "research.pwd@nio.res.in"
    otp_resp = client.post("/auth/researcher/send-signup-otp", json={"email": email})
    assert otp_resp.status_code == 200
    otp = otp_resp.json()["dev_otp"]

    # Verify email
    v_resp = client.post("/auth/researcher/verify-signup-otp", json={"email": email, "otp": otp})
    assert v_resp.status_code == 200

    # Submit short password (< 8 chars) -> 400 or 422
    short_resp = client.post("/auth/researcher/signup", json={
        "email": email,
        "first_name": "Test",
        "last_name": "Scientist",
        "mobile_number": "+919800011111",
        "area_of_research": "Oceanography",
        "password": "short",
        "confirm_password": "short"
    })
    assert short_resp.status_code in (400, 422)


def test_password_confirmation_mismatch():
    """Verified email with mismatched password & confirmation returns 422."""
    email = "mismatch.pwd@nio.res.in"
    otp = client.post("/auth/researcher/send-signup-otp", json={"email": email}).json()["dev_otp"]
    client.post("/auth/researcher/verify-signup-otp", json={"email": email, "otp": otp})

    mismatch_resp = client.post("/auth/researcher/signup", json={
        "email": email,
        "first_name": "Test",
        "last_name": "Scientist",
        "mobile_number": "+919800022222",
        "area_of_research": "Oceanography",
        "password": "ValidPassword123!",
        "confirm_password": "DifferentPassword123!"
    })
    assert mismatch_resp.status_code == 422


# =============================================================================
# 5. PART 26: COMPLETE END-TO-END PERSONA AUTHENTICATION FLOWS
# =============================================================================
def test_fisherman_end_to_end_flow():
    """Fisherman: Send OTP -> Verify -> Signup -> Login OTP -> Verify -> Access Dashboard."""
    phone = "+919876543299"

    # 1. Signup OTP
    r1 = client.post("/auth/fisherman/send-otp", json={"phone_number": phone, "purpose": "signup"})
    assert r1.status_code == 200
    otp1 = r1.json()["dev_otp"]

    # 2. Verify Signup OTP
    r2 = client.post("/auth/fisherman/verify-otp", json={"phone_number": phone, "otp": otp1, "purpose": "signup"})
    assert r2.status_code == 200

    # 3. Signup
    r3 = client.post("/auth/fisherman/signup", json={
        "phone_number": phone,
        "name": "Kiran Meena",
        "age": 35,
        "location": "Karwar Harbor",
        "vessel_name": "Matsya Vayu",
        "preferred_language": "kn"
    })
    assert r3.status_code == 200

    # 4. Login OTP
    r4 = client.post("/auth/fisherman/send-otp", json={"phone_number": phone, "purpose": "login"})
    assert r4.status_code == 200
    login_otp = r4.json()["dev_otp"]

    # 5. Verify Login OTP
    r5 = client.post("/auth/fisherman/verify-otp", json={"phone_number": phone, "otp": login_otp, "purpose": "login"})
    assert r5.status_code == 200
    assert "access_token" not in r5.json()
    token = r5.cookies.get("orca_token")
    headers = {"Authorization": f"Bearer {token}"}

    # 6. Fisherman dashboard allowed
    assert client.get("/auth/protected/fisherman", headers=headers).status_code == 200

    # 7. Other role consoles denied
    assert client.get("/auth/protected/researcher", headers=headers).status_code == 403
    assert client.get("/auth/protected/authority", headers=headers).status_code == 403


def test_researcher_end_to_end_flow():
    """Researcher: Email OTP -> Verify -> Signup -> Bad Login fails -> 2-step Login -> Access."""
    email = "dr.patil@iisc.ac.in"
    phone = "+919844001122"

    # 1. Email OTP
    r1 = client.post("/auth/researcher/send-signup-otp", json={"email": email})
    assert r1.status_code == 200
    otp = r1.json()["dev_otp"]

    # 2. Verify OTP
    r2 = client.post("/auth/researcher/verify-signup-otp", json={"email": email, "otp": otp})
    assert r2.status_code == 200

    # 3. Signup
    r3 = client.post("/auth/researcher/signup", json={
        "email": email,
        "first_name": "Sanjay",
        "last_name": "Patil",
        "mobile_number": phone,
        "area_of_research": "Arabian Sea Upwelling",
        "password": "ResearcherPassword123!",
        "confirm_password": "ResearcherPassword123!"
    })
    assert r3.status_code == 200

    # 4. Wrong password login fails (401)
    bad_login = client.post("/auth/researcher/login", json={
        "identifier": email, "password": "WrongPassword!"
    })
    assert bad_login.status_code == 401

    # 5. Step 1: Correct credentials dispatches OTP
    step1 = client.post("/auth/researcher/login", json={
        "identifier": email, "password": "ResearcherPassword123!"
    })
    assert step1.status_code == 200
    login_otp = step1.json()["dev_otp"]

    # 6. Step 2: Verify OTP
    step2 = client.post("/auth/researcher/login", json={
        "identifier": email, "password": "ResearcherPassword123!", "otp": login_otp
    })
    assert step2.status_code == 200
    assert "access_token" not in step2.json()
    token = step2.cookies.get("orca_token")
    headers = {"Authorization": f"Bearer {token}"}

    # 7. Researcher dashboard allowed, other roles denied
    assert client.get("/auth/protected/researcher", headers=headers).status_code == 200
    assert client.get("/auth/protected/fisherman", headers=headers).status_code == 403
    assert client.get("/auth/protected/authority", headers=headers).status_code == 403


def test_authority_lifecycle_end_to_end(admin_account):
    """Authority: Verify -> Request Access -> Pending (login denied) -> Admin Approve -> Login -> Suspend."""
    email = "captain.nair@indiannavy.gov.in"
    mobile = "+919811002233"
    emp_id = "IN-SURV-7890"

    # 1. Verify email
    e_otp = client.post("/auth/authority/request-access/send-otp", json={"type": "email", "target": email}).json()["dev_otp"]
    client.post("/auth/authority/request-access/verify-otp", json={"type": "email", "target": email, "otp": e_otp})

    # 2. Verify mobile
    m_otp = client.post("/auth/authority/request-access/send-otp", json={"type": "mobile", "target": mobile}).json()["dev_otp"]
    client.post("/auth/authority/request-access/verify-otp", json={"type": "mobile", "target": mobile, "otp": m_otp})

    # 3. Submit request
    req_resp = client.post("/auth/authority/request-access", json={
        "full_name": "Captain Nair",
        "designation": "Commanding Officer",
        "department": "Indian Navy Western Naval Command",
        "official_email": email,
        "mobile_number": mobile,
        "employee_id": emp_id,
        "state_region": "Goa & Karwar",
        "area_of_responsibility": "Offshore Defense",
        "password": "NavySecurePassword2026!",
        "confirm_password": "NavySecurePassword2026!"
    })
    assert req_resp.status_code == 200

    # 4. Attempt login while PENDING -> blocked with 403
    pending_login = client.post("/auth/authority/login", json={
        "identifier": emp_id, "password": "NavySecurePassword2026!"
    })
    assert pending_login.status_code == 403
    assert "pending approval" in pending_login.json()["detail"].lower()

    # 5. Admin approves
    admin_list = client.get("/auth/admin/authority-requests", headers=admin_account["headers"]).json()["requests"]
    target_user = next(u for u in admin_list if u["official_email"] == email)
    appr = client.post("/auth/admin/approve-authority", headers=admin_account["headers"], json={
        "authority_user_id": target_user["user_id"],
        "action": "approve"
    })
    assert appr.status_code == 200

    # 6. Approved authority logs in: Step 1 (OTP dispatch) & Step 2 (OTP verify)
    step1 = client.post("/auth/authority/login", json={
        "identifier": email, "password": "NavySecurePassword2026!"
    })
    assert step1.status_code == 200
    auth_otp = step1.json()["dev_otp"]

    step2 = client.post("/auth/authority/login", json={
        "identifier": email, "password": "NavySecurePassword2026!", "otp": auth_otp
    })
    assert step2.status_code == 200
    assert "access_token" not in step2.json()
    auth_token = step2.cookies.get("orca_token")
    headers = {"Authorization": f"Bearer {auth_token}"}

    # 7. Authority protected console allowed
    assert client.get("/auth/protected/authority", headers=headers).status_code == 200

    # 8. Admin suspends authority account
    client.post("/auth/admin/approve-authority", headers=admin_account["headers"], json={
        "authority_user_id": target_user["user_id"],
        "action": "suspend",
        "reason": "Routine credential rotation"
    })

    # 9. Suspended authority cannot login -> 403
    susp_login = client.post("/auth/authority/login", json={
        "identifier": email, "password": "NavySecurePassword2026!"
    })
    assert susp_login.status_code == 403
    assert "suspended" in susp_login.json()["detail"].lower()


# =============================================================================
# 6. ADDITIONAL HARDENING TESTS (sessions, OTP expiry, admin surface, dispatch honesty)
# =============================================================================
def test_manually_revoked_server_session_rejected_401(fisherman_account):
    """A session revoked directly server-side (without logout) is rejected immediately."""
    db = TestingSessionLocal()
    payload = decode_access_token(fisherman_account["token"])
    session_rec = db.query(SessionRecord).filter(SessionRecord.id == payload["jti"]).first()
    session_rec.is_revoked = True
    db.commit()
    db.close()

    resp = client.get("/auth/me", headers=fisherman_account["headers"])
    assert resp.status_code == 401
    assert "revoked" in resp.json()["detail"].lower()


def test_suspended_authority_active_session_rejected_401(admin_account, approved_authority_account):
    """Administrator suspension must invalidate an authority's live session at request time."""
    # Session works while approved
    assert client.get("/auth/me", headers=approved_authority_account["headers"]).status_code == 200

    # Admin suspends the account
    susp = client.post("/auth/admin/approve-authority", headers=admin_account["headers"], json={
        "authority_user_id": approved_authority_account["user_id"],
        "action": "suspend",
        "reason": "Emergency credential audit"
    })
    assert susp.status_code == 200

    # Existing token/session must now fail server-side validation
    resp = client.get("/auth/me", headers=approved_authority_account["headers"])
    assert resp.status_code == 401

    # And console access is denied as well
    assert client.get(
        "/auth/protected/authority", headers=approved_authority_account["headers"]
    ).status_code == 401


def test_no_public_admin_signup_endpoint_exists():
    """There must be no self-service/admin registration route; admin accounts are seeded only."""
    for path in ("/auth/admin/signup", "/auth/admin/register", "/auth/signup", "/auth/admin/accounts"):
        resp = client.post(path, json={
            "email": "attacker@example.com",
            "password": "TakeOver12345!",
            "role": "admin"
        })
        assert resp.status_code in (404, 405), f"Unexpected public endpoint {path} -> {resp.status_code}"

    # Admin review endpoints are not reachable via non-admin verbs either
    wrong_verb = client.get("/auth/admin/approve-authority")
    assert wrong_verb.status_code in (404, 405)


def test_expired_otp_rejected(fisherman_account):
    """An OTP whose stored expiration has passed is rejected even if the code is correct."""
    phone = "+919999966666"
    r = client.post("/auth/fisherman/send-otp", json={"phone_number": phone, "purpose": "signup"})
    assert r.status_code == 200
    otp = r.json()["dev_otp"]
    assert otp and len(otp) == 6

    # Force-expire the stored OTP in the database
    db = TestingSessionLocal()
    record = db.query(OtpVerification).filter(
        OtpVerification.identifier == phone,
        OtpVerification.purpose == "fisherman_signup",
        OtpVerification.is_verified == False
    ).order_by(OtpVerification.created_at.desc()).first()
    record.expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
    db.commit()
    db.close()

    resp = client.post("/auth/fisherman/verify-otp", json={
        "phone_number": phone, "otp": otp, "purpose": "signup"
    })
    assert resp.status_code == 400
    assert "expired" in resp.json()["detail"].lower()


def test_duplicate_fisherman_signup_rejected(fisherman_account):
    """An existing phone number cannot be used for a second account, even with a fresh OTP verification."""
    phone = "+919876500001"  # number used by the fisherman fixture

    # send-otp signup for an existing number is rejected outright
    dup_otp = client.post("/auth/fisherman/send-otp", json={"phone_number": phone, "purpose": "signup"})
    assert dup_otp.status_code == 400
    assert "already exists" in dup_otp.json()["detail"].lower()

    # Even with a valid recent verification record, signup itself refuses the duplicate
    db = TestingSessionLocal()
    db.add(OtpVerification(
        identifier=phone,
        purpose="fisherman_signup",
        otp_hash="bypass",
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
        attempt_count=0,
        max_attempts=5,
        resend_after=datetime.now(timezone.utc),
        is_verified=True,
        verified_at=datetime.now(timezone.utc),
        created_at=datetime.now(timezone.utc)
    ))
    db.commit()
    db.close()

    dup_signup = client.post("/auth/fisherman/signup", json={
        "phone_number": phone,
        "name": "Second Account",
        "age": 30,
        "location": "Mangalore"
    })
    assert dup_signup.status_code == 400
    assert "already exists" in dup_signup.json()["detail"].lower()


def test_duplicate_researcher_signup_rejected(researcher_account):
    """An existing researcher email cannot receive a second account."""
    dup = client.post("/auth/researcher/send-signup-otp", json={"email": "srao@ocean.res.in"})
    assert dup.status_code == 400
    assert "already exists" in dup.json()["detail"].lower()


def test_dev_otp_never_exposed_outside_dev_mode(fisherman_account):
    """With AUTH_DEV_MODE disabled the OTP code must not appear in any API response,
    and the dispatch must not claim live delivery it cannot perform."""
    original = settings.AUTH_DEV_MODE
    settings.AUTH_DEV_MODE = False
    try:
        resp = client.post(
            "/auth/fisherman/send-otp",
            json={"phone_number": "+919876500001", "purpose": "login"}
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["dev_otp"] is None
        assert "dev_otp" not in body or body["dev_otp"] is None
        assert body["mode"] != "development"
        # No fake delivery claim: message must not assert an SMS was actually sent
        lowered = body["message"].lower()
        assert "otp sent to" not in lowered
        if body["mode"] == "simulated":
            assert "not actually sent" in lowered
    finally:
        settings.AUTH_DEV_MODE = original


def test_login_sets_httponly_samesite_cookie(fisherman_account):
    """Successful login must set an HTTP-only, SameSite=Lax session cookie."""
    # OTP login flow for the existing fisherman account
    r = client.post(
        "/auth/fisherman/send-otp",
        json={"phone_number": "+919876500001", "purpose": "login"}
    )
    assert r.status_code == 200
    otp = r.json()["dev_otp"]

    login = client.post("/auth/fisherman/verify-otp", json={
        "phone_number": "+919876500001", "otp": otp, "purpose": "login"
    })
    assert login.status_code == 200
    set_cookie = login.headers.get("set-cookie", "")
    assert "orca_token=" in set_cookie
    assert "httponly" in set_cookie.lower()
    assert "samesite=lax" in set_cookie.lower().replace(" ", "")


def test_reviewed_by_records_real_admin_identity(admin_account):
    """Approval/rejection audit trail must record the real reviewing administrator."""
    db = TestingSessionLocal()
    user = User(
        role="authority",
        first_name="Audit",
        last_name="Target",
        full_name="Audit Target",
        email="audit.target@port.gov.in",
        is_active=True,
        is_verified=True,
        created_at=datetime.now(timezone.utc)
    )
    db.add(user)
    db.flush()
    profile = AuthorityProfile(
        user_id=user.id,
        designation="Harbour Master",
        department="Port Trust",
        official_email="audit.target@port.gov.in",
        employee_id="AUD-0001",
        state_region="Tamil Nadu",
        area_of_responsibility="Chennai Harbour",
        status="pending"
    )
    db.add(profile)
    db.commit()
    uid = user.id
    db.close()

    resp = client.post("/auth/admin/approve-authority", headers=admin_account["headers"], json={
        "authority_user_id": uid,
        "action": "approve"
    })
    assert resp.status_code == 200

    db = TestingSessionLocal()
    check = db.query(AuthorityProfile).filter(AuthorityProfile.user_id == uid).first()
    assert check.reviewed_by is not None
    # Must identify the actual admin, not a generic placeholder
    assert "admin@orca-marine.gov.in" in check.reviewed_by
    assert check.reviewed_by.strip().lower() != "orca administrator"
    db.close()
