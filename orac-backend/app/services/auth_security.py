"""Cryptographic utilities, password hashing, and token handling."""
import re
import secrets
import hashlib
import hmac
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
import bcrypt
from jose import jwt, JWTError
from app.core.config import settings


def hash_password(password: str) -> str:
    """Hashes a plaintext password using bcrypt with random salt."""
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plaintext password against a bcrypt hash."""
    if not plain_password or not hashed_password:
        return False
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False


def validate_password_strength(password: str) -> Optional[str]:
    """Validates password length and complexity. Returns error message if invalid."""
    if not password or len(password) < 8:
        return "Password must be at least 8 characters long."
    if len(password) > 128:
        return "Password must not exceed 128 characters."
    if not re.search(r"[A-Za-z]", password):
        return "Password must contain at least one letter."
    if not re.search(r"\d", password):
        return "Password must contain at least one digit."
    return None


def normalize_phone(phone: str) -> str:
    """
    Normalizes phone numbers to standard format.
    Handles Indian mobile formats (e.g. 9876543210, 09876543210, +91 9876543210).
    """
    cleaned = re.sub(r"[\s\-\(\)\.]", "", phone.strip())
    # Handle Indian 10-digit mobile starting with 6-9
    if re.match(r"^[6-9]\d{9}$", cleaned):
        return f"+91{cleaned}"
    # Handle 11-digit starting with 0 followed by 6-9
    if cleaned.startswith("0") and len(cleaned) == 11 and re.match(r"^0[6-9]\d{9}$", cleaned):
        return f"+91{cleaned[1:]}"
    # If starts with 91 followed by 10 digits
    if cleaned.startswith("91") and len(cleaned) == 12 and re.match(r"^91[6-9]\d{9}$", cleaned):
        return f"+{cleaned}"
    # If already starts with +
    if cleaned.startswith("+"):
        return cleaned
    return cleaned


def is_valid_phone(phone: str) -> bool:
    """Checks whether the normalized phone number conforms to reasonable phone pattern."""
    normalized = normalize_phone(phone)
    return bool(re.match(r"^\+[1-9]\d{7,14}$", normalized))


def normalize_email(email: str) -> str:
    """Normalizes email to trimmed lower-case."""
    return email.strip().lower()


def is_valid_email(email: str) -> bool:
    """Validates email format using regex."""
    pattern = r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"
    return bool(re.match(pattern, email.strip()))


def generate_numeric_otp(length: int = 6) -> str:
    """
    Generates a cryptographically secure numeric OTP.
    Never uses predictable patterns.
    """
    digits = [str(secrets.randbelow(10)) for _ in range(length)]
    # Ensure first digit is not 0 for good UX
    if digits[0] == "0":
        digits[0] = str(secrets.randbelow(9) + 1)
    return "".join(digits)


def hash_otp(otp: str, salt: str = "") -> str:
    """
    Generates HMAC-SHA256 digest of the OTP combined with salt and system secret.
    Fast, collision resistant, and never leaves plaintext OTPs at rest.
    """
    key = settings.SECRET_KEY.encode("utf-8")
    payload = f"{salt}:{otp}".encode("utf-8")
    return hmac.new(key, payload, hashlib.sha256).hexdigest()


def verify_otp_hash(plain_otp: str, hashed_otp: str, salt: str = "") -> bool:
    """Constant-time comparison of OTP against HMAC hash."""
    expected = hash_otp(plain_otp, salt=salt)
    return hmac.compare_digest(expected, hashed_otp)


def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Creates a signed JWT access token."""
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    jti = to_encode.get("jti") or secrets.token_hex(16)
    to_encode.update({
        "exp": expire,
        "iat": now,
        "jti": jti
    })
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """Decodes and validates a signed JWT token. Returns None on validation failure."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return None

