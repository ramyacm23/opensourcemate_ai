"""GitHub OAuth routes — connect flow + login/register-with-github.

Flow:
  - GET  /auth/github/login?mode=connect&token=<jwt>   -> 302 to GitHub
  - GET  /auth/github/login?mode=signup                -> 302 to GitHub
  - GET  /auth/github/callback?code=...&state=...      -> exchanges code,
                                                          links/creates user,
                                                          302 to FRONTEND_URL
                                                          with #token=... or
                                                          ?gh=connected
  - GET  /github/me        (auth) -> current user's GitHub profile (live)
  - GET  /github/repos     (auth) -> user's repos
  - POST /github/disconnect (auth) -> clear github fields
"""
import os
import secrets
import urllib.parse
from datetime import datetime, timedelta
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from database import get_db
import models
from auth import SECRET_KEY, ALGORITHM, create_access_token, get_current_user

GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID", "")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET", "")
GITHUB_CALLBACK_URL = os.getenv(
    "GITHUB_CALLBACK_URL",
    "http://127.0.0.1:8000/auth/github/callback",
)
GITHUB_SCOPES = os.getenv("GITHUB_SCOPES", "read:user user:email repo")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

router = APIRouter(tags=["GitHub OAuth"])

# ---------- helpers ----------

def _make_state(mode: str, user_id: Optional[int]) -> str:
    payload = {
        "m": mode,
        "u": user_id,
        "n": secrets.token_urlsafe(8),
        "exp": datetime.utcnow() + timedelta(minutes=10),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def _decode_state(state: str) -> dict:
    try:
        return jwt.decode(state, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=400, detail="Invalid OAuth state")


def _require_oauth_config():
    if not GITHUB_CLIENT_ID or not GITHUB_CLIENT_SECRET:
        raise HTTPException(
            status_code=503,
            detail="GitHub OAuth not configured on the server",
        )


def _user_from_token(token: str, db: Session) -> Optional[models.User]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        uid = int(payload.get("sub"))
    except (JWTError, TypeError, ValueError):
        return None
    return db.query(models.User).filter(models.User.id == uid).first()


# ---------- OAuth ----------

@router.get("/auth/github/login")
def github_login(
    mode: str = Query("connect", regex="^(connect|signup)$"),
    token: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Kick off the GitHub OAuth flow."""
    _require_oauth_config()

    user_id: Optional[int] = None
    if mode == "connect":
        if not token:
            raise HTTPException(status_code=401, detail="Missing token for connect")
        user = _user_from_token(token, db)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid token")
        user_id = user.id

    state = _make_state(mode, user_id)
    params = urllib.parse.urlencode({
        "client_id": GITHUB_CLIENT_ID,
        "redirect_uri": GITHUB_CALLBACK_URL,
        "scope": GITHUB_SCOPES,
        "state": state,
        "allow_signup": "true",
    })
    return RedirectResponse(f"https://github.com/login/oauth/authorize?{params}")


@router.get("/auth/github/callback")
def github_callback(
    code: str = Query(...),
    state: str = Query(...),
    db: Session = Depends(get_db),
):
    _require_oauth_config()
    payload = _decode_state(state)
    mode = payload.get("m")
    state_user_id = payload.get("u")

    # 1. Exchange code for access token
    with httpx.Client(timeout=15.0) as client:
        tok_res = client.post(
            "https://github.com/login/oauth/access_token",
            headers={"Accept": "application/json"},
            data={
                "client_id": GITHUB_CLIENT_ID,
                "client_secret": GITHUB_CLIENT_SECRET,
                "code": code,
                "redirect_uri": GITHUB_CALLBACK_URL,
            },
        )
        tok_res.raise_for_status()
        tok_json = tok_res.json()

        gh_access_token = tok_json.get("access_token")
        if not gh_access_token:
            raise HTTPException(status_code=400, detail=f"GitHub token exchange failed: {tok_json}")

        # 2. Fetch GitHub user
        u_res = client.get(
            "https://api.github.com/user",
            headers={
                "Authorization": f"Bearer {gh_access_token}",
                "Accept": "application/vnd.github+json",
            },
        )
        u_res.raise_for_status()
        gh_user = u_res.json()

        # email may be private -> fetch /user/emails for primary verified
        gh_email = gh_user.get("email")
        if not gh_email:
            try:
                e_res = client.get(
                    "https://api.github.com/user/emails",
                    headers={
                        "Authorization": f"Bearer {gh_access_token}",
                        "Accept": "application/vnd.github+json",
                    },
                )
                if e_res.status_code == 200:
                    for e in e_res.json():
                        if e.get("primary") and e.get("verified"):
                            gh_email = e.get("email")
                            break
            except Exception:
                pass

    gh_id = gh_user.get("id")
    gh_login = gh_user.get("login")
    gh_avatar = gh_user.get("avatar_url")
    if not gh_id or not gh_login:
        raise HTTPException(status_code=400, detail="GitHub returned no user")

    # 3. Resolve target user
    target: Optional[models.User] = None

    if mode == "connect" and state_user_id:
        target = db.query(models.User).filter(models.User.id == state_user_id).first()
        if not target:
            raise HTTPException(status_code=404, detail="User not found")
        # Guard: don't allow attaching a GitHub already linked elsewhere
        clash = db.query(models.User).filter(
            models.User.github_id == gh_id,
            models.User.id != target.id,
        ).first()
        if clash:
            raise HTTPException(status_code=409, detail="GitHub account already linked to another user")

    elif mode == "signup":
        # Try by github_id first
        target = db.query(models.User).filter(models.User.github_id == gh_id).first()
        if not target and gh_email:
            target = db.query(models.User).filter(models.User.email == gh_email).first()
        if not target:
            # Create a new account using GitHub email (or synthetic if private)
            new_email = gh_email or f"{gh_login}+gh@users.noreply.github.com"
            if db.query(models.User).filter(models.User.email == new_email).first():
                # extremely unlikely race
                raise HTTPException(status_code=409, detail="Email already in use")
            target = models.User(
                email=new_email,
                password=None,
                name=gh_user.get("name") or gh_login,
            )
            db.add(target)
            db.flush()
    else:
        raise HTTPException(status_code=400, detail="Invalid OAuth mode")

    # 4. Persist GitHub fields
    target.github_id = gh_id
    target.github_username = gh_login
    target.github_avatar_url = gh_avatar
    target.github_access_token = gh_access_token
    target.github_connected_at = datetime.utcnow()
    db.commit()
    db.refresh(target)

    # 5. Redirect back to frontend
    app_token = create_access_token(target.id)
    if mode == "signup":
        # No prior session — hand back the JWT via URL fragment so it stays out of logs
        target_path = "/onboarding" if not target.onboarding_completed else "/dashboard"
        return RedirectResponse(f"{FRONTEND_URL}{target_path}#token={app_token}&gh=connected")
    # connect flow — user already logged in; just bounce back
    return RedirectResponse(f"{FRONTEND_URL}/dashboard?gh=connected")


# ---------- live GitHub data ----------

def _gh_get(url: str, token: str, **params):
    with httpx.Client(timeout=15.0) as client:
        r = client.get(
            url,
            params=params or None,
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github+json",
            },
        )
    if r.status_code == 401:
        raise HTTPException(status_code=401, detail="GitHub token rejected — please reconnect")
    if r.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"GitHub error {r.status_code}")
    return r.json()


@router.get("/github/me")
def github_me(current: models.User = Depends(get_current_user)):
    if not current.github_access_token:
        raise HTTPException(status_code=400, detail="GitHub not connected")
    return _gh_get("https://api.github.com/user", current.github_access_token)


@router.get("/github/repos")
def github_repos(current: models.User = Depends(get_current_user)):
    if not current.github_access_token:
        raise HTTPException(status_code=400, detail="GitHub not connected")
    repos = _gh_get(
        "https://api.github.com/user/repos",
        current.github_access_token,
        per_page=20,
        sort="updated",
        affiliation="owner,collaborator,organization_member",
    )
    # Trim payload
    return [
        {
            "id": r["id"],
            "name": r["name"],
            "full_name": r["full_name"],
            "html_url": r["html_url"],
            "description": r.get("description"),
            "language": r.get("language"),
            "stargazers_count": r.get("stargazers_count", 0),
            "forks_count": r.get("forks_count", 0),
            "open_issues_count": r.get("open_issues_count", 0),
            "private": r.get("private", False),
            "fork": r.get("fork", False),
            "updated_at": r.get("updated_at"),
        }
        for r in repos
    ]


@router.post("/github/disconnect")
def github_disconnect(
    current: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    current.github_id = None
    current.github_username = None
    current.github_avatar_url = None
    current.github_access_token = None
    current.github_connected_at = None
    db.commit()
    return {"ok": True}
