import os
import secrets
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request
from sqlalchemy.orm import Session
from database import get_db
import models, schemas
from auth import get_current_user

router = APIRouter(prefix="/profile", tags=["Profile"])

UPLOAD_ROOT = Path(__file__).resolve().parent.parent / "uploads"
AVATAR_DIR = UPLOAD_ROOT / "avatars"
AVATAR_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
MAX_AVATAR_BYTES = 5 * 1024 * 1024  # 5 MB


@router.get("/", response_model=schemas.UserResponse)
def get_profile(current_user: models.User = Depends(get_current_user)):
    return current_user


@router.patch("/", response_model=schemas.UserResponse)
def update_profile(
    body: schemas.ProfileUpdateRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(current_user, k, v)
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/avatar", response_model=schemas.UserResponse)
async def upload_avatar(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(status_code=400, detail=f"Unsupported file type. Allowed: {', '.join(sorted(ALLOWED_EXT))}")

    contents = await file.read()
    if len(contents) > MAX_AVATAR_BYTES:
        raise HTTPException(status_code=400, detail="File too large (max 5MB)")
    if len(contents) == 0:
        raise HTTPException(status_code=400, detail="Empty file")

    fname = f"u{current_user.id}_{secrets.token_hex(8)}{ext}"
    fpath = AVATAR_DIR / fname
    fpath.write_bytes(contents)

    # delete old uploaded avatar (only if it was a local upload)
    if current_user.avatar_url and current_user.avatar_url.startswith("/uploads/avatars/"):
        old_name = current_user.avatar_url.rsplit("/", 1)[-1]
        old_path = AVATAR_DIR / old_name
        try:
            if old_path.is_file():
                old_path.unlink()
        except OSError:
            pass

    current_user.avatar_url = f"/uploads/avatars/{fname}"
    db.commit()
    db.refresh(current_user)
    return current_user


@router.delete("/avatar", response_model=schemas.UserResponse)
def delete_avatar(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.avatar_url and current_user.avatar_url.startswith("/uploads/avatars/"):
        old_name = current_user.avatar_url.rsplit("/", 1)[-1]
        old_path = AVATAR_DIR / old_name
        try:
            if old_path.is_file():
                old_path.unlink()
        except OSError:
            pass
    current_user.avatar_url = None
    db.commit()
    db.refresh(current_user)
    return current_user
