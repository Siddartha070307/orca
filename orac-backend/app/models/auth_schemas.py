"""Pydantic schemas for ORCA Role-Based Authentication with strict validation."""
from typing import Literal, Optional, Dict, Any, List
from pydantic import BaseModel, Field, EmailStr, field_validator


class FishermanSendOtpRequest(BaseModel):
    phone_number: str = Field(..., description="Mobile number")
    purpose: Literal["login", "signup"] = Field(..., description="Action purpose")


class FishermanVerifyOtpRequest(BaseModel):
    phone_number: str = Field(..., description="Mobile number")
    otp: str = Field(..., pattern=r"^\d{6}$", description="Strict 6-digit numeric OTP code")
    purpose: Literal["login", "signup"] = Field(..., description="Action purpose")


class FishermanSignupRequest(BaseModel):
    phone_number: str = Field(..., description="Verified mobile number")
    name: str = Field(..., min_length=2, max_length=100, description="Full name of fisherman")
    age: int = Field(..., ge=16, le=100, description="Age in years")
    location: str = Field(..., min_length=2, max_length=200, description="Base port / coastal village")
    vessel_name: Optional[str] = Field(None, max_length=100)
    vessel_registration_number: Optional[str] = Field(None, max_length=50)
    fishing_type: Optional[str] = Field(None, max_length=50)
    preferred_language: Optional[str] = Field("en", max_length=20)
    emergency_contact: Optional[str] = Field(None, max_length=20)


class ResearcherSendSignupOtpRequest(BaseModel):
    email: EmailStr = Field(..., description="Researcher email address")


class ResearcherVerifySignupOtpRequest(BaseModel):
    email: EmailStr = Field(..., description="Researcher email address")
    otp: str = Field(..., pattern=r"^\d{6}$", description="Strict 6-digit numeric OTP code")


class ResearcherSignupRequest(BaseModel):
    email: EmailStr = Field(..., description="Verified email address")
    first_name: str = Field(..., min_length=2, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    mobile_number: str = Field(..., min_length=8, max_length=20)
    area_of_research: str = Field(..., min_length=2, max_length=200)
    institution: Optional[str] = Field(None, max_length=200)
    research_specialization: Optional[str] = Field(None, max_length=200)
    password: str = Field(..., min_length=8, max_length=128)
    confirm_password: str = Field(..., min_length=8, max_length=128)

    @field_validator("confirm_password")
    @classmethod
    def passwords_match(cls, v, info):
        if "password" in info.data and v != info.data["password"]:
            raise ValueError("Passwords do not match.")
        return v


class ResearcherLoginRequest(BaseModel):
    identifier: str = Field(..., description="Email or Mobile number")
    password: str = Field(..., min_length=1, description="Account password")
    otp: Optional[str] = Field(None, pattern=r"^\d{6}$", description="Strict 6-digit numeric OTP code if step 2")


class AuthoritySendSignupOtpRequest(BaseModel):
    type: Literal["email", "mobile"] = Field(...)
    target: str = Field(..., description="Official email address or mobile number")


class AuthorityVerifySignupOtpRequest(BaseModel):
    type: Literal["email", "mobile"] = Field(...)
    target: str = Field(..., description="Official email address or mobile number")
    otp: str = Field(..., pattern=r"^\d{6}$", description="Strict 6-digit numeric OTP code")


class AuthorityRequestAccessRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=200)
    designation: str = Field(..., min_length=2, max_length=100)
    department: str = Field(..., min_length=2, max_length=150)
    official_email: EmailStr = Field(..., description="Government / Port official email")
    mobile_number: str = Field(..., min_length=8, max_length=20)
    employee_id: str = Field(..., min_length=2, max_length=100)
    state_region: str = Field(..., min_length=2, max_length=100)
    area_of_responsibility: str = Field(..., min_length=2, max_length=200)
    password: str = Field(..., min_length=8, max_length=128)
    confirm_password: str = Field(..., min_length=8, max_length=128)

    @field_validator("confirm_password")
    @classmethod
    def passwords_match(cls, v, info):
        if "password" in info.data and v != info.data["password"]:
            raise ValueError("Passwords do not match.")
        return v


class AuthorityLoginRequest(BaseModel):
    identifier: str = Field(..., description="Official email, employee ID, or registered mobile")
    password: str = Field(..., min_length=1)
    otp: Optional[str] = Field(None, pattern=r"^\d{6}$", description="Strict 6-digit numeric OTP code if step 2")


class AuthorityApprovalRequest(BaseModel):
    authority_user_id: str = Field(..., description="User ID of authority to review")
    action: Literal["approve", "reject", "suspend"] = Field(
        ...,
        description="Administrative action: approve, reject, or suspend"
    )
    reason: Optional[str] = Field(None, max_length=500, description="Administrative reason")


class AdminLoginRequest(BaseModel):
    email: EmailStr = Field(..., description="Administrator email address")
    password: str = Field(..., min_length=1, description="Administrator password")


class SafeUserProfileResponse(BaseModel):
    id: str
    role: str
    first_name: str
    last_name: Optional[str] = None
    full_name: str
    phone_number: Optional[str] = None
    email: Optional[str] = None
    is_active: bool
    is_verified: bool
    created_at: str
    last_login_at: Optional[str] = None
    profile: Optional[Dict[str, Any]] = None


class AuthResponse(BaseModel):
    """Login success payload.

    The JWT is intentionally NOT part of this response: it is issued only as an
    HTTP-only, SameSite cookie, so JavaScript never receives the token value.
    """
    user: SafeUserProfileResponse
    welcome_message: str


class OtpDispatchResponse(BaseModel):
    success: bool
    message: str
    cooldown_seconds: int
    dev_otp: Optional[str] = None
    mode: str = "development"
    step: Optional[str] = None


class GenericMessageResponse(BaseModel):
    success: bool
    message: str
    status: Optional[str] = None


# -----------------------------------------------------------------------------
# Fisherman Registration (self-service profile edits + administrator management)
# -----------------------------------------------------------------------------
class FishermanProfileUpdateRequest(BaseModel):
    """
    Partial ("PATCH-style") update of a fisherman registration profile.

    Semantics:
      * omitted / None  -> field is left untouched
      * "" (empty text) -> nullable text field is cleared
      * safety_tracking_consent is a boolean toggle and is only written when present
    """

    age: Optional[int] = Field(None, ge=16, le=100, description="Age in years")
    location: Optional[str] = Field(None, min_length=2, max_length=200, description="Base port / coastal village")
    vessel_name: Optional[str] = Field(None, max_length=100)
    vessel_registration_number: Optional[str] = Field(None, max_length=50)
    fishing_type: Optional[str] = Field(None, max_length=50)
    preferred_language: Optional[str] = Field(None, max_length=20)
    emergency_contact: Optional[str] = Field(None, max_length=20, description="Emergency contact mobile number")
    government_id_type: Optional[str] = Field(None, max_length=30, description="e.g. Aadhaar / Voter ID / Fishing Licence")
    government_id_number: Optional[str] = Field(None, max_length=50)
    emergency_contact_name: Optional[str] = Field(None, max_length=100)
    emergency_contact_relation: Optional[str] = Field(None, max_length=50, description="e.g. Spouse, Parent, Crew")
    safety_tracking_consent: Optional[bool] = Field(None, description="Consent to safety tracking / distress alerts")


class AdminFishermanCreateRequest(FishermanProfileUpdateRequest):
    """Administrator-driven fisherman registration (no OTP step: the server-side
    administrator session is the authorisation, same as the other admin routes)."""

    phone_number: str = Field(..., min_length=8, max_length=20, description="Registered mobile number")
    name: str = Field(..., min_length=2, max_length=100, description="Full name of fisherman")
    age: int = Field(..., ge=16, le=100, description="Age in years")
    location: str = Field(..., min_length=2, max_length=200, description="Base port / coastal village")


class AdminFishermanUpdateRequest(FishermanProfileUpdateRequest):
    """Administrator edit: profile fields plus account activation state."""

    is_active: Optional[bool] = Field(None, description="Enable or disable the fisherman account")


class AdminFishermanListResponse(BaseModel):
    fishermen: List[SafeUserProfileResponse]
    total: int
