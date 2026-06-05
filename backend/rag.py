"""
Stage 8 — Retrieval-Augmented Generation (Phase B).

This module is feature-flagged: it loads gracefully even if the `pgvector`
Python package is missing or the Postgres extension hasn't been created yet.
That lets the rest of the API keep running while RAG is rolled out.

Switches:
    * `pgvector` Python package importable
    * `vector` extension exists in Postgres
    * `AZURE_OPENAI_EMBED_DEPLOYMENT` env var set

If any of those are missing → `is_enabled()` is False and every public
function becomes a no-op.

Public API:
    is_enabled() -> bool
    init_extension(engine) -> bool         # idempotent CREATE EXTENSION
    create_tables(engine) -> bool          # creates analysis_embeddings + index
    async embed(text: str) -> list[float] | None
    async embed_and_store(db, analysis) -> None
    async retrieve_similar(db, *, user_id, query_text, k_personal=3, k_global=2)
        -> list[dict]   # each: {analysis_id, kind, text_snippet, score, owner}
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx
from sqlalchemy import text
from sqlalchemy.orm import Session

log = logging.getLogger(__name__)

# ---- soft import of pgvector ----
try:
    from pgvector.sqlalchemy import Vector  # type: ignore
    _PGVECTOR_OK = True
except Exception as e:  # noqa: BLE001
    Vector = None  # type: ignore
    _PGVECTOR_OK = False
    log.info("pgvector python package unavailable: %s", e)

# ---- env ----
AZURE_OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT", "").rstrip("/")
AZURE_OPENAI_API_KEY = os.getenv("AZURE_OPENAI_API_KEY", "")
AZURE_OPENAI_EMBED_DEPLOYMENT = os.getenv("AZURE_OPENAI_EMBED_DEPLOYMENT", "")
# Embeddings can use a different api-version from chat. Default to a stable one.
AZURE_OPENAI_EMBED_API_VERSION = os.getenv(
    "AZURE_OPENAI_EMBED_API_VERSION",
    os.getenv("AZURE_OPENAI_API_VERSION", "2024-02-01"),
)

EMBED_DIM = 1536  # text-embedding-3-small
_EXTENSION_OK = False  # flips True after init_extension succeeds

_EMBED_DDL_STATEMENTS = [
    f"""
CREATE TABLE IF NOT EXISTS analysis_embeddings (
    id           BIGSERIAL PRIMARY KEY,
    analysis_id  INTEGER NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
    user_id      INTEGER NOT NULL REFERENCES users(id),
    kind         TEXT NOT NULL DEFAULT 'analysis',
    text         TEXT NOT NULL,
    repo_lang    TEXT,
    difficulty   TEXT,
    is_private   BOOLEAN DEFAULT FALSE,
    pr_merged    BOOLEAN DEFAULT FALSE,
    embedding    vector({EMBED_DIM}) NOT NULL,
    created_at   TIMESTAMPTZ DEFAULT NOW()
)
""",
    "CREATE INDEX IF NOT EXISTS analysis_embeddings_user_idx ON analysis_embeddings (user_id)",
    "CREATE INDEX IF NOT EXISTS analysis_embeddings_analysis_idx ON analysis_embeddings (analysis_id)",
]

_IVFFLAT_DDL = """
CREATE INDEX IF NOT EXISTS analysis_embeddings_embed_idx
    ON analysis_embeddings
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100)
"""


def is_enabled() -> bool:
    """True iff pgvector pkg + extension + Azure deployment are all available."""
    return bool(_PGVECTOR_OK and _EXTENSION_OK and AZURE_OPENAI_EMBED_DEPLOYMENT and AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY)


def init_extension(engine) -> bool:
    """
    Try to CREATE EXTENSION vector and the embeddings table.

    Returns True on success, False if pgvector isn't installed at the OS/DB
    level. Safe to call on every boot — fully idempotent.
    """
    global _EXTENSION_OK
    if not _PGVECTOR_OK:
        return False
    try:
        with engine.begin() as conn:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
            for stmt in _EMBED_DDL_STATEMENTS:
                conn.execute(text(stmt))
        _EXTENSION_OK = True
        log.info("RAG: pgvector extension + analysis_embeddings ready")
        return True
    except Exception as e:  # noqa: BLE001
        log.warning("RAG: pgvector extension not available — RAG disabled (%s)", e)
        return False


def ensure_ivfflat_index(engine) -> None:
    """Create the ivfflat index (call after table has some rows)."""
    if not _EXTENSION_OK:
        return
    try:
        with engine.begin() as conn:
            conn.execute(text(_IVFFLAT_DDL))
    except Exception as e:  # noqa: BLE001
        log.info("RAG: ivfflat index creation skipped: %s", e)


# ---------- embedding ----------

async def embed(text_in: str) -> Optional[List[float]]:
    """Call Azure OpenAI embeddings. Returns None on any failure."""
    if not (AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY and AZURE_OPENAI_EMBED_DEPLOYMENT):
        return None
    if not text_in or not text_in.strip():
        return None
    # Hard cap to ~8k chars (~2k tokens) to stay well under model limits.
    text_in = text_in[:8000]

    url = (
        f"{AZURE_OPENAI_ENDPOINT}/openai/deployments/"
        f"{AZURE_OPENAI_EMBED_DEPLOYMENT}/embeddings?api-version={AZURE_OPENAI_EMBED_API_VERSION}"
    )
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            r = await client.post(
                url,
                headers={"api-key": AZURE_OPENAI_API_KEY, "Content-Type": "application/json"},
                json={"input": text_in},
            )
        if r.status_code != 200:
            log.warning("RAG embed failed %s: %s", r.status_code, r.text[:200])
            return None
        data = r.json()
        return data["data"][0]["embedding"]
    except Exception as e:  # noqa: BLE001
        log.warning("RAG embed error: %s", e)
        return None


# ---------- compose corpus text from an analysis ----------

def _compose_text(analysis) -> str:
    """Build the embed-able blob from an Analysis row. Sized to ~8KB."""
    parts: List[str] = []
    if analysis.issue_title:
        parts.append(f"# {analysis.issue_title}")
    if analysis.repo_name:
        parts.append(f"Repo: {analysis.repo_name}")
    if analysis.repo_language:
        parts.append(f"Language: {analysis.repo_language}")
    if analysis.summary:
        parts.append(f"\n## Summary\n{analysis.summary}")
    if analysis.root_cause and analysis.root_cause.lower().strip() not in ("n/a", "na", "none"):
        parts.append(f"\n## Root cause\n{analysis.root_cause}")
    if analysis.solution_steps:
        parts.append(f"\n## Solution\n{analysis.solution_steps[:4500]}")
    return "\n".join(parts)[:8000]


# ---------- store ----------

async def embed_and_store(
    db: Session,
    analysis,
    *,
    is_private: bool = False,
    pr_merged: bool = False,
) -> bool:
    """Compute and persist (or upsert) one embedding row for this analysis."""
    if not is_enabled():
        return False
    body = _compose_text(analysis)
    if not body:
        return False
    vec = await embed(body)
    if vec is None or len(vec) != EMBED_DIM:
        return False
    # Upsert: delete prior row(s) for this analysis_id, then insert fresh.
    try:
        db.execute(
            text("DELETE FROM analysis_embeddings WHERE analysis_id = :aid"),
            {"aid": analysis.id},
        )
        db.execute(
            text(
                """
                INSERT INTO analysis_embeddings
                    (analysis_id, user_id, kind, text, repo_lang, difficulty,
                     is_private, pr_merged, embedding, created_at)
                VALUES
                    (:aid, :uid, 'analysis', :text, :lang, :diff,
                     :priv, :merged, :emb, :ts)
                """
            ),
            {
                "aid": analysis.id,
                "uid": analysis.user_id,
                "text": body,
                "lang": (analysis.repo_language or "")[:64] or None,
                "diff": (analysis.difficulty or "")[:16] or None,
                "priv": is_private,
                "merged": pr_merged,
                "emb": _vec_literal(vec),
                "ts": datetime.now(timezone.utc),
            },
        )
        db.commit()
        return True
    except Exception as e:  # noqa: BLE001
        log.warning("RAG store failed: %s", e)
        db.rollback()
        return False


def _vec_literal(vec: List[float]) -> str:
    """pgvector accepts the textual `[v1, v2, ...]` form via plain TEXT cast."""
    return "[" + ",".join(f"{x:.7f}" for x in vec) + "]"


# ---------- retrieve ----------

async def retrieve_similar(
    db: Session,
    *,
    user_id: int,
    query_text: str,
    k_personal: int = 3,
    k_global: int = 2,
) -> List[Dict[str, Any]]:
    """
    Hybrid retrieval:
      * top-k_personal closest neighbours owned by this user (any visibility)
      * top-k_global closest neighbours from other users where:
           - is_private = false
           - pr_merged  = true
    Returns a deduped list of {analysis_id, kind, text, score, owner_self}
    sorted best-first.
    """
    if not is_enabled():
        return []
    qvec = await embed(query_text)
    if qvec is None:
        return []
    qlit = _vec_literal(qvec)

    out: List[Dict[str, Any]] = []
    seen: set[int] = set()

    try:
        # Personal hits first (highest priority)
        rows = db.execute(
            text(
                """
                SELECT analysis_id, text, repo_lang, difficulty,
                       1 - (embedding <=> CAST(:q AS vector)) AS score
                FROM analysis_embeddings
                WHERE user_id = :uid
                ORDER BY embedding <=> CAST(:q AS vector)
                LIMIT :k
                """
            ),
            {"q": qlit, "uid": user_id, "k": k_personal},
        ).fetchall()
        for r in rows:
            if r.analysis_id in seen:
                continue
            seen.add(r.analysis_id)
            out.append({
                "analysis_id": r.analysis_id,
                "text": r.text,
                "repo_lang": r.repo_lang,
                "difficulty": r.difficulty,
                "score": float(r.score) if r.score is not None else 0.0,
                "owner_self": True,
            })

        # Global merged-PR hits
        if k_global > 0:
            rows = db.execute(
                text(
                    """
                    SELECT analysis_id, text, repo_lang, difficulty,
                           1 - (embedding <=> CAST(:q AS vector)) AS score
                    FROM analysis_embeddings
                    WHERE user_id <> :uid
                      AND is_private = FALSE
                      AND pr_merged = TRUE
                    ORDER BY embedding <=> CAST(:q AS vector)
                    LIMIT :k
                    """
                ),
                {"q": qlit, "uid": user_id, "k": k_global},
            ).fetchall()
            for r in rows:
                if r.analysis_id in seen:
                    continue
                seen.add(r.analysis_id)
                out.append({
                    "analysis_id": r.analysis_id,
                    "text": r.text,
                    "repo_lang": r.repo_lang,
                    "difficulty": r.difficulty,
                    "score": float(r.score) if r.score is not None else 0.0,
                    "owner_self": False,
                })
    except Exception as e:  # noqa: BLE001
        log.warning("RAG retrieve failed: %s", e)
        return []

    # Sort best first; cap a single text snippet to keep prompt size sane.
    out.sort(key=lambda d: d["score"], reverse=True)
    for d in out:
        if d["text"] and len(d["text"]) > 1200:
            d["text"] = d["text"][:1200] + " …"
    return out


def format_context_block(hits: List[Dict[str, Any]]) -> str:
    """Render retrieved hits into a Markdown block for the LLM system prompt."""
    if not hits:
        return ""
    lines = [
        "### Past resolutions you can learn from",
        "_These are condensed write-ups of issues that were previously diagnosed and "
        "(for cross-user lessons) shipped as merged PRs. Use them only when the new "
        "issue is genuinely similar — don't force-fit._\n",
    ]
    for i, h in enumerate(hits, 1):
        owner = "your past analysis" if h["owner_self"] else "community-shipped fix"
        meta = []
        if h.get("repo_lang"):
            meta.append(h["repo_lang"])
        if h.get("difficulty"):
            meta.append(h["difficulty"])
        meta_str = f" ({', '.join(meta)})" if meta else ""
        lines.append(f"#### Lesson {i} — {owner}{meta_str}")
        lines.append(h["text"])
        lines.append("")
    return "\n".join(lines)
