import os
from pathlib import Path

# Load .env (no external dep — minimal parser)
_env_file = Path(__file__).parent / ".env"
if _env_file.exists():
    for line in _env_file.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        os.environ.setdefault(k.strip(), v.strip())

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from database import Base, engine
from routes import auth_routes, onboarding_routes, dashboard_routes, github_routes, profile_routes, analyze_routes, contribute_routes, learning_routes

Base.metadata.create_all(bind=engine)

# Lightweight idempotent migrations (additive columns only — never drop)
with engine.begin() as conn:
    conn.execute(text("ALTER TABLE analyses ADD COLUMN IF NOT EXISTS code_suggestions TEXT"))
    # Phase C — PR state polling columns on contribution_runs
    conn.execute(text("ALTER TABLE contribution_runs ADD COLUMN IF NOT EXISTS pr_state TEXT"))
    conn.execute(text("ALTER TABLE contribution_runs ADD COLUMN IF NOT EXISTS pr_merged_at TIMESTAMPTZ"))
    conn.execute(text("ALTER TABLE contribution_runs ADD COLUMN IF NOT EXISTS pr_checked_at TIMESTAMPTZ"))
    # Email verification + OTP table
    conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE"))
    conn.execute(text(
        "CREATE TABLE IF NOT EXISTS email_otps ("
        "id SERIAL PRIMARY KEY, "
        "email TEXT NOT NULL, "
        "purpose TEXT NOT NULL, "
        "otp_hash TEXT NOT NULL, "
        "payload TEXT, "
        "attempts INTEGER NOT NULL DEFAULT 0, "
        "expires_at TIMESTAMPTZ NOT NULL, "
        "created_at TIMESTAMPTZ DEFAULT NOW()"
        ")"
    ))
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_email_otps_email ON email_otps (email)"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_email_otps_email_purpose ON email_otps (email, purpose)"))

# RAG (Stage 8 — Phase B). Soft-fails if pgvector isn't installed at the DB level.
import rag as _rag  # noqa: E402
_rag.init_extension(engine)

app = FastAPI(title="OpenSourceMate API")

_default_origins = "http://localhost:3000,http://127.0.0.1:3000"
ALLOWED_ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", _default_origins).split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_routes.router)
app.include_router(onboarding_routes.router)
app.include_router(dashboard_routes.router)
app.include_router(github_routes.router)
app.include_router(profile_routes.router)
app.include_router(analyze_routes.router)
app.include_router(contribute_routes.router)
app.include_router(learning_routes.router)

# Serve user-uploaded files (avatars, etc.)
from pathlib import Path as _Path
_uploads_dir = _Path(__file__).resolve().parent.parent / "uploads"
_uploads_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(_uploads_dir)), name="uploads")

@app.get("/")
def root():
    return {"status": "ok"}
