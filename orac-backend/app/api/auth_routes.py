"""FastAPI route handlers for ORCA Role-Based Authentication and Access Control."""
import hashlib
import hmac
import json
import logging
import re
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.db import (
    get_db,
    User,
    FishermanProfile,
    ResearcherProfile,
    AuthorityProfile,
    SessionRecord,
    AlertRecord,
    TextBeeWebhookEvent
)
from app.models.auth_schemas import (
    FishermanSendOtpRequest,
    FishermanVerifyOtpRequest,
    FishermanSignupRequest,
    FishermanProfileUpdateRequest,
    AdminFishermanCreateRequest,
    AdminFishermanUpdateRequest,
    AdminFishermanListResponse,
    ResearcherSendSignupOtpRequest,
    ResearcherVerifySignupOtpRequest,
    ResearcherSignupRequest,
    ResearcherLoginRequest,
    AuthoritySendSignupOtpRequest,
    AuthorityVerifySignupOtpRequest,
    AuthorityRequestAccessRequest,
    AuthorityLoginRequest,
    AuthorityApprovalRequest,
    AdminLoginRequest,
    SafeUserProfileResponse,
    AuthResponse,
    OtpDispatchResponse,
    GenericMessageResponse,
    FISHERMAN_ALERT_TYPES,
    AdminAlertSendRequest,
    AdminAlertDispatchResponse,
    AdminAlertHistoryItem,
    AdminAlertHistoryResponse
)
from app.services.auth_security import (
    hash_password,
    verify_password,
    validate_password_strength,
    normalize_phone,
    is_valid_phone,
    normalize_email,
    is_valid_email,
    create_access_token,
    decode_access_token
)
from app.services.otp_service import OtpService
from app.services.email_service import email_provider
from app.dissemination.sms_client import sms_gateway

logger = logging.getLogger("orca.auth")

auth_router = APIRouter(prefix="/auth", tags=["Authentication"])
security = HTTPBearer(auto_error=False)


# -----------------------------------------------------------------------------
# Dependency: Extract & Validate Current Authenticated User (Part 4)
# -----------------------------------------------------------------------------
async def get_current_user(
    request: Request,
    creds: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """
    Validates token from Authorization Bearer header or HTTP-only cookie.
    Enforces all 13 session and JWT security conditions.
    Returns 401 if any condition fails.
    """
    token: Optional[str] = None
    if creds and creds.credentials:
        token = creds.credentials
    else:
        # Fallback to HTTP-only cookie
        token = request.cookies.get("orca_token")

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please log in.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    # 1. JWT signature is valid & 2. JWT is not expired
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session token. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    # 3. JWT contains a valid sub
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session token missing subject identifier.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    # 4. JWT contains a valid jti
    jti = payload.get("jti")
    if not jti:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session token missing session identifier (jti).",
            headers={"WWW-Authenticate": "Bearer"}
        )

    # 5. A matching session record exists in the database
    # 6. session.id == token.jti
    session_rec = db.query(SessionRecord).filter(SessionRecord.id == jti).first()
    if not session_rec:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No active server-side session found. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    # 7. session.user_id == token.sub (verify token cannot be associated with another user's session)
    if session_rec.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session does not match token subject.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    # 8. Session is not revoked
    if session_rec.is_revoked:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has been revoked. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    # 9. Session expiration has not passed
    now = datetime.now(timezone.utc)
    sess_exp = session_rec.expires_at
    if sess_exp.tzinfo is None:
        sess_exp = sess_exp.replace(tzinfo=timezone.utc)
    if now > sess_exp:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Server session has expired. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    # 10. The user exists
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account not found.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    # 11. User is active
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is inactive or suspended.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    # 12. Token/session role is consistent with user's actual role
    token_role = payload.get("role")
    if session_rec.role != user.role or (token_role and token_role != user.role):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session role inconsistency detected.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    # 13. Authority accounts must remain administratively approved at request time.
    # Suspension/revocation by an administrator invalidates live sessions immediately.
    if user.role == "authority":
        authority_profile = user.authority_profile
        if not authority_profile or authority_profile.status != "approved":
            current_status = authority_profile.status if authority_profile else "unknown"
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Authority account is no longer approved (status: {current_status}). Please log in again.",
                headers={"WWW-Authenticate": "Bearer"}
            )

    return user


def require_roles(allowed_roles: List[str]):
    """Role-Based Access Control dependency factory."""
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access forbidden: User role '{current_user.role}' cannot access this resource. Allowed: {allowed_roles}"
            )

        # For authority, additionally enforce approved status
        if current_user.role == "authority":
            if not current_user.authority_profile or current_user.authority_profile.status != "approved":
                current_status = current_user.authority_profile.status if current_user.authority_profile else "unknown"
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Access forbidden: Authority account status is '{current_status}'. Administrator approval required."
                )

        return current_user
    return role_checker


async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Administrator-only dependency: 401 when unauthenticated, 403 for every non-admin role."""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Administrator privileges are required to review authority access requests."
        )
    return current_user


def issue_session(db: Session, user: User, response: Response) -> str:
    """
    Creates a signed JWT, persists its server-side session record (jti), and sets
    the HTTP-only auth cookie. Single source of truth for session issuance so every
    login flow gets identical token/session/cookie handling.
    """
    token = create_access_token({"sub": user.id, "role": user.role})
    payload = decode_access_token(token)
    if payload and "jti" in payload:
        session_rec = SessionRecord(
            id=payload["jti"],
            user_id=user.id,
            role=user.role,
            expires_at=datetime.fromtimestamp(payload["exp"], tz=timezone.utc),
            created_at=datetime.now(timezone.utc)
        )
        db.add(session_rec)
        db.commit()
    response.set_cookie(
        key="orca_token",
        value=token,
        httponly=True,
        secure=settings.AUTH_COOKIE_SECURE,
        samesite=settings.AUTH_COOKIE_SAMESITE,
        max_age=settings.SESSION_EXPIRY_SECONDS
    )
    return token


def otp_dispatch_response(result) -> OtpDispatchResponse:
    """Maps an OtpDispatchResult to the API response, raising on cooldown/dispatch failure."""
    if not result.success:
        raise HTTPException(status_code=result.status_code, detail=result.message)
    return OtpDispatchResponse(
        success=True,
        message=result.message,
        cooldown_seconds=result.cooldown_seconds,
        dev_otp=result.dev_otp,
        mode=result.mode
    )


def build_safe_user_response(user: User) -> SafeUserProfileResponse:
    """Constructs user payload with profile attributes and strictly excludes secrets."""
    profile_data: Dict[str, Any] = {}
    if user.role == "fisherman" and user.fisherman_profile:
        fp = user.fisherman_profile
        profile_data = {
            "age": fp.age,
            "location": fp.location,
            "vessel_name": fp.vessel_name,
            "vessel_registration_number": fp.vessel_registration_number,
            "fishing_type": fp.fishing_type,
            "preferred_language": fp.preferred_language,
            "emergency_contact": fp.emergency_contact,
            "government_id_type": fp.government_id_type,
            "government_id_number": fp.government_id_number,
            "emergency_contact_name": fp.emergency_contact_name,
            "emergency_contact_relation": fp.emergency_contact_relation,
            "safety_tracking_consent": bool(fp.safety_tracking_consent)
        }
    elif user.role == "researcher" and user.researcher_profile:
        rp = user.researcher_profile
        profile_data = {
            "area_of_research": rp.area_of_research,
            "institution": rp.institution,
            "research_specialization": rp.research_specialization
        }
    elif user.role == "authority" and user.authority_profile:
        ap = user.authority_profile
        profile_data = {
            "designation": ap.designation,
            "department": ap.department,
            "official_email": ap.official_email,
            "employee_id": ap.employee_id,
            "state_region": ap.state_region,
            "area_of_responsibility": ap.area_of_responsibility,
            "status": ap.status,
            "rejection_reason": ap.rejection_reason
        }

    return SafeUserProfileResponse(
        id=user.id,
        role=user.role,
        first_name=user.first_name,
        last_name=user.last_name,
        full_name=user.full_name,
        phone_number=user.phone_number,
        email=user.email,
        is_active=user.is_active,
        is_verified=user.is_verified,
        created_at=user.created_at.isoformat() if user.created_at else "",
        last_login_at=user.last_login_at.isoformat() if user.last_login_at else None,
        profile=profile_data
    )


# -----------------------------------------------------------------------------
# 1. Fisherman Authentication Routes
# -----------------------------------------------------------------------------
@auth_router.post("/fisherman/send-otp", response_model=OtpDispatchResponse)
async def fisherman_send_otp(req: FishermanSendOtpRequest, db: Session = Depends(get_db)):
    """Generates and dispatches OTP for Fisherman login or signup."""
    phone = normalize_phone(req.phone_number)
    if not is_valid_phone(phone):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid mobile number format. Please enter a valid 10-digit mobile number."
        )

    user = db.query(User).filter(User.phone_number == phone).first()

    if req.purpose == "login":
        if not user or user.role != "fisherman":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No ORCA fisherman account was found for this number. Please create an account first."
            )
        purpose_key = "fisherman_login"
        user_id = user.id
    else:  # signup
        if user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An ORCA account with this phone number already exists. Please log in."
            )
        purpose_key = "fisherman_signup"
        user_id = None

    result = await OtpService.generate_and_send_otp(
        db=db, identifier=phone, purpose=purpose_key, user_id=user_id
    )
    return otp_dispatch_response(result)


@auth_router.post("/fisherman/verify-otp")
async def fisherman_verify_otp(
    req: FishermanVerifyOtpRequest,
    response: Response,
    db: Session = Depends(get_db)
):
    """Verifies OTP for fisherman login or signup pre-check."""
    phone = normalize_phone(req.phone_number)
    purpose_key = f"fisherman_{req.purpose}"

    valid, msg = OtpService.verify_otp(db=db, identifier=phone, purpose=purpose_key, otp_code=req.otp)
    if not valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)

    if req.purpose == "signup":
        return GenericMessageResponse(
            success=True,
            message="Mobile number verified successfully. You may now complete registration."
        )

    # Login flow
    user = db.query(User).filter(User.phone_number == phone, User.role == "fisherman").first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No fisherman account found for this number."
        )

    # Update last login
    user.last_login_at = datetime.now(timezone.utc)
    db.commit()

    # Generate server-side session + HTTP-only cookie (JWT never returned in JSON)
    issue_session(db, user, response)

    welcome_msg = f"Welcome, {user.full_name} 👋\nORCA is ready to assist you at sea."

    return AuthResponse(
        user=build_safe_user_response(user),
        welcome_message=welcome_msg
    )


@auth_router.post("/fisherman/signup", response_model=GenericMessageResponse)
async def fisherman_signup(req: FishermanSignupRequest, db: Session = Depends(get_db)):
    """Registers a new Fisherman after mobile number verification."""
    phone = normalize_phone(req.phone_number)

    # Enforce verified phone in last 15 minutes
    if not OtpService.has_valid_recent_verification(db, phone, "fisherman_signup", validity_minutes=15):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mobile number not verified or verification expired. Please verify your phone number via OTP first."
        )

    existing = db.query(User).filter(User.phone_number == phone).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this mobile number already exists."
        )

    # Create User and Profile
    user = User(
        role="fisherman",
        first_name=req.name.split()[0],
        last_name=" ".join(req.name.split()[1:]) if len(req.name.split()) > 1 else None,
        full_name=req.name.strip(),
        phone_number=phone,
        email=None,
        password_hash=None,
        is_active=True,
        is_verified=True,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc)
    )
    db.add(user)
    db.flush()

    profile = FishermanProfile(
        user_id=user.id,
        age=req.age,
        location=req.location.strip(),
        vessel_name=req.vessel_name.strip() if req.vessel_name else None,
        vessel_registration_number=req.vessel_registration_number.strip().upper() if req.vessel_registration_number else None,
        fishing_type=req.fishing_type.strip() if req.fishing_type else None,
        preferred_language=req.preferred_language or "en",
        emergency_contact=normalize_phone(req.emergency_contact) if req.emergency_contact else None
    )
    db.add(profile)
    db.commit()

    return GenericMessageResponse(
        success=True,
        message="Signed up successfully!\n\nYour ORCA fisherman account has been created.\n\nPlease login to continue."
    )


# -----------------------------------------------------------------------------
# 2. Researcher Authentication Routes
# -----------------------------------------------------------------------------
@auth_router.post("/researcher/send-signup-otp", response_model=OtpDispatchResponse)
async def researcher_send_signup_otp(req: ResearcherSendSignupOtpRequest, db: Session = Depends(get_db)):
    """Sends email verification OTP for researcher registration."""
    email = normalize_email(req.email)
    if not is_valid_email(email):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid email format.")

    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists. Please login."
        )

    result = await OtpService.generate_and_send_otp(
        db=db, identifier=email, purpose="researcher_signup"
    )
    return otp_dispatch_response(result)


@auth_router.post("/researcher/verify-signup-otp", response_model=GenericMessageResponse)
async def researcher_verify_signup_otp(req: ResearcherVerifySignupOtpRequest, db: Session = Depends(get_db)):
    """Verifies researcher registration email OTP."""
    email = normalize_email(req.email)
    valid, msg = OtpService.verify_otp(db=db, identifier=email, purpose="researcher_signup", otp_code=req.otp)
    if not valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)

    return GenericMessageResponse(success=True, message="Email address verified successfully.")


@auth_router.post("/researcher/signup", response_model=GenericMessageResponse)
async def researcher_signup(req: ResearcherSignupRequest, db: Session = Depends(get_db)):
    """Registers a new Researcher account."""
    email = normalize_email(req.email)
    phone = normalize_phone(req.mobile_number)

    if not is_valid_phone(phone):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid mobile number format.")

    pwd_err = validate_password_strength(req.password)
    if pwd_err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=pwd_err)

    if not OtpService.has_valid_recent_verification(db, email, "researcher_signup", validity_minutes=15):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email address not verified. Please verify your email with an OTP first."
        )

    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered.")

    if db.query(User).filter(User.phone_number == phone).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Mobile number already registered.")

    pwd_hash = hash_password(req.password)
    full_name = f"{req.first_name.strip()} {req.last_name.strip()}"

    user = User(
        role="researcher",
        first_name=req.first_name.strip(),
        last_name=req.last_name.strip(),
        full_name=full_name,
        email=email,
        phone_number=phone,
        password_hash=pwd_hash,
        is_active=True,
        is_verified=True,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc)
    )
    db.add(user)
    db.flush()

    profile = ResearcherProfile(
        user_id=user.id,
        area_of_research=req.area_of_research.strip(),
        institution=req.institution.strip() if req.institution else None,
        research_specialization=req.research_specialization.strip() if req.research_specialization else None
    )
    db.add(profile)
    db.commit()

    # Send Welcome Email
    await email_provider.send_welcome_email(to_email=email, full_name=full_name, role="researcher")

    return GenericMessageResponse(
        success=True,
        message="Registration successful!\n\nWelcome to ORCA.\n\nYour researcher account has been created.\nPlease login to continue."
    )


@auth_router.post("/researcher/login")
async def researcher_login(
    req: ResearcherLoginRequest,
    response: Response,
    db: Session = Depends(get_db)
):
    """
    Two-step researcher login:
    Step 1 (otp is None): Validates email/mobile + password, dispatches OTP.
    Step 2 (otp provided): Validates OTP and issues session token.
    """
    raw_id = req.identifier.strip()
    clean_phone = normalize_phone(raw_id)
    clean_email = normalize_email(raw_id)

    user = db.query(User).filter(
        ((User.email == clean_email) | (User.phone_number == clean_phone)),
        User.role == "researcher"
    ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email/mobile number or password."
        )

    if not user.password_hash or not verify_password(req.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email/mobile number or password."
        )

    # Determine destination: email or mobile
    destination = user.email if "@" in raw_id or not user.phone_number else user.phone_number

    if not req.otp:
        # Step 1: Dispatch OTP to the verified destination (email or mobile)
        result = await OtpService.generate_and_send_otp(
            db=db, identifier=destination, purpose="researcher_login", user_id=user.id
        )
        dispatch = otp_dispatch_response(result)
        dispatch.step = "otp_required"
        dispatch.message = (
            f"Credentials verified. {dispatch.message}"
        )
        return dispatch

    # Step 2: Verify OTP
    valid, msg = OtpService.verify_otp(
        db=db, identifier=destination, purpose="researcher_login", otp_code=req.otp
    )
    if not valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)

    # Update login timestamp
    user.last_login_at = datetime.now(timezone.utc)
    db.commit()

    issue_session(db, user, response)

    welcome_msg = (
        f"Welcome back, {user.first_name} 👋\n"
        f"Your marine research intelligence workspace is ready."
    )

    return AuthResponse(
        user=build_safe_user_response(user),
        welcome_message=welcome_msg
    )


# -----------------------------------------------------------------------------
# 3. Government Authority Authentication Routes
# -----------------------------------------------------------------------------
@auth_router.post("/authority/request-access/send-otp", response_model=OtpDispatchResponse)
async def authority_send_access_otp(req: AuthoritySendSignupOtpRequest, db: Session = Depends(get_db)):
    """Dispatches OTP for Authority Official Email or Mobile verification."""
    target = normalize_email(req.target) if req.type == "email" else normalize_phone(req.target)

    if req.type == "email":
        if not is_valid_email(target):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid official email format.")
        existing = db.query(AuthorityProfile).filter(AuthorityProfile.official_email == target).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An official authority account with this email already exists."
            )
        purpose = "authority_request_access_email"
    else:
        if not is_valid_phone(target):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid mobile number format.")
        existing = db.query(User).filter(User.phone_number == target).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An account with this mobile number already exists."
            )
        purpose = "authority_request_access_mobile"

    result = await OtpService.generate_and_send_otp(
        db=db, identifier=target, purpose=purpose
    )
    return otp_dispatch_response(result)


@auth_router.post("/authority/request-access/verify-otp", response_model=GenericMessageResponse)
async def authority_verify_access_otp(req: AuthorityVerifySignupOtpRequest, db: Session = Depends(get_db)):
    """Verifies official email or mobile OTP during access request."""
    target = normalize_email(req.target) if req.type == "email" else normalize_phone(req.target)
    purpose = f"authority_request_access_{req.type}"

    valid, msg = OtpService.verify_otp(db=db, identifier=target, purpose=purpose, otp_code=req.otp)
    if not valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)

    return GenericMessageResponse(success=True, message=f"Official {req.type} verified successfully.")


@auth_router.post("/authority/request-access", response_model=GenericMessageResponse)
async def authority_request_access(req: AuthorityRequestAccessRequest, db: Session = Depends(get_db)):
    """
    Submits an official access request for Government Port Authority / Coast Guard.
    Enforces email and mobile verification, creates account in PENDING status.
    """
    email = normalize_email(req.official_email)
    phone = normalize_phone(req.mobile_number)
    emp_id = req.employee_id.strip().upper()

    pwd_err = validate_password_strength(req.password)
    if pwd_err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=pwd_err)

    if not OtpService.has_valid_recent_verification(db, email, "authority_request_access_email", validity_minutes=20):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Official email has not been verified with OTP."
        )

    if not OtpService.has_valid_recent_verification(db, phone, "authority_request_access_mobile", validity_minutes=20):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Official mobile number has not been verified with OTP."
        )

    if db.query(AuthorityProfile).filter(AuthorityProfile.official_email == email).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Official email already registered.")

    if db.query(AuthorityProfile).filter(AuthorityProfile.employee_id == emp_id).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Employee / Government ID already registered.")

    if db.query(User).filter(User.phone_number == phone).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Mobile number already registered.")

    pwd_hash = hash_password(req.password)
    full_name = req.full_name.strip()

    user = User(
        role="authority",
        first_name=full_name.split()[0],
        last_name=" ".join(full_name.split()[1:]) if len(full_name.split()) > 1 else None,
        full_name=full_name,
        email=email,
        phone_number=phone,
        password_hash=pwd_hash,
        is_active=True,
        is_verified=True,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc)
    )
    db.add(user)
    db.flush()

    profile = AuthorityProfile(
        user_id=user.id,
        designation=req.designation.strip(),
        department=req.department.strip(),
        official_email=email,
        employee_id=emp_id,
        state_region=req.state_region.strip(),
        area_of_responsibility=req.area_of_responsibility.strip(),
        status="pending"  # PENDING APPROVAL
    )
    db.add(profile)
    db.commit()

    return GenericMessageResponse(
        success=True,
        status="pending",
        message=(
            "Official access request submitted.\n\n"
            "Status: PENDING APPROVAL\n\n"
            "Your credentials have been submitted for administrator review. "
            "Access to the Authority Surveillance Console will be granted once approved."
        )
    )


@auth_router.post("/authority/login")
async def authority_login(
    req: AuthorityLoginRequest,
    response: Response,
    db: Session = Depends(get_db)
):
    """
    Two-step Authority login with approval check:
    Step 1: Check credentials & approved status -> dispatch OTP.
    Step 2: Validate OTP -> issue token.
    """
    ident = req.identifier.strip()
    norm_email = normalize_email(ident)
    norm_phone = normalize_phone(ident)
    norm_empid = ident.upper()

    user = (
        db.query(User)
        .join(AuthorityProfile, User.id == AuthorityProfile.user_id)
        .filter(
            (User.role == "authority"),
            (
                (AuthorityProfile.official_email == norm_email) |
                (AuthorityProfile.employee_id == norm_empid) |
                (User.phone_number == norm_phone)
            )
        )
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid official credentials or password."
        )

    if not user.password_hash or not verify_password(req.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid official credentials or password."
        )

    profile = user.authority_profile
    if not profile:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Authority profile not found.")

    # Enforce Approval Status Check
    if profile.status == "pending":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your authority access request is still pending approval. An administrator must approve your account before you can log in."
        )
    elif profile.status == "rejected":
        reason_txt = f" Reason: {profile.rejection_reason}" if profile.rejection_reason else ""
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Your authority account access request has been rejected.{reason_txt}"
        )
    elif profile.status == "suspended":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your official authority account has been suspended. Please contact command headquarters."
        )
    elif profile.status != "approved":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Account status '{profile.status}' does not permit login."
        )

    destination = profile.official_email or user.phone_number

    if not req.otp:
        # Step 1: Dispatch OTP to the verified official contact
        result = await OtpService.generate_and_send_otp(
            db=db, identifier=destination, purpose="authority_login", user_id=user.id
        )
        dispatch = otp_dispatch_response(result)
        dispatch.step = "otp_required"
        dispatch.message = f"Official credentials verified. {dispatch.message}"
        return dispatch

    # Step 2: Verify OTP
    valid, msg = OtpService.verify_otp(
        db=db, identifier=destination, purpose="authority_login", otp_code=req.otp
    )
    if not valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)

    user.last_login_at = datetime.now(timezone.utc)
    db.commit()

    issue_session(db, user, response)

    welcome_msg = (
        f"Welcome, {user.full_name} 👋\n"
        f"{profile.designation}\n"
        f"ORCA Authority Surveillance Console is ready."
    )

    return AuthResponse(
        user=build_safe_user_response(user),
        welcome_message=welcome_msg
    )


# -----------------------------------------------------------------------------
# 4. Administrator Authentication & Authority Approval Controls (Parts 1, 15, 16, 17)
# -----------------------------------------------------------------------------
@auth_router.post("/admin/login")
def admin_login(
    req: AdminLoginRequest,
    response: Response,
    db: Session = Depends(get_db)
):
    """Authenticates administrator credentials and returns session token and cookie."""
    email = normalize_email(req.email)
    user = db.query(User).filter(User.email == email, User.role == "admin").first()
    if not user or not user.password_hash or not verify_password(req.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid administrator credentials or password."
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Administrator account is inactive."
        )

    user.last_login_at = datetime.now(timezone.utc)
    db.commit()

    issue_session(db, user, response)

    return AuthResponse(
        user=build_safe_user_response(user),
        welcome_message=f"Welcome, Administrator {user.full_name} 👋\nORCA Administrative Control Console is active."
    )


@auth_router.get("/admin/authority-requests")
def list_authority_requests(
    status_filter: Optional[str] = None,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Lists Government Authority access requests for administrator review.
    Enforces administrator role check (Part 1).
    """
    query = db.query(AuthorityProfile).join(User, AuthorityProfile.user_id == User.id)
    if status_filter:
        query = query.filter(AuthorityProfile.status == status_filter)
    profiles = query.order_by(User.created_at.desc()).all()

    results = []
    for p in profiles:
        results.append({
            "user_id": p.user_id,
            "full_name": p.user.full_name,
            "official_email": p.official_email,
            "employee_id": p.employee_id,
            "department": p.department,
            "designation": p.designation,
            "state_region": p.state_region,
            "area_of_responsibility": p.area_of_responsibility,
            "status": p.status,
            "created_at": p.user.created_at.isoformat() if p.user.created_at else "",
            "reviewed_by": p.reviewed_by,
            "reviewed_at": p.reviewed_at.isoformat() if p.reviewed_at else None,
            "rejection_reason": p.rejection_reason
        })
    return {"requests": results, "total": len(results)}


@auth_router.post("/admin/approve-authority", response_model=GenericMessageResponse)
def review_authority_request(
    req: AuthorityApprovalRequest,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Updates status for an authority access request with state transition validation (Parts 1, 16, 17).
    Requires administrator privilege.
    """
    profile = db.query(AuthorityProfile).filter(AuthorityProfile.user_id == req.authority_user_id).first()
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Authority profile not found.")

    current_status = profile.status
    action = req.action

    if action == "approve":
        if current_status == "approved":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Authority account is already approved."
            )
        new_status = "approved"
        profile.rejection_reason = None
    elif action == "reject":
        if current_status == "approved":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot reject an already approved authority. Use 'suspend' instead."
            )
        new_status = "rejected"
        profile.rejection_reason = req.reason or "Credentials could not be verified by administrator."
    elif action == "suspend":
        if current_status != "approved":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot suspend account with status '{current_status}'. Only approved accounts can be suspended."
            )
        new_status = "suspended"
        if req.reason:
            profile.rejection_reason = req.reason
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid action '{action}'. Permitted actions: approve, reject, suspend."
        )

    profile.status = new_status
    # Record the real reviewing administrator's identity (never a generic placeholder).
    if current_admin.full_name and current_admin.email:
        profile.reviewed_by = f"{current_admin.full_name} <{current_admin.email}>"
    else:
        profile.reviewed_by = current_admin.email or current_admin.full_name or str(current_admin.id)
    profile.reviewed_at = datetime.now(timezone.utc)
    db.commit()

    return GenericMessageResponse(
        success=True,
        status=new_status,
        message=f"Authority request for {profile.official_email} has been updated to '{new_status.upper()}'."
    )


# -----------------------------------------------------------------------------
# 5. Session State & Profile Endpoints
# -----------------------------------------------------------------------------
@auth_router.get("/me", response_model=SafeUserProfileResponse)
def get_current_user_profile(user: User = Depends(get_current_user)):
    """Returns safe profile info for the currently authenticated user."""
    return build_safe_user_response(user)


@auth_router.post("/logout", response_model=GenericMessageResponse)
def logout_user(
    request: Request,
    response: Response,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Revokes the current session and clears the auth cookie."""
    token = None
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header[7:].strip()
    if not token:
        token = request.cookies.get("orca_token")

    if token:
        payload = decode_access_token(token)
        if payload and "jti" in payload:
            jti = payload["jti"]
            session_rec = db.query(SessionRecord).filter(SessionRecord.id == jti).first()
            if session_rec:
                session_rec.is_revoked = True
                db.commit()

    response.delete_cookie(
        key="orca_token",
        httponly=True,
        secure=settings.AUTH_COOKIE_SECURE,
        samesite=settings.AUTH_COOKIE_SAMESITE
    )
    return GenericMessageResponse(success=True, message="Logged out successfully.")


# -----------------------------------------------------------------------------
# 6. Role-Protected Test Endpoints for RBAC Verification
# -----------------------------------------------------------------------------
@auth_router.get("/protected/fisherman")
def protected_fisherman_endpoint(user: User = Depends(require_roles(["fisherman"]))):
    """Enforces fisherman role only."""
    return {"message": f"Hello Fisherman {user.full_name}, access granted.", "role": user.role}


@auth_router.get("/protected/researcher")
def protected_researcher_endpoint(user: User = Depends(require_roles(["researcher"]))):
    """Enforces researcher role only."""
    return {"message": f"Hello Researcher {user.full_name}, access granted.", "role": user.role}


@auth_router.get("/protected/authority")
def protected_authority_endpoint(user: User = Depends(require_roles(["authority"]))):
    """Enforces approved authority role only."""
    return {"message": f"Hello Officer {user.full_name}, access granted.", "role": user.role}


# -----------------------------------------------------------------------------
# 7. Fisherman Registration: self-service profile + administrator management
#    (functionality adapted from the reference vessel.zip registration flow,
#     reusing ORCA's existing session/RBAC stack — no second user or role model)
# -----------------------------------------------------------------------------
def apply_fisherman_profile_update(profile: FishermanProfile, req: FishermanProfileUpdateRequest) -> None:
    """
    Applies a partial update onto an existing FishermanProfile.

    None means "leave unchanged"; an empty string clears a nullable text field.
    Fields that are nullable=False in the model (age, location) are only
    reassigned when a valid non-empty value is supplied.
    """
    if req.age is not None:
        profile.age = req.age

    if req.location is not None and req.location.strip():
        profile.location = req.location.strip()

    if req.vessel_name is not None:
        profile.vessel_name = req.vessel_name.strip() or None

    if req.vessel_registration_number is not None:
        profile.vessel_registration_number = req.vessel_registration_number.strip().upper() or None

    if req.fishing_type is not None:
        profile.fishing_type = req.fishing_type.strip() or None

    if req.preferred_language is not None and req.preferred_language.strip():
        profile.preferred_language = req.preferred_language.strip()

    if req.emergency_contact is not None:
        raw_contact = req.emergency_contact.strip()
        profile.emergency_contact = normalize_phone(raw_contact) if raw_contact else None

    if req.government_id_type is not None:
        profile.government_id_type = req.government_id_type.strip() or None

    if req.government_id_number is not None:
        profile.government_id_number = req.government_id_number.strip() or None

    if req.emergency_contact_name is not None:
        profile.emergency_contact_name = req.emergency_contact_name.strip() or None

    if req.emergency_contact_relation is not None:
        profile.emergency_contact_relation = req.emergency_contact_relation.strip() or None

    if req.safety_tracking_consent is not None:
        profile.safety_tracking_consent = bool(req.safety_tracking_consent)


@auth_router.put("/fishermen/me/profile", response_model=SafeUserProfileResponse)
def update_own_fisherman_profile(
    req: FishermanProfileUpdateRequest,
    current_user: User = Depends(require_roles(["fisherman"])),
    db: Session = Depends(get_db)
):
    """
    Self-service registration edit.

    Identity always comes from the validated session — a fisherman can only ever
    modify their own profile (no user_id parameter is accepted), and this route
    is restricted to the 'fisherman' role, so normal fishermen gain no ability to
    view or edit anyone else's registration.
    """
    profile = current_user.fisherman_profile
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No registration profile exists for the current account."
        )

    apply_fisherman_profile_update(profile, req)
    current_user.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(current_user)

    return build_safe_user_response(current_user)


@auth_router.get("/admin/fishermen", response_model=AdminFishermanListResponse)
def list_fishermen(
    search: Optional[str] = None,
    active_only: bool = False,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Administrator-only directory of registered fishermen."""
    query = db.query(User).filter(User.role == "fisherman")

    if active_only:
        query = query.filter(User.is_active.is_(True))

    term = (search or "").strip()
    if term:
        like = f"%{term}%"
        query = query.outerjoin(FishermanProfile, FishermanProfile.user_id == User.id).filter(
            or_(
                User.full_name.ilike(like),
                User.phone_number.ilike(like),
                FishermanProfile.location.ilike(like),
                FishermanProfile.vessel_name.ilike(like),
                FishermanProfile.vessel_registration_number.ilike(like),
                FishermanProfile.government_id_number.ilike(like)
            )
        )

    users = query.order_by(User.created_at.desc()).all()
    items = [build_safe_user_response(u) for u in users]
    return AdminFishermanListResponse(fishermen=items, total=len(items))


@auth_router.post(
    "/admin/fishermen",
    response_model=SafeUserProfileResponse,
    status_code=status.HTTP_201_CREATED
)
def create_fisherman(
    req: AdminFishermanCreateRequest,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Administrator-driven fisherman registration (mirrors the reference app's
    "Register Fisherman" action). Authorisation is the server-side admin
    session; the OTP signup flow for self-registration remains untouched.
    """
    phone = normalize_phone(req.phone_number)
    if not is_valid_phone(phone):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A valid 10-digit Indian mobile number is required."
        )

    existing = db.query(User).filter(User.phone_number == phone).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this mobile number already exists."
        )

    name_parts = req.name.strip().split()
    user = User(
        role="fisherman",
        first_name=name_parts[0],
        last_name=" ".join(name_parts[1:]) if len(name_parts) > 1 else None,
        full_name=req.name.strip(),
        phone_number=phone,
        email=None,
        password_hash=None,
        is_active=True,
        is_verified=True,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc)
    )
    db.add(user)
    db.flush()

    profile = FishermanProfile(
        user_id=user.id,
        age=req.age,
        location=req.location.strip(),
        vessel_name=req.vessel_name.strip() if req.vessel_name else None,
        vessel_registration_number=req.vessel_registration_number.strip().upper() if req.vessel_registration_number else None,
        fishing_type=req.fishing_type.strip() if req.fishing_type else None,
        preferred_language=req.preferred_language or "en",
        emergency_contact=normalize_phone(req.emergency_contact) if req.emergency_contact else None,
        government_id_type=req.government_id_type.strip() if req.government_id_type else None,
        government_id_number=req.government_id_number.strip() if req.government_id_number else None,
        emergency_contact_name=req.emergency_contact_name.strip() if req.emergency_contact_name else None,
        emergency_contact_relation=req.emergency_contact_relation.strip() if req.emergency_contact_relation else None,
        safety_tracking_consent=bool(req.safety_tracking_consent)
    )
    db.add(profile)
    db.commit()
    db.refresh(user)

    logger.info(
        "Administrator %s registered fisherman %s (%s)",
        current_admin.id, user.id, phone
    )
    return build_safe_user_response(user)


@auth_router.put("/admin/fishermen/{user_id}", response_model=SafeUserProfileResponse)
def update_fisherman(
    user_id: str,
    req: AdminFishermanUpdateRequest,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Administrator-only edit of a fisherman registration (profile + activation)."""
    user = db.query(User).filter(User.id == user_id, User.role == "fisherman").first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fisherman account not found."
        )

    profile = user.fisherman_profile
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Registration profile not found for this account."
        )

    apply_fisherman_profile_update(profile, req)

    if req.is_active is not None:
        user.is_active = bool(req.is_active)

    user.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)

    logger.info("Administrator %s updated fisherman profile %s", current_admin.id, user.id)
    return build_safe_user_response(user)


# -----------------------------------------------------------------------------
# Fisherman Alert Sending (administrator-only marine safety SMS dispatch)
# -----------------------------------------------------------------------------
#: Compact alert templates adapted from the reference vessel.zip alert page.
#: Kept within the 160-character GSM limit enforced by ORCA's SMS gateway.
ALERT_TEMPLATES: Dict[str, str] = {
    "CYCLONE": "ORCA ALERT: Severe cyclone near your fishing area. Strong winds/high waves. Move to safe harbor now. CG:1554",
    "HIGH_WAVE": "ORCA ALERT: High waves detected near your position. Avoid going further offshore, move toward safe area.",
    "STRONG_WIND": "ORCA ALERT: Strong winds in your fishing area. Follow the safe route and return toward shore if advised.",
    "VESSEL_GEOFENCE": "ORCA ALERT: Your vessel is in a restricted/unsafe marine zone. Verify position and follow authorized navigation guidance.",
    "RETURN_TO_SHORE": "ORCA ALERT: Weather deteriorating offshore. Return to the nearest safe landing port immediately.",
    "EMERGENCY": "ORCA ALERT: Maritime hazard in your operating sector. Heed emergency broadcast, contact Coast Guard 1554 if in distress.",
    "GENERAL": "ORCA ALERT: {{message}} Please follow safety instructions."
}

ALERT_DUPLICATE_WINDOW_SECONDS = 30


def _mask_phone_for_alert(phone: Optional[str]) -> str:
    """Masks all but the last 4 digits of a phone number for UI/audit display."""
    digits = re.sub(r"\D", "", phone or "")
    if len(digits) < 4:
        return "****"
    return f"+91******{digits[-4:]}"


def _build_alert_message(
    alert_type: str,
    custom_message: Optional[str],
    vessel_name: Optional[str]
) -> str:
    """Composes the final GSM-compliant (<=160 chars) alert text from the template."""
    template = ALERT_TEMPLATES.get(alert_type, ALERT_TEMPLATES["GENERAL"])
    note = (custom_message or "").strip()

    if alert_type == "GENERAL":
        message = template.replace("{{message}}", note or "Maritime safety advisory in effect.")
    else:
        message = template
        if note:
            message = f"{message} Note: {note}"

    if vessel_name:
        message = f"{message} Vessel: {vessel_name}."

    # ORCA's SMS dissemination channel is strictly GSM: hard-truncate at 160,
    # matching format_near_shore_sms() behaviour in app/dissemination.
    return message[:160]


@auth_router.post(
    "/admin/fishermen/alerts",
    response_model=AdminAlertDispatchResponse,
    status_code=status.HTTP_201_CREATED
)
def send_fisherman_alert(
    req: AdminAlertSendRequest,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Administrator-only marine safety alert dispatch to a registered fisherman.

    Routes the composed message through ORCA's existing SMS dissemination
    gateway (app.dissemination.sms_client.sms_gateway) and records an audit
    entry in the additive `alerts` table — no parallel delivery mechanism.
    """
    recipient = db.query(User).filter(
        User.id == req.recipient_user_id,
        User.role == "fisherman"
    ).first()
    if not recipient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fisherman recipient not found."
        )

    if not recipient.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This fisherman account is deactivated; alerts cannot be delivered."
        )

    phone = normalize_phone(recipient.phone_number or "")
    if not is_valid_phone(phone):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The registered mobile number for this fisherman is invalid."
        )

    alert_type = (req.alert_type or "GENERAL").upper()
    if alert_type not in FISHERMAN_ALERT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown alert type. Allowed: {', '.join(FISHERMAN_ALERT_TYPES)}."
        )

    # Duplicate accidental-dispatch protection (same recipient + type within 30s)
    window_start = datetime.now(timezone.utc) - timedelta(seconds=ALERT_DUPLICATE_WINDOW_SECONDS)
    recent = db.query(AlertRecord).filter(
        AlertRecord.recipient_user_id == str(recipient.id),
        AlertRecord.alert_type == alert_type,
        AlertRecord.created_at >= window_start
    ).first()
    if recent:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="An identical alert was recently dispatched to this fisherman. Please wait before resending."
        )

    profile = recipient.fisherman_profile if recipient.role == "fisherman" else None
    vessel_name = getattr(profile, "vessel_name", None) if profile else None
    final_message = _build_alert_message(alert_type, req.custom_message, vessel_name)
    alert_id = f"ORCA-ALERT-{uuid.uuid4().hex[:8].upper()}"
    now = datetime.now(timezone.utc)

    record = AlertRecord(
        id=alert_id,
        alert_type=alert_type,
        message=final_message,
        recipient_user_id=str(recipient.id),
        recipient_phone=phone,
        recipient_name=recipient.full_name,
        vessel_name=vessel_name,
        status="PENDING",
        provider=None,
        char_count=len(final_message),
        sent_by_admin_id=str(current_admin.id),
        created_at=now
    )
    db.add(record)

    # Dispatch through the existing pluggable ORCA SMS gateway.
    dispatch_info = sms_gateway.send_sms(recipient=phone, text=final_message)

    record.provider = dispatch_info.get("gateway") or "ORCA-SMSGateway"
    record.provider_message_id = dispatch_info.get("provider_message_id")
    gateway_success = dispatch_info.get("success", True)
    within_limit = dispatch_info.get("within_160_limit", False)
    record.status = "ACCEPTED" if gateway_success and within_limit else "FAILED"
    if record.status == "FAILED":
        record.failure_reason = (
            dispatch_info.get("failure_reason")
            or "The SMS gateway could not dispatch the message."
        )

    db.commit()
    db.refresh(record)

    logger.info(
        "Administrator %s dispatched %s alert %s to %s (%s)",
        current_admin.id, alert_type, alert_id, recipient.full_name,
        _mask_phone_for_alert(phone)
    )

    if record.status != "ACCEPTED":
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=record.failure_reason or "The SMS gateway could not dispatch the message."
        )

    return AdminAlertDispatchResponse(
        success=True,
        message=(
            "Alert accepted by TextBee and queued for delivery."
            if record.provider == "TextBee" else "Alert accepted by the ORCA SMS simulator. No real SMS was transmitted."
        ),
        alert_id=alert_id,
        alert_type=alert_type,
        status=record.status,
        provider=record.provider or "ORCA-SMSGateway",
        recipient_masked=_mask_phone_for_alert(phone),
        char_count=len(final_message),
        within_160_limit=len(final_message) <= 160,
        message_preview=final_message,
        sent_at=now.isoformat()
    )


@auth_router.get(
    "/admin/fishermen/alerts",
    response_model=AdminAlertHistoryResponse
)
def list_fisherman_alerts(
    status_filter: Optional[str] = None,
    alert_type: Optional[str] = None,
    limit: int = 50,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Administrator-only alert dispatch audit history (recipient phones masked)."""
    query = db.query(AlertRecord)

    status_term = (status_filter or "").strip().upper()
    if status_term and status_term != "ALL":
        query = query.filter(AlertRecord.status == status_term)

    type_term = (alert_type or "").strip().upper()
    if type_term and type_term != "ALL":
        query = query.filter(AlertRecord.alert_type == type_term)

    max_rows = max(1, min(limit or 50, 100))
    records = query.order_by(AlertRecord.created_at.desc()).limit(max_rows).all()

    items = [
        AdminAlertHistoryItem(
            id=r.id,
            alert_type=r.alert_type,
            message=r.message,
            recipient_masked=_mask_phone_for_alert(r.recipient_phone),
            recipient_name=r.recipient_name,
            vessel_name=r.vessel_name,
            status=r.status,
            provider=r.provider,
            char_count=r.char_count,
            failure_reason=r.failure_reason,
            sent_by_admin_id=r.sent_by_admin_id,
            created_at=r.created_at.isoformat() if r.created_at else ""
        )
        for r in records
    ]
    return AdminAlertHistoryResponse(alerts=items, total=len(items))


# -----------------------------------------------------------------------------
# TextBee SMS Delivery Webhook
# -----------------------------------------------------------------------------

TEXTBEE_WEBHOOK_EVENTS = {
    "MESSAGE_SENT": "SENT",
    "MESSAGE_DELIVERED": "DELIVERED",
    "MESSAGE_FAILED": "FAILED",
    "UNKNOWN_STATE": "UNKNOWN",
}

TEXTBEE_STATUS_RANK = {
    "PENDING": 0,
    "ACCEPTED": 1,
    "UNKNOWN": 2,
    "SENT": 3,
    "DELIVERED": 4,
    "FAILED": 4,
}


@auth_router.post(
    "/webhooks/textbee",
    status_code=status.HTTP_200_OK,
)
async def textbee_delivery_webhook(
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Receive and securely process TextBee SMS delivery events.

    TextBee signs the exact raw request body with HMAC-SHA256 and sends the
    lowercase hexadecimal digest in X-Signature.

    The webhook is intentionally unauthenticated through ORCA JWT because
    TextBee cannot provide a browser/user session. Authenticity is established
    exclusively through the configured webhook signing secret.
    """

    webhook_secret = settings.TEXTBEE_WEBHOOK_SECRET

    if not webhook_secret:
        logger.error(
            "TextBee webhook received but TEXTBEE_WEBHOOK_SECRET is not configured"
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="TextBee webhook is not configured.",
        )

    signature = request.headers.get("X-Signature", "").strip()

    if not signature:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing TextBee webhook signature.",
        )

    raw_body = await request.body()

    expected_signature = hmac.new(
        webhook_secret.encode("utf-8"),
        raw_body,
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(signature.lower(), expected_signature):
        logger.warning("Rejected TextBee webhook with invalid signature")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid TextBee webhook signature.",
        )

    try:
        payload = json.loads(raw_body)
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON payload.",
        )

    if not isinstance(payload, dict):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="TextBee webhook payload must be a JSON object.",
        )

    event_type = str(payload.get("webhookEvent") or "").strip().upper()
    idempotency_key = str(payload.get("idempotencyKey") or "").strip()
    sms_id = str(payload.get("smsId") or "").strip()
    sms_batch_id = str(payload.get("smsBatchId") or "").strip()
    recipient = str(payload.get("recipient") or "").strip()

    if not event_type or not idempotency_key or not sms_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing required TextBee webhook fields.",
        )

    if event_type not in TEXTBEE_WEBHOOK_EVENTS:
        logger.info(
            "Ignoring unsupported TextBee webhook event: %s",
            event_type,
        )
        return {
            "success": True,
            "processed": False,
            "message": "Unsupported TextBee event ignored.",
        }

    # -------------------------------------------------------------------------
    # Idempotency
    # -------------------------------------------------------------------------
    existing_event = (
        db.query(TextBeeWebhookEvent)
        .filter(
            TextBeeWebhookEvent.idempotency_key == idempotency_key
        )
        .first()
    )

    if existing_event:
        logger.info(
            "Ignoring duplicate TextBee webhook: %s",
            idempotency_key,
        )
        return {
            "success": True,
            "processed": False,
            "duplicate": True,
        }

    # -------------------------------------------------------------------------
    # Store the webhook delivery before processing the alert.
    # -------------------------------------------------------------------------
    webhook_event = TextBeeWebhookEvent(
        id=f"TEXTBEE-{uuid.uuid4().hex}",
        event_id=idempotency_key,
        idempotency_key=idempotency_key,
        event_type=event_type,
        sms_id=sms_id,
        sms_batch_id=sms_batch_id or None,
        recipient_phone=recipient or None,
        processed_at=datetime.now(timezone.utc),
    )

    db.add(webhook_event)

    # The idempotency key is unique. Flush now so concurrent duplicate
    # deliveries cannot both proceed as new events.
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        logger.info(
            "Ignoring concurrent duplicate TextBee webhook: %s",
            idempotency_key
        )
        return {
            "success": True,
            "processed": False,
            "duplicate": True,
        }

    # -------------------------------------------------------------------------
    # Outbound delivery events must identify the ORCA alert.
    # -------------------------------------------------------------------------
    if not sms_batch_id or not recipient:
        db.commit()

        logger.warning(
            "TextBee %s webhook missing smsBatchId or recipient: %s",
            event_type,
            idempotency_key,
        )

        return {
            "success": True,
            "processed": False,
            "message": "Webhook recorded but no outbound alert identifier was provided.",
        }

    normalized_recipient = normalize_phone(recipient)

    alert = (
        db.query(AlertRecord)
        .filter(
            AlertRecord.provider_message_id == sms_batch_id,
            AlertRecord.recipient_phone == normalized_recipient,
        )
        .first()
    )

    if not alert:
        db.commit()

        logger.warning(
            "No ORCA alert matched TextBee webhook batch=%s recipient=%s",
            sms_batch_id,
            _mask_phone_for_alert(normalized_recipient),
        )

        # The webhook itself is valid, so acknowledge it. Returning 4xx would
        # make TextBee retry an event that ORCA cannot associate.
        return {
            "success": True,
            "processed": False,
            "message": "Webhook acknowledged; no matching ORCA alert found.",
        }

    new_status = TEXTBEE_WEBHOOK_EVENTS[event_type]
    current_status = (alert.status or "PENDING").upper()

    current_rank = TEXTBEE_STATUS_RANK.get(current_status, 0)
    new_rank = TEXTBEE_STATUS_RANK.get(new_status, 0)

    # -------------------------------------------------------------------------
    # Never move an alert backwards in its delivery lifecycle.
    # -------------------------------------------------------------------------

    if current_status in {"DELIVERED", "FAILED"} and new_status != current_status:
        db.commit()

        return {
            "success": True,
            "processed": False,
            "final_status": current_status,
        }

    if new_rank < current_rank:
        db.commit()
        return {
            "success": True,
            "processed": False,
            "status_regression": True,
            "status": current_status
        }

    alert.status = new_status

    if new_status == "FAILED":
        error_message = str(payload.get("errorMessage") or "").strip()

        if error_message:
            alert.failure_reason = error_message
        else:
            alert.failure_reason = "TextBee reported SMS delivery failure."

    elif new_status == "UNKNOWN":
        alert.failure_reason = (
            "TextBee reported an unknown SMS delivery state."
        )

    elif new_status in {"SENT", "DELIVERED"}:
        alert.failure_reason = None

    db.commit()

    logger.info(
        "Updated ORCA alert %s from TextBee event %s: %s -> %s",
        alert.id,
        event_type,
        current_status,
        new_status,
    )

    return {
        "success": True,
        "processed": True,
        "alert_id": alert.id,
        "status": new_status,
    }
