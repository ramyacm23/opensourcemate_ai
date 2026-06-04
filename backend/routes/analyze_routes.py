"""
AI-powered issue/repo/error/conflict analysis.

Reads stage-2 user inputs, optionally enriches via GitHub API using the user's
stored OAuth token, then calls an LLM (default OpenAI gpt-4o-mini) to produce
the structured analysis described in stages 3, 4, 5 of the plan.
"""
import os
import re
import json
import asyncio
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
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "openai").lower()  # openai | azure | groq | cloudflare | ollama
LLM_MODEL = os.getenv("LLM_MODEL", "gpt-4o-mini")
LLM_API_KEY = os.getenv("OPENAI_API_KEY") or os.getenv("LLM_API_KEY")
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "https://api.openai.com/v1")

# Azure OpenAI specific config — used when LLM_PROVIDER=azure
# Endpoint example:  https://my-resource.openai.azure.com
# Deployment is the NAME you gave the model in Azure portal (NOT the model id).
AZURE_OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT", "").rstrip("/")
AZURE_OPENAI_API_KEY = os.getenv("AZURE_OPENAI_API_KEY", "")
AZURE_OPENAI_DEPLOYMENT = os.getenv("AZURE_OPENAI_DEPLOYMENT", "")
AZURE_OPENAI_API_VERSION = os.getenv("AZURE_OPENAI_API_VERSION", "2024-10-21")

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


async def _fetch_readme(client: httpx.AsyncClient, owner: str, repo: str, token: Optional[str]) -> Optional[str]:
    """Return the decoded README text, or None on failure. Best-effort — never raises."""
    try:
        r = await client.get(
            f"{GITHUB_API}/repos/{owner}/{repo}/readme",
            headers={**_gh_headers(token), "Accept": "application/vnd.github.raw"},
        )
        if r.status_code == 200:
            return r.text
    except Exception:
        pass
    return None


async def _fetch_top_issues(client: httpx.AsyncClient, owner: str, repo: str, token: Optional[str], limit: int = 8) -> list:
    """Return up to `limit` recently updated open issues (PRs filtered out). Best-effort."""
    try:
        r = await client.get(
            f"{GITHUB_API}/repos/{owner}/{repo}/issues",
            headers=_gh_headers(token),
            params={"state": "open", "sort": "updated", "direction": "desc", "per_page": 25},
        )
        if r.status_code != 200:
            return []
        return [i for i in r.json() if "pull_request" not in i][:limit]
    except Exception:
        return []


async def _fetch_languages(client: httpx.AsyncClient, owner: str, repo: str, token: Optional[str]) -> Dict[str, int]:
    try:
        r = await client.get(f"{GITHUB_API}/repos/{owner}/{repo}/languages", headers=_gh_headers(token))
        if r.status_code == 200:
            return r.json()
    except Exception:
        pass
    return {}


async def _fetch_root_tree(client: httpx.AsyncClient, owner: str, repo: str, default_branch: str, token: Optional[str]) -> list:
    """Top-level files/folders so the model can reason about project structure. Best-effort."""
    try:
        r = await client.get(
            f"{GITHUB_API}/repos/{owner}/{repo}/contents/",
            headers=_gh_headers(token),
            params={"ref": default_branch} if default_branch else None,
        )
        if r.status_code != 200:
            return []
        data = r.json() or []
        # Keep only name + type, sorted: folders first, then files
        items = [(it.get("name", ""), it.get("type", "")) for it in data if isinstance(it, dict)]
        items.sort(key=lambda x: (0 if x[1] == "dir" else 1, x[0].lower()))
        return items[:60]
    except Exception:
        return []


async def _fetch_good_first_issues(client: httpx.AsyncClient, owner: str, repo: str, token: Optional[str], limit: int = 8) -> list:
    """Open issues labeled 'good first issue' or 'help wanted' — prioritized for beginners."""
    out: list = []
    seen: set = set()
    for label in ("good first issue", "help wanted"):
        try:
            r = await client.get(
                f"{GITHUB_API}/repos/{owner}/{repo}/issues",
                headers=_gh_headers(token),
                params={"state": "open", "labels": label, "sort": "updated", "direction": "desc", "per_page": 12},
            )
            if r.status_code != 200:
                continue
            for it in r.json():
                if "pull_request" in it:
                    continue
                num = it.get("number")
                if num in seen:
                    continue
                seen.add(num)
                out.append(it)
                if len(out) >= limit:
                    return out
        except Exception:
            continue
    return out


async def _fetch_contributing(client: httpx.AsyncClient, owner: str, repo: str, token: Optional[str]) -> Optional[str]:
    """Try common locations for CONTRIBUTING.md. Returns text or None."""
    for path in ("CONTRIBUTING.md", ".github/CONTRIBUTING.md", "docs/CONTRIBUTING.md", "contributing.md"):
        try:
            r = await client.get(
                f"{GITHUB_API}/repos/{owner}/{repo}/contents/{path}",
                headers={**_gh_headers(token), "Accept": "application/vnd.github.raw"},
            )
            if r.status_code == 200 and r.text:
                return r.text
        except Exception:
            pass
    return None


async def _fetch_recent_commits(client: httpx.AsyncClient, owner: str, repo: str, token: Optional[str], limit: int = 8) -> list:
    """Recent commits on default branch — hints at project activity & focus areas."""
    try:
        r = await client.get(
            f"{GITHUB_API}/repos/{owner}/{repo}/commits",
            headers=_gh_headers(token),
            params={"per_page": limit},
        )
        if r.status_code != 200:
            return []
        out = []
        for c in r.json()[:limit]:
            msg = (c.get("commit", {}).get("message") or "").split("\n", 1)[0][:160]
            author = (c.get("commit", {}).get("author", {}) or {}).get("name", "?")
            out.append({"sha": (c.get("sha") or "")[:7], "msg": msg, "author": author})
        return out
    except Exception:
        return []


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


def _to_text(v) -> Optional[str]:
    """Coerce an LLM field that may arrive as str / list / dict into a clean text string."""
    if v is None:
        return None
    if isinstance(v, str):
        return v
    if isinstance(v, list):
        return "\n\n".join(_to_text(x) or "" for x in v).strip() or None
    if isinstance(v, dict):
        # join values
        return "\n\n".join(f"**{k}**: {_to_text(val) or ''}" for k, val in v.items()).strip() or None
    return str(v)


def _to_markdown_steps(v) -> Optional[str]:
    """Normalize `solution_steps` into clean markdown.
    Accepts str (passed through), list[str] (numbered), list[dict] (title+body), or dict.
    """
    if v is None:
        return None
    if isinstance(v, str):
        return v
    if isinstance(v, list):
        out = []
        for i, item in enumerate(v, 1):
            if isinstance(item, str):
                # If the string already starts with a numeric/markdown marker, keep as-is.
                stripped = item.lstrip()
                if stripped.startswith(("#", "-", "*")) or (stripped[:3].rstrip(".").isdigit() and "." in stripped[:4]):
                    out.append(item.strip())
                else:
                    out.append(f"### Step {i}\n\n{item.strip()}")
            elif isinstance(item, dict):
                title = item.get("title") or item.get("step") or item.get("name") or f"Step {i}"
                body_parts = []
                for k in ("description", "details", "body", "explanation", "instructions"):
                    if item.get(k):
                        body_parts.append(_to_text(item[k]) or "")
                code = item.get("code") or item.get("snippet") or item.get("example")
                if code:
                    lang = item.get("language") or item.get("lang") or ""
                    body_parts.append(f"```{lang}\n{code}\n```")
                # any leftover keys not handled above
                handled = {"title", "step", "name", "description", "details", "body",
                           "explanation", "instructions", "code", "snippet", "example",
                           "language", "lang"}
                for k, val in item.items():
                    if k not in handled and val:
                        body_parts.append(f"**{k}**: {_to_text(val) or ''}")
                body = "\n\n".join(b for b in body_parts if b).strip()
                out.append(f"### Step {i}: {title}" + (f"\n\n{body}" if body else ""))
            else:
                out.append(f"### Step {i}\n\n{str(item)}")
        return "\n\n".join(out).strip() or None
    if isinstance(v, dict):
        return _to_markdown_steps(list(v.values()))
    return str(v)


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
  "code_suggestions": [
    {
      "file": "src/path/to/file.ext",
      "lines": "42-58"           (or "42" or "" if unknown),
      "language": "typescript"   (lowercase syntax-highlighter id),
      "before": "current code (may be empty for new files)",
      "after": "the recommended new code",
      "explanation": "1-2 sentences on WHY this change fixes/improves it"
    }
  ],
  "git_commands": ["git checkout -b fix/xyz", "git add .", ...],
  "pr_title": "Short, conventional-commit style title",
  "pr_description": "Markdown PR body: what + why + how + checklist"
}
Be concrete. Prefer code examples over hand-waving. Keep beginner-friendly tone.

CRITICAL OUTPUT RULES:
- Return a SINGLE valid JSON object. No prose before or after.
- Inside any string value, you MUST escape newlines as \\n, tabs as \\t, and double-quotes as \\".
- Never put raw line breaks inside a JSON string.
- Do not wrap the JSON in markdown fences.
- `summary`, `root_cause`, `solution_steps`, `pr_title`, `pr_description` MUST be JSON STRINGS, never arrays or objects. If a field has multiple parts, join them inside one markdown string.
- `solution_steps` is ONE markdown string with numbered "### Step N: title" headings, NOT an array of strings.
- `files_involved`, `tech_stack`, `git_commands` are arrays of strings.
- `code_suggestions` is an ARRAY of OBJECTS with `file`, `lines`, `language`, `before`, `after`, `explanation`. Provide 1-5 entries when there are concrete code changes (issue/error/conflict modes). Empty array `[]` is OK for repo-review mode if no specific patch fits.

CODE SUGGESTION RULES:
- Each entry MUST point to a real-looking file path (use the README/structure context to infer it).
- `before` should be the smallest meaningful slice of current code that needs to change (5-25 lines max). Leave empty string for brand-new files.
- `after` is the corrected/new code only — not the whole file. Same scope as `before`.
- `lines` is the line range you're targeting in the original file (e.g. "42-58"). Use "" if you genuinely cannot infer.
- `language` is a lowercase syntax-highlighter id like "typescript", "python", "go", "rust", "javascript", "tsx", "jsx", "yaml", "json", "bash".
- `explanation` is 1-2 sentences focused on WHY (the bug/improvement), not WHAT.

LENGTH LIMITS (HARD — output is capped; exceeding these truncates the response):
- summary: 2-4 sentences, <= 700 characters
- root_cause: <= 800 characters
- solution_steps: <= 9000 characters. Use H2 ("##") section headers to organize. Code snippets <= 15 lines each.
- pr_description: <= 1500 characters with a brief checklist
- git_commands: <= 10 commands total
If the problem is complex, summarize the approach instead of pasting long code. Brevity > verbosity, but be SUBSTANTIVE — do NOT return generic "clone the repo, create branch" boilerplate. Always anchor steps to the specific code, files, error, or issue described."""


async def _call_llm(prompt: str) -> Dict[str, Any]:
    # ---- Provider-specific URL + auth headers ----
    if LLM_PROVIDER == "azure":
        if not (AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY and AZURE_OPENAI_DEPLOYMENT):
            raise HTTPException(
                503,
                "Azure OpenAI not configured. Admin must set AZURE_OPENAI_ENDPOINT, "
                "AZURE_OPENAI_API_KEY, and AZURE_OPENAI_DEPLOYMENT in backend .env",
            )
        url = (
            f"{AZURE_OPENAI_ENDPOINT}/openai/deployments/{AZURE_OPENAI_DEPLOYMENT}"
            f"/chat/completions?api-version={AZURE_OPENAI_API_VERSION}"
        )
        auth_headers = {"api-key": AZURE_OPENAI_API_KEY}
        # Azure ignores the "model" field in body — deployment name in URL drives it.
        # Send it anyway for logging/compat.
        model_for_payload = AZURE_OPENAI_DEPLOYMENT
    else:
        if not LLM_API_KEY:
            raise HTTPException(
                503,
                "AI service not configured. Admin must set OPENAI_API_KEY (or LLM_API_KEY) in backend .env",
            )
        url = f"{LLM_BASE_URL}/chat/completions"
        auth_headers = {"Authorization": f"Bearer {LLM_API_KEY}"}
        model_for_payload = LLM_MODEL

    base_payload = {
        "model": model_for_payload,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt + "\n\nRespond with valid JSON only — no markdown, no prose."},
        ],
        "temperature": 0.3,
        # Generous cap — Azure gpt-4.1-mini, OpenAI, and Llama all handle 8000 fine.
        # Cloudflare 8B truncates around 4096 but we have recovery for that.
        "max_tokens": 8000 if LLM_PROVIDER in ("azure", "openai") else 4096,
    }

    headers = {**auth_headers, "Content-Type": "application/json"}

    async with httpx.AsyncClient(timeout=120.0) as client:
        # First try with strict JSON mode (works on OpenAI, Azure, some CF models)
        payload = {**base_payload, "response_format": {"type": "json_object"}}
        r = await client.post(url, headers=headers, json=payload)

        # Some Cloudflare / Ollama models reject response_format → retry without it
        if r.status_code in (400, 422):
            log.info(
                "response_format unsupported, retrying without it (provider=%s, model=%s)",
                LLM_PROVIDER, model_for_payload,
            )
            r = await client.post(url, headers=headers, json=base_payload)

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


async def _call_llm_chat(messages: list, max_tokens: int = 1500) -> str:
    """Plain chat completion (no JSON enforcement) using the same provider config.
    `messages` is a list of {"role": "system"|"user"|"assistant", "content": str}.
    Returns the assistant text.
    """
    if LLM_PROVIDER == "azure":
        if not (AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY and AZURE_OPENAI_DEPLOYMENT):
            raise HTTPException(503, "Azure OpenAI not configured")
        url = (
            f"{AZURE_OPENAI_ENDPOINT}/openai/deployments/{AZURE_OPENAI_DEPLOYMENT}"
            f"/chat/completions?api-version={AZURE_OPENAI_API_VERSION}"
        )
        auth_headers = {"api-key": AZURE_OPENAI_API_KEY}
        model_for_payload = AZURE_OPENAI_DEPLOYMENT
    else:
        if not LLM_API_KEY:
            raise HTTPException(503, "AI service not configured")
        url = f"{LLM_BASE_URL}/chat/completions"
        auth_headers = {"Authorization": f"Bearer {LLM_API_KEY}"}
        model_for_payload = LLM_MODEL

    payload = {
        "model": model_for_payload,
        "messages": messages,
        "temperature": 0.5,
        "max_tokens": max_tokens,
    }
    headers = {**auth_headers, "Content-Type": "application/json"}

    async with httpx.AsyncClient(timeout=90.0) as client:
        r = await client.post(url, headers=headers, json=payload)
        if r.status_code != 200:
            log.error("LLM chat error %s: %s", r.status_code, r.text[:500])
            raise HTTPException(502, f"AI service error ({r.status_code})")
        body = r.json()
        try:
            content = body["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError):
            content = body.get("result", {}).get("response") or body.get("response") or ""
        if not content:
            raise HTTPException(502, "AI returned empty response")
        return content.strip()


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
    escaped = _escape_raw_controls_in_strings(s)
    yield escaped

    # Truncation recovery — when the model hit max_tokens mid-string,
    # close any open string and balance braces/brackets so json.loads can read the partial doc.
    yield _recover_truncated_json(escaped)
    # Also try recovery on the {...} block specifically
    if m:
        yield _recover_truncated_json(_escape_raw_controls_in_strings(m.group(0)))


def _recover_truncated_json(s: str) -> str:
    """Best-effort close of a JSON doc truncated by max_tokens.
    Walks the (already control-escaped) string tracking quote/bracket/brace state,
    then appends the closers needed to make it parseable.
    """
    in_str = False
    esc = False
    stack: list = []  # holds '{' or '['
    # Trim trailing partial token (commas/colons hanging in the air)
    s = s.rstrip()
    for ch in s:
        if esc:
            esc = False
            continue
        if ch == "\\":
            esc = True
            continue
        if ch == '"':
            in_str = not in_str
            continue
        if in_str:
            continue
        if ch == '{' or ch == '[':
            stack.append(ch)
        elif ch == '}' or ch == ']':
            if stack:
                stack.pop()
    out = s
    # Close an open string
    if in_str:
        out += '"'
    # Drop a trailing comma or colon before closing containers
    out = re.sub(r"[,:]\s*$", "", out)
    # Close containers in reverse order
    closers = {'{': '}', '[': ']'}
    while stack:
        out += closers[stack.pop()]
    return out


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


def _build_prompt(
    req: schemas.AnalyzeRequest,
    issue_data: Optional[dict],
    repo_data: Optional[dict],
    readme: Optional[str] = None,
    top_issues: Optional[list] = None,
    languages: Optional[Dict[str, int]] = None,
    root_tree: Optional[list] = None,
    good_first_issues: Optional[list] = None,
    contributing: Optional[str] = None,
    recent_commits: Optional[list] = None,
) -> str:
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
        lang_str = "—"
        if languages:
            total = sum(languages.values()) or 1
            top = sorted(languages.items(), key=lambda x: -x[1])[:5]
            lang_str = ", ".join(f"{k} {v * 100 // total}%" for k, v in top)
        parts.append(
            f"## Repository\n"
            f"Name: {repo_data.get('full_name')}\n"
            f"Description: {repo_data.get('description') or '—'}\n"
            f"Primary language: {repo_data.get('language') or '—'}\n"
            f"Language breakdown: {lang_str}\n"
            f"Topics: {', '.join(repo_data.get('topics') or []) or '—'}\n"
            f"Stars: {repo_data.get('stargazers_count')} \u00b7 Forks: {repo_data.get('forks_count')} \u00b7 Open issues: {repo_data.get('open_issues_count')}\n"
            f"Default branch: {repo_data.get('default_branch')}\n"
            f"License: {(repo_data.get('license') or {}).get('spdx_id') or '—'}\n"
            f"Homepage: {repo_data.get('homepage') or '—'}"
        )
    if root_tree:
        tree_lines = []
        for n, t in root_tree:
            icon = "[dir]" if t == "dir" else "[file]"
            tree_lines.append(f"{icon} {n}")
        parts.append("## Top-level structure\n" + "\n".join(tree_lines))
    if readme:
        parts.append(f"## README excerpt\n{_truncate(readme, 5000)}")
    if contributing:
        parts.append(f"## CONTRIBUTING guide excerpt\n{_truncate(contributing, 2500)}")
    if recent_commits:
        commit_lines = [f"- `{c['sha']}` {c['msg']} \u2014 _{c['author']}_" for c in recent_commits]
        parts.append("## Recent commits (default branch)\n" + "\n".join(commit_lines))
    if good_first_issues:
        gfi_lines = []
        for it in good_first_issues:
            labels = ", ".join(l.get("name", "") for l in (it.get("labels") or []))
            body_excerpt = (it.get("body") or "").strip().replace("\r", "").replace("\n", " ")
            if len(body_excerpt) > 350:
                body_excerpt = body_excerpt[:350] + "\u2026"
            gfi_lines.append(
                f"- #{it.get('number')} \u00b7 {it.get('title')}"
                + (f" \u00b7 [{labels}]" if labels else "")
                + f" \u00b7 \ud83d\udd17 {it.get('html_url')}"
                + (f"\n   {body_excerpt}" if body_excerpt else "")
            )
        parts.append("## Beginner-friendly open issues (good first issue / help wanted)\n" + "\n".join(gfi_lines))
    if top_issues:
        lines = []
        for it in top_issues:
            labels = ", ".join(l.get("name", "") for l in (it.get("labels") or []))
            body_excerpt = (it.get("body") or "").strip().replace("\r", "").replace("\n", " ")
            if len(body_excerpt) > 280:
                body_excerpt = body_excerpt[:280] + "\u2026"
            lines.append(
                f"- #{it.get('number')} \u00b7 {it.get('title')}"
                + (f" \u00b7 [{labels}]" if labels else "")
                + (f"\n   {body_excerpt}" if body_excerpt else "")
            )
        parts.append("## Other recently active open issues (sample)\n" + "\n".join(lines))
    if req.error_log:
        parts.append(f"## Error / Stack Trace\n```\n{_truncate(req.error_log, 6000)}\n```")
    if req.merge_conflict:
        parts.append(f"## Merge Conflict Snippet\n```\n{_truncate(req.merge_conflict, 6000)}\n```")

    # Task framing depends on what we have
    if issue_data:
        task = (
            "Analyze the GitHub issue above. Identify the most likely root cause, the files probably involved, "
            "and produce concrete step-by-step guidance with code examples a junior contributor can follow. "
            "Make `solution_steps` specific to THIS issue \u2014 not generic onboarding. "
            "Generate a `pr_title` and `pr_description` ready to paste into GitHub."
        )
    elif req.error_log:
        task = (
            "Analyze the error/stack trace above. Identify the root cause, the file(s) most likely responsible, "
            "and write step-by-step debugging guidance with code snippets. Suggest a fix and generate a PR draft."
        )
    elif req.merge_conflict:
        task = (
            "Analyze the merge conflict above. Identify which side to keep (or how to combine), explain why, "
            "and provide step-by-step resolution with the resolved code snippet."
        )
    elif repo_data:
        task = (
            "The user pasted a GitHub repo to find REAL ISSUES they can fix and contribute. "
            "Your job is to AUDIT the repo using ALL the context above (README, CONTRIBUTING, top-level structure, "
            "language breakdown, recent commits, good-first-issue + help-wanted + recently active issues) and surface "
            "CONCRETE PROBLEMS \u2014 not just describe what the project does. Be a senior engineer doing a code review.\n\n"
            "FORMAT `solution_steps` AS RICH MARKDOWN with EXACTLY these H2 sections in this order:\n\n"
            "## What this project does\n"
            "2-3 sentences in plain English. Skip if README clearly explains it; just give a tight pitch.\n\n"
            "## Architecture & key modules\n"
            "Bullet list of the most important folders/files from the top-level structure with a 1-line purpose for each "
            "(e.g. `- src/api/ \u2014 FastAPI route handlers`). 4-8 entries. Be specific, do NOT invent paths.\n\n"
            "## \ud83d\udd0d Issues & improvements I found (most important section)\n"
            "List 4-6 CONCRETE problems worth fixing. Mix of: open-issue triage, code smells inferred from structure, "
            "missing tests, missing docs, dependency/security debt, performance bottlenecks, type/linting gaps, dead code, "
            "DX rough edges. For EACH finding write:\n"
            "### \u2014 <Short title of the problem>\n"
            "- **Type:** bug | tech-debt | missing-test | docs | security | perf | refactor | DX\n"
            "- **Where:** specific file/folder path from the tree, OR `issue #N` from the open-issues list\n"
            "- **Evidence:** 1-2 sentences citing what tipped you off (an open issue title, recent commit message, gap in the structure, README mention, etc.)\n"
            "- **Suggested fix:** 2-4 short bullets with the concrete approach\n"
            "- **Difficulty:** easy / medium / hard\n"
            "Anchor every finding to something verifiable in the context. Do NOT invent issues that aren't supported by "
            "the README, structure, recent commits, or open issues. If you genuinely cannot find 4 issues, give 2-3 strong ones.\n\n"
            "## Open issues you can claim today\n"
            "Pick 3-5 from the BEGINNER-FRIENDLY list (preferred) or recently active list. For EACH:\n"
            "### #<number> \u2014 <title>\n"
            "- **Difficulty:** easy / medium / hard\n"
            "- **Why this is a good fit:** 1-2 sentences\n"
            "- **Files likely involved:** comma-separated paths\n"
            "- **Approach:** 3-5 short bullets\n\n"
            "## Local setup quick start\n"
            "Numbered steps inferred from README/CONTRIBUTING (clone \u2192 install \u2192 env \u2192 run \u2192 test). 4-7 steps with `code blocks`. "
            "If a step is unclear in the docs, say `(check README)` instead of inventing.\n\n"
            "## Contribution workflow\n"
            "3-5 numbered steps reflecting the CONTRIBUTING guide (branch naming, commit style, PR template, code style, tests). "
            "If no CONTRIBUTING, give sensible defaults marked `(general best practice)`.\n\n"
            "ALSO POPULATE `code_suggestions` (2-4 entries) with CONCRETE patches for the most actionable findings above. "
            "Each entry should have a real-looking file path inferred from the tree, a focused before/after slice, "
            "and an explanation tying back to one of the findings. If you genuinely cannot infer real code, return "
            "patches for obvious gaps (missing CI, missing test file scaffolding, missing CONTRIBUTING.md, missing "
            "type hints, etc.) with a sensible filename and skeleton content. Do NOT leave the array empty unless the "
            "repo is clearly perfect.\n\n"
            "Set `summary` to: 1 sentence on the project + 1-2 sentences on the TOP issues a contributor should tackle first. "
            "Set `difficulty` to the OVERALL beginner contribution difficulty. "
            "Set `files_involved` to the files a contributor will touch FIRST when fixing the issues you found. "
            "Set `tech_stack` to actual technologies (language breakdown + manifests). "
            "Set `root_cause` to \"N/A\". "
            "Set `pr_title` and `pr_description` as a TEMPLATE for the FIRST finding you flagged \u2014 with placeholders "
            "(`<issue-#>`, `<file>`) the user can adapt. "
            "Set `git_commands` to a clean contributor workflow specific to this repo (fork, clone, branch, commit, push, PR)."
        )
    else:
        task = "Analyze the inputs above and respond with the JSON schema."

    return "\n\n".join(parts) + f"\n\n## Your Task\n{task}\n\nRespond with the JSON schema."


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
        model_used=(AZURE_OPENAI_DEPLOYMENT if LLM_PROVIDER == "azure" else LLM_MODEL),
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    try:
        gh_token = current_user.github_access_token  # may be None — public repos still work

        issue_data = repo_data = None
        readme = None
        top_issues: list = []
        languages: Dict[str, int] = {}
        root_tree: list = []
        good_first: list = []
        contributing: Optional[str] = None
        recent_commits: list = []
        async with httpx.AsyncClient(timeout=20.0) as client:
            if issue_parts:
                owner, repo, num = issue_parts
                issue_data = await _fetch_issue(client, owner, repo, num, gh_token)
                row.issue_title = issue_data.get("title")
                row.issue_body = _truncate(issue_data.get("body"), 8000)
                row.repo_name = f"{owner}/{repo}"
                # also fetch repo for language
                repo_data = await _fetch_repo(client, owner, repo, gh_token)
                languages = await _fetch_languages(client, owner, repo, gh_token)
            elif repo_parts:
                owner, repo = repo_parts
                repo_data = await _fetch_repo(client, owner, repo, gh_token)
                row.repo_name = f"{owner}/{repo}"
                default_branch = repo_data.get("default_branch") or "main"
                # Repo-only mode: pull README, languages, structure, beginner-friendly issues,
                # CONTRIBUTING, and recent commits in PARALLEL so the LLM has rich context.
                (
                    readme,
                    languages,
                    top_issues,
                    root_tree,
                    good_first,
                    contributing,
                    recent_commits,
                ) = await asyncio.gather(
                    _fetch_readme(client, owner, repo, gh_token),
                    _fetch_languages(client, owner, repo, gh_token),
                    _fetch_top_issues(client, owner, repo, gh_token, limit=10),
                    _fetch_root_tree(client, owner, repo, default_branch, gh_token),
                    _fetch_good_first_issues(client, owner, repo, gh_token, limit=8),
                    _fetch_contributing(client, owner, repo, gh_token),
                    _fetch_recent_commits(client, owner, repo, gh_token, limit=8),
                )

        if repo_data:
            row.repo_language = repo_data.get("language")

        prompt = _build_prompt(
            body, issue_data, repo_data,
            readme=readme, top_issues=top_issues, languages=languages,
            root_tree=root_tree, good_first_issues=good_first,
            contributing=contributing, recent_commits=recent_commits,
        )
        result = await _call_llm(prompt)

        row.summary = _to_text(result.get("summary"))
        row.difficulty = (result.get("difficulty") or "").lower() or None
        files = result.get("files_involved") or []
        row.files_involved = "\n".join(files) if isinstance(files, list) else str(files)
        tech = result.get("tech_stack") or []
        row.tech_stack = ", ".join(tech) if isinstance(tech, list) else str(tech)
        row.root_cause = _to_text(result.get("root_cause"))
        row.solution_steps = _to_markdown_steps(result.get("solution_steps"))
        cmds = result.get("git_commands") or []
        row.git_commands = "\n".join(cmds) if isinstance(cmds, list) else str(cmds)
        row.pr_title = _to_text(result.get("pr_title"))
        row.pr_description = _to_text(result.get("pr_description"))

        # Code suggestions: keep only valid dict entries with at least one of before/after,
        # store as JSON string for the frontend to parse.
        raw_cs = result.get("code_suggestions") or []
        clean_cs: list = []
        if isinstance(raw_cs, list):
            for item in raw_cs:
                if not isinstance(item, dict):
                    continue
                before = _to_text(item.get("before")) or ""
                after = _to_text(item.get("after")) or ""
                if not (before or after):
                    continue
                clean_cs.append({
                    "file": _to_text(item.get("file")) or "",
                    "lines": _to_text(item.get("lines")) or "",
                    "language": (_to_text(item.get("language")) or "").lower().strip(),
                    "before": before,
                    "after": after,
                    "explanation": _to_text(item.get("explanation")) or "",
                })
        row.code_suggestions = json.dumps(clean_cs) if clean_cs else None
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


# ---------------- Chat assistant ----------------

CHAT_SYSTEM = """You are OpenSourceMate's friendly contribution coach.
A student or junior developer is looking at an AI analysis of a GitHub issue / repo / error / merge conflict and has follow-up questions.
You have FULL CONTEXT of that analysis below. Stay grounded in it — refer to specific files, steps, code suggestions, and commands from the context. Don't invent file paths or facts not present in the context.

Be concise: 2-6 short paragraphs OR a tight bulleted list. Use markdown. Use fenced code blocks with a language tag for any code. If the user asks something unrelated to programming/contribution, gently redirect.

If you genuinely don't know, say so and suggest where they could look. Never produce fake links."""


def _build_chat_context(a: models.Analysis) -> str:
    """Compact, structured context for the chat assistant."""
    lines = ["# Analysis context"]
    if a.repo_name:
        lines.append(f"- Repo: {a.repo_name}")
    if a.repo_language:
        lines.append(f"- Primary language: {a.repo_language}")
    if a.issue_url:
        lines.append(f"- Issue URL: {a.issue_url}")
    if a.issue_title:
        lines.append(f"- Issue title: {a.issue_title}")
    if a.difficulty:
        lines.append(f"- Difficulty: {a.difficulty}")
    if a.tech_stack:
        lines.append(f"- Tech stack: {a.tech_stack}")

    if a.summary:
        lines.append("\n## Summary\n" + a.summary)
    if a.root_cause and a.root_cause.strip().lower() not in ("n/a", "na", ""):
        lines.append("\n## Root cause\n" + a.root_cause)
    if a.files_involved:
        lines.append("\n## Files involved\n" + a.files_involved)
    if a.solution_steps:
        # cap to keep prompts manageable
        steps = a.solution_steps if len(a.solution_steps) <= 5000 else a.solution_steps[:5000] + "\n…[truncated]"
        lines.append("\n## Step-by-step solution\n" + steps)
    if a.code_suggestions:
        try:
            cs = json.loads(a.code_suggestions)
            if isinstance(cs, list) and cs:
                lines.append("\n## Code suggestions")
                for i, item in enumerate(cs[:5], 1):
                    if not isinstance(item, dict):
                        continue
                    lines.append(f"\n### #{i} — {item.get('file') or '(file unknown)'}"
                                 + (f" L{item.get('lines')}" if item.get('lines') else ""))
                    if item.get("explanation"):
                        lines.append(item["explanation"])
                    lang = item.get("language") or ""
                    if item.get("before"):
                        lines.append(f"Before:\n```{lang}\n{item['before']}\n```")
                    if item.get("after"):
                        lines.append(f"After:\n```{lang}\n{item['after']}\n```")
        except Exception:
            pass
    if a.git_commands:
        lines.append("\n## Git commands\n```bash\n" + a.git_commands + "\n```")
    if a.error_log:
        snippet = a.error_log[:1500] + ("\n…[truncated]" if len(a.error_log) > 1500 else "")
        lines.append("\n## User-provided error log\n```\n" + snippet + "\n```")
    if a.merge_conflict:
        snippet = a.merge_conflict[:1500] + ("\n…[truncated]" if len(a.merge_conflict) > 1500 else "")
        lines.append("\n## User-provided merge conflict\n```\n" + snippet + "\n```")

    return "\n".join(lines)


@router.get("/{analysis_id}/chat", response_model=list[schemas.ChatMessage])
def list_chat_messages(
    analysis_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    # ownership check
    a = (
        db.query(models.Analysis)
        .filter(models.Analysis.id == analysis_id, models.Analysis.user_id == current_user.id)
        .first()
    )
    if not a:
        raise HTTPException(404, "Analysis not found")
    msgs = (
        db.query(models.AnalysisMessage)
        .filter(models.AnalysisMessage.analysis_id == analysis_id)
        .order_by(models.AnalysisMessage.id.asc())
        .all()
    )
    return msgs


@router.post("/{analysis_id}/chat", response_model=schemas.ChatResponse)
async def send_chat_message(
    analysis_id: int,
    body: schemas.ChatRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    user_text = (body.message or "").strip()
    if not user_text:
        raise HTTPException(400, "Message cannot be empty")
    if len(user_text) > 4000:
        raise HTTPException(400, "Message too long (4000 char max)")

    a = (
        db.query(models.Analysis)
        .filter(models.Analysis.id == analysis_id, models.Analysis.user_id == current_user.id)
        .first()
    )
    if not a:
        raise HTTPException(404, "Analysis not found")

    # Persist user msg first
    user_msg = models.AnalysisMessage(analysis_id=a.id, role="user", content=user_text)
    db.add(user_msg)
    db.commit()
    db.refresh(user_msg)

    # Build prompt: system + analysis context + last 20 messages
    history = (
        db.query(models.AnalysisMessage)
        .filter(models.AnalysisMessage.analysis_id == a.id)
        .order_by(models.AnalysisMessage.id.asc())
        .all()
    )
    # keep last 20 turns
    history = history[-20:]

    messages = [
        {"role": "system", "content": CHAT_SYSTEM + "\n\n" + _build_chat_context(a)},
    ]
    for m in history:
        messages.append({"role": m.role, "content": m.content})

    try:
        reply = await _call_llm_chat(messages, max_tokens=1500)
    except HTTPException:
        # rollback the user message? keep it so the user can retry
        raise
    except Exception as e:
        log.exception("Chat call failed")
        raise HTTPException(502, f"AI chat failed: {str(e)[:200]}")

    asst = models.AnalysisMessage(analysis_id=a.id, role="assistant", content=reply)
    db.add(asst)
    db.commit()
    db.refresh(asst)

    return schemas.ChatResponse(user_message=user_msg, assistant_message=asst)
