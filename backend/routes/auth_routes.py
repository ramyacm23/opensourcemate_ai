import json
import logging
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
import models, schemas
from auth import hash_password, verify_password, create_access_token
from email_service import send_otp_email

logger = logging.getLogger("auth_routes")
router = APIRouter(prefix="/auth", tags=["Auth"])

OTP_TTL_MINUTES = 10
OTP_MAX_ATTEMPTS = 5
OTP_RESEND_COOLDOWN_SECONDS = 30


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _generate_otp() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def _store_otp(
    db: Session,
    *,
    email: str,
    purpose: str,
    payload: dict | None = None,
) -> str:
    """Replace any existing OTP for this email+purpose with a fresh one. Returns the plaintext code."""
    existing = (
        db.query(models.EmailOTP)
        .filter(models.EmailOTP.email == email, models.EmailOTP.purpose == purpose)
        .order_by(models.EmailOTP.id.desc())
        .first()
    )
    if existing:
        created = existing.created_at
        if created is not None:
            if created.tzinfo is None:
                created = created.replace(tzinfo=timezone.utc)
            if (_now() - created).total_seconds() < OTP_RESEND_COOLDOWN_SECONDS:
                raise HTTPException(
                    status_code=429,
                    detail=f"Please wait {OTP_RESEND_COOLDOWN_SECONDS}s before requesting another code.",
                )
        db.query(models.EmailOTP).filter(
            models.EmailOTP.email == email,
            models.EmailOTP.purpose == purpose,
        ).delete(synchronize_session=False)

    otp_plain = _generate_otp()
    row = models.EmailOTP(
        email=email,
        purpose=purpose,
        otp_hash=hash_password(otp_plain),
        payload=json.dumps(payload) if payload else None,
        expires_at=_now() + timedelta(minutes=OTP_TTL_MINUTES),
        attempts=0,
    )
    db.add(row)
    db.commit()
    return otp_plain


def _consume_otp(db: Session, *, email: str, purpose: str, otp: str) -> dict:
    """Verify code; on success delete the row and return its payload (or {})."""
    row = (
        db.query(models.EmailOTP)
        .filter(models.EmailOTP.email == email, models.EmailOTP.purpose == purpose)
        .order_by(models.EmailOTP.id.desc())
        .first()
    )
    if not row:
        raise HTTPException(status_code=400, detail="No verification code requested. Please request a new one.")

    expires = row.expires_at
    if expires is not None and expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires and _now() > expires:
        db.delete(row)
        db.commit()
        raise HTTPException(status_code=400, detail="Code expired. Please request a new one.")

    if row.attempts >= OTP_MAX_ATTEMPTS:
        db.delete(row)
        db.commit()
        raise HTTPException(status_code=429, detail="Too many attempts. Please request a new code.")

    if not verify_password(otp, row.otp_hash):
        row.attempts = (row.attempts or 0) + 1
        db.commit()
        remaining = OTP_MAX_ATTEMPTS - row.attempts
        raise HTTPException(
            status_code=400,
            detail=f"Incorrect code. {remaining} attempt(s) left." if remaining > 0 else "Too many attempts.",
        )

    payload = json.loads(row.payload) if row.payload else {}
    db.delete(row)
    db.commit()
    return payload


# ─────────────────────────────────────────────────────────────────────────────
# Registration with email OTP
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/register/start", response_model=schemas.OkResponse, status_code=200)
def register_start(
    body: schemas.RegisterStartRequest,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Step 1: collect email + password, send a 6-digit OTP. No user row yet."""
    email = body.email.lower().strip()
    if len(body.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")

    existing = db.query(models.User).filter(models.User.email == email).first()
    if existing and existing.password and existing.email_verified:
        raise HTTPException(status_code=400, detail="Email already registered. Please sign in instead.")

    payload = {"password_hash": hash_password(body.password)}
    otp = _store_otp(db, email=email, purpose="register", payload=payload)
    background.add_task(send_otp_email, email, otp, "verify your email and complete signup")
    return {"ok": True, "message": "Verification code sent. Check your inbox."}


@router.post("/register/verify", response_model=schemas.TokenResponse)
def register_verify(body: schemas.RegisterVerifyRequest, db: Session = Depends(get_db)):
    """Step 2: verify OTP, create the user, return access token."""
    email = body.email.lower().strip()
    payload = _consume_otp(db, email=email, purpose="register", otp=body.otp.strip())
    password_hash = payload.get("password_hash")
    if not password_hash:
        raise HTTPException(status_code=400, detail="Verification payload missing. Please restart signup.")

    user = db.query(models.User).filter(models.User.email == email).first()
    if user:
        user.password = password_hash
        user.email_verified = True
    else:
        user = models.User(email=email, password=password_hash, email_verified=True)
        db.add(user)
    db.commit()
    db.refresh(user)
    return {"access_token": create_access_token(user.id)}


# ─────────────────────────────────────────────────────────────────────────────
# Forgot password (OTP)
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/forgot-password/request", response_model=schemas.OkResponse)
def forgot_password_request(
    body: schemas.ForgotPasswordStartRequest,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Step 1: send OTP to a registered email. Always returns ok to avoid enumeration."""
    email = body.email.lower().strip()
    user = db.query(models.User).filter(models.User.email == email).first()
    if user and user.password:
        try:
            otp = _store_otp(db, email=email, purpose="forgot_password", payload=None)
            background.add_task(send_otp_email, email, otp, "reset your password")
        except HTTPException:
            # Cooldown — silently swallow so we don't leak existence.
            pass
    else:
        logger.info("[forgot-password] ignored unknown email: %s", email)
    return {"ok": True, "message": "If the email is registered, a code has been sent."}


@router.post("/forgot-password/verify", response_model=schemas.TokenResponse)
def forgot_password_verify(body: schemas.ForgotPasswordVerifyRequest, db: Session = Depends(get_db)):
    """Step 2: verify OTP + set new password. Returns a fresh access token."""
    email = body.email.lower().strip()
    if len(body.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")

    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        raise HTTPException(status_code=400, detail="Account not found.")

    _consume_otp(db, email=email, purpose="forgot_password", otp=body.otp.strip())

    user.password = hash_password(body.new_password)
    user.email_verified = True
    db.commit()
    return {"access_token": create_access_token(user.id)}


# ─────────────────────────────────────────────────────────────────────────────
# Login
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/login", response_model=schemas.TokenResponse)
def login(body: schemas.LoginRequest, db: Session = Depends(get_db)):
    email = body.email.strip()
    # Case-insensitive lookup so legacy mixed-case accounts still resolve.
    from sqlalchemy import func as _f
    user = db.query(models.User).filter(_f.lower(models.User.email) == email.lower()).first()
    if not user or not user.password or not verify_password(body.password, user.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return {"access_token": create_access_token(user.id)}


# ─────────────────────────────────────────────────────────────────────────────
# Legacy single-step register — kept for back-compat. Mark unverified and
# fire an OTP so the user can verify later.
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/register", response_model=schemas.TokenResponse, status_code=201)
def register_legacy(
    body: schemas.RegisterRequest,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
):
    email = body.email.lower().strip()
    if db.query(models.User).filter(models.User.email == email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    user = models.User(email=email, password=hash_password(body.password), email_verified=False)
    db.add(user)
    db.commit()
    db.refresh(user)
    try:
        otp = _store_otp(db, email=email, purpose="register", payload={"password_hash": user.password})
        background.add_task(send_otp_email, email, otp, "verify your email")
    except HTTPException:
        pass
    return {"access_token": create_access_token(user.id)}
