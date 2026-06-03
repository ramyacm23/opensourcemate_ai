"""
AI-powered issue/repo/error/conflict analysis.

Reads stage-2 user inputs, optionally enriches via GitHub API using the user's
stored OAuth token, then calls an LLM (default OpenAI gpt-4o-mini) to produce
the structured analysis described in stages 3, 4, 5 of the plan.
"""
import os
import re
import json
import logging
from typing import Optional, Dict, Any

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from auth import get_current_user
import models, schemas

router = APIRouter(prefix="/analyze", tags=["Analyze"])
log = logging.getLogger(__name__)

# --- LLM config (env-driven, swappable) ---
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "openai").lower()  # openai | groq | ollama
LLM_MODEL = os.getenv("LLM_MODEL", "gpt-4o-mini")
LLM_API_KEY = os.getenv("OPENAI_API_KEY") or os.getenv("LLM_API_KEY")
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "https://api.openai.com/v1")

GITHUB_API = "https://api.github.com"

ISSUE_URL_RE = re.compile(r"^https?://github\.com/([^/\s]+)/([^/\s]+)/issues/(\d+)/?$", re.I)
REPO_URL_RE = re.compile(r"^https?://github\.com/([^/\s]+)/([^/\s]+?)(?:\.git)?/?$", re.I)


# ---------- helpers ----------

def _gh_headers(token: Optional[str]) -> Dict[str, str]:
    h = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "OpenSourceMate",
    }
    if token:
        h["Authorization"] = f"Bearer {token}"
    return h


async def _fetch_issue(client: httpx.AsyncClient, owner: str, repo: str, num: int, token: Optional[str]) -> Dict[str, Any]:
    r = await client.get(f"{GITHUB_API}/repos/{owner}/{repo}/issues/{num}", headers=_gh_headers(token))
    if r.status_code == 404:
        raise HTTPException(404, "Issue not found (or you don't have access)")
    if r.status_code == 401:
        raise HTTPException(401, "GitHub token rejected — try reconnecting GitHub")
    r.raise_for_status()
    return r.json()


async def _fetch_repo(client: httpx.AsyncClient, owner: str, repo: str, token: Optional[str]) -> Dict[str, Any]:
    r = await client.get(f"{GITHUB_API}/repos/{owner}/{repo}", headers=_gh_headers(token))
    if r.status_code == 404:
        raise HTTPException(404, "Repo not found (or you don't have access)")
    if r.status_code == 401:
        raise HTTPException(401, "GitHub token rejected — try reconnecting GitHub")
    r.raise_for_status()
    return r.json()


def _parse_issue_url(url: str):
    m = ISSUE_URL_RE.match(url.strip())
    if not m:
        return None
    return m.group(1), m.group(2), int(m.group(3))


def _parse_repo_url(url: str):
    m = REPO_URL_RE.match(url.strip())
    if not m:
        return None
    return m.group(1), m.group(2)


def _truncate(s: Optional[str], n: int) -> str:
    if not s:
        return ""
    return s if len(s) <= n else s[:n] + "\n…[truncated]"


# ---------- LLM ----------

SYSTEM_PROMPT = """You are OpenSourceMate, an expert open-source contribution coach.
Given a GitHub issue, repo, error log, or merge conflict, you produce a STRUCTURED analysis to help a junior developer contribute confidently.

Always reply with valid JSON ONLY. No prose before or after. No markdown fences.
Schema:
{
  "summary": "1-3 plain-English sentences explaining the situation",
  "difficulty": "easy" | "medium" | "hard",
  "files_involved": ["path/to/file.ext", ...]  (best guess; can be empty),
  "tech_stack": ["React", "TypeScript", ...]   (technologies relevant; can be empty),
  "root_cause": "What is actually causing the problem (or 'N/A' if not applicable)",
  "solution_steps": "Step-by-step markdown with code blocks where useful",
  "git_commands": ["git checkout -b fix/xyz", "git add .", ...],
  "pr_title": "Short, conventional-commit style title",
  "pr_description": "Markdown PR body: what + why + how + checklist"
}
Be concrete. Prefer code examples over hand-waving. Keep beginner-friendly tone.

CRITICAL OUTPUT RULES:
- Return a SINGLE valid JSON object. No prose before or after.
- Inside any string value, you MUST escape newlines as \\n, tabs as \\t, and double-quotes as \\".
- Never put raw line breaks inside a JSON string.
- Do not wrap the JSON in markdown fences."""


async def _call_llm(prompt: str) -> Dict[str, Any]:
    if not LLM_API_KEY:
        raise HTTPException(503, "AI service not configured. Admin must set OPENAI_API_KEY (or LLM_API_KEY) in backend .env")

    base_payload = {
        "model": LLM_MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt + "\n\nRespond with valid JSON only — no markdown, no prose."},
        ],
        "temperature": 0.3,
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        # First try with strict JSON mode (works on OpenAI, some CF models)
        payload = {**base_payload, "response_format": {"type": "json_object"}}
        r = await client.post(
            f"{LLM_BASE_URL}/chat/completions",
            headers={
                "Authorization": f"Bearer {LLM_API_KEY}",
                "Content-Type": "application/json",
            },
            json=payload,
        )

        # Some Cloudflare / Ollama models reject response_format → retry without it
        if r.status_code in (400, 422):
            log.info("response_format unsupported, retrying without it (provider=%s, model=%s)", LLM_PROVIDER, LLM_MODEL)
            r = await client.post(
                f"{LLM_BASE_URL}/chat/completions",
                headers={
                    "Authorization": f"Bearer {LLM_API_KEY}",
                    "Content-Type": "application/json",
                },
                json=base_payload,
            )

        if r.status_code != 200:
            log.error("LLM error %s: %s", r.status_code, r.text[:500])
            raise HTTPException(502, f"AI service error ({r.status_code})")

        body = r.json()

        # Extract content — both OpenAI and Cloudflare OpenAI-compat shape
        try:
            content = body["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError):
            # Cloudflare native shape (non-OpenAI-compat fallback)
            content = body.get("result", {}).get("response") or body.get("response") or ""

        if not content:
            log.error("LLM returned empty content: %s", str(body)[:500])
            raise HTTPException(502, "AI returned empty response")

        # Parse JSON — strip markdown fences if present
        cleaned = content.strip()
        if cleaned.startswith("```"):
            # remove ``` or ```json fences
            cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
            cleaned = re.sub(r"\s*```\s*$", "", cleaned)

        # Try strict parse, then progressively more lenient strategies
        for candidate in _json_candidates(cleaned):
            try:
                return json.loads(candidate)
            except json.JSONDecodeError:
                continue

        log.error("LLM returned non-JSON: %s", content[:1000])
        raise HTTPException(502, "AI returned malformed response")


def _json_candidates(s: str):
    """Yield successively more lenient versions of `s` to attempt json.loads on."""
    yield s

    # Extract first {...} block (handles preamble/trailing prose)
    m = re.search(r"\{.*\}", s, re.DOTALL)
    if m:
        block = m.group(0)
        yield block
        # Escape raw control chars inside JSON string values
        yield _escape_raw_controls_in_strings(block)

    # Same fix on the original
    yield _escape_raw_controls_in_strings(s)


def _escape_raw_controls_in_strings(s: str) -> str:
    """Escape raw \n, \r, \t inside JSON string literals so json.loads accepts the doc.
    Walks the string tracking whether we're inside a double-quoted string."""
    out = []
    in_str = False
    esc = False
    for ch in s:
        if esc:
            out.append(ch)
            esc = False
            continue
        if ch == "\\":
            out.append(ch)
            esc = True
            continue
        if ch == '"':
            in_str = not in_str
            out.append(ch)
            continue
        if in_str:
            if ch == "\n":
                out.append("\\n")
            elif ch == "\r":
                out.append("\\r")
            elif ch == "\t":
                out.append("\\t")
            else:
                out.append(ch)
        else:
            out.append(ch)
    return "".join(out)


def _build_prompt(req: schemas.AnalyzeRequest, issue_data: Optional[dict], repo_data: Optional[dict]) -> str:
    parts = []
    if issue_data:
        parts.append(
            f"## GitHub Issue\n"
            f"Repo: {issue_data.get('repository_url', '').replace('https://api.github.com/repos/', '')}\n"
            f"Title: {issue_data.get('title')}\n"
            f"Number: #{issue_data.get('number')}\n"
            f"Labels: {', '.join(l['name'] for l in issue_data.get('labels', []))}\n"
            f"State: {issue_data.get('state')}\n"
            f"Body:\n{_truncate(issue_data.get('body'), 6000)}"
        )
    if repo_data:
        parts.append(
            f"## Repository\n"
            f"Name: {repo_data.get('full_name')}\n"
            f"Description: {repo_data.get('description') or '—'}\n"
            f"Language: {repo_data.get('language') or '—'}\n"
            f"Topics: {', '.join(repo_data.get('topics') or [])}\n"
            f"Stars: {repo_data.get('stargazers_count')}\n"
            f"Open issues: {repo_data.get('open_issues_count')}"
        )
    if req.error_log:
        parts.append(f"## Error / Stack Trace\n```\n{_truncate(req.error_log, 6000)}\n```")
    if req.merge_conflict:
        parts.append(f"## Merge Conflict Snippet\n```\n{_truncate(req.merge_conflict, 6000)}\n```")

    return "\n\n".join(parts) + "\n\nAnalyze the above and respond with the JSON schema."


# ---------- routes ----------

@router.post("/", response_model=schemas.AnalysisResponse)
async def create_analysis(
    body: schemas.AnalyzeRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    # validate at least one input
    if not any([body.issue_url, body.repo_url, body.error_log, body.merge_conflict]):
        raise HTTPException(400, "Provide at least one input (issue URL, repo URL, error log, or merge conflict).")

    # parse URLs
    issue_parts = _parse_issue_url(body.issue_url) if body.issue_url else None
    repo_parts = _parse_repo_url(body.repo_url) if body.repo_url else None
    if body.issue_url and not issue_parts:
        raise HTTPException(400, "Invalid GitHub issue URL. Expected: https://github.com/owner/repo/issues/123")
    if body.repo_url and not repo_parts:
        raise HTTPException(400, "Invalid GitHub repo URL. Expected: https://github.com/owner/repo")

    # create row up front so user can see history even on failure
    row = models.Analysis(
        user_id=current_user.id,
        issue_url=body.issue_url,
        repo_url=body.repo_url,
        error_log=body.error_log,
        merge_conflict=body.merge_conflict,
        status="pending",
        model_used=LLM_MODEL,
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    try:
        gh_token = current_user.github_access_token  # may be None — public repos still work

        issue_data = repo_data = None
        async with httpx.AsyncClient(timeout=20.0) as client:
            if issue_parts:
                owner, repo, num = issue_parts
                issue_data = await _fetch_issue(client, owner, repo, num, gh_token)
                row.issue_title = issue_data.get("title")
                row.issue_body = _truncate(issue_data.get("body"), 8000)
                row.repo_name = f"{owner}/{repo}"
                # also fetch repo for language
                repo_data = await _fetch_repo(client, owner, repo, gh_token)
            elif repo_parts:
                owner, repo = repo_parts
                repo_data = await _fetch_repo(client, owner, repo, gh_token)
                row.repo_name = f"{owner}/{repo}"

        if repo_data:
            row.repo_language = repo_data.get("language")

        prompt = _build_prompt(body, issue_data, repo_data)
        result = await _call_llm(prompt)

        row.summary = result.get("summary")
        row.difficulty = (result.get("difficulty") or "").lower() or None
        files = result.get("files_involved") or []
        row.files_involved = "\n".join(files) if isinstance(files, list) else str(files)
        tech = result.get("tech_stack") or []
        row.tech_stack = ", ".join(tech) if isinstance(tech, list) else str(tech)
        row.root_cause = result.get("root_cause")
        row.solution_steps = result.get("solution_steps")
        cmds = result.get("git_commands") or []
        row.git_commands = "\n".join(cmds) if isinstance(cmds, list) else str(cmds)
        row.pr_title = result.get("pr_title")
        row.pr_description = result.get("pr_description")
        row.status = "done"

    except HTTPException:
        row.status = "error"
        db.commit()
        raise
    except Exception as e:
        log.exception("Analysis failed")
        row.status = "error"
        row.error_message = str(e)[:500]
        db.commit()
        raise HTTPException(500, f"Analysis failed: {e}")

    db.commit()
    db.refresh(row)
    return row


@router.get("/", response_model=list[schemas.AnalysisListItem])
def list_analyses(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return (
        db.query(models.Analysis)
        .filter(models.Analysis.user_id == current_user.id)
        .order_by(models.Analysis.created_at.desc())
        .limit(50)
        .all()
    )


@router.get("/{analysis_id}", response_model=schemas.AnalysisResponse)
def get_analysis(
    analysis_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    row = (
        db.query(models.Analysis)
        .filter(models.Analysis.id == analysis_id, models.Analysis.user_id == current_user.id)
        .first()
    )
    if not row:
        raise HTTPException(404, "Analysis not found")
    return row


@router.delete("/{analysis_id}")
def delete_analysis(
    analysis_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    row = (
        db.query(models.Analysis)
        .filter(models.Analysis.id == analysis_id, models.Analysis.user_id == current_user.id)
        .first()
    )
    if not row:
        raise HTTPException(404, "Analysis not found")
    db.delete(row)
    db.commit()
    return {"ok": True}
