"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  FiZap, FiAlertCircle, FiGitMerge,
  FiLink, FiPackage, FiLoader, FiCheck, FiGithub, FiSearch,
  FiLock, FiStar, FiChevronRight, FiX,
} from "react-icons/fi";
import { api } from "@/lib/api";
import AppShell from "@/components/AppShell";

type Repo = {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  open_issues_count: number;
  private: boolean;
  fork: boolean;
  updated_at: string;
};

type Issue = {
  number: number;
  title: string;
  html_url: string;
  state: string;
  labels: { name: string; color?: string }[];
  comments: number;
  updated_at: string;
};

export default function AnalyzePage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);

  const [issueUrl, setIssueUrl] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [errorLog, setErrorLog] = useState("");
  const [mergeConflict, setMergeConflict] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // GitHub picker state
  const [ghConnected, setGhConnected] = useState<boolean | null>(null);
  const [repos, setRepos] = useState<Repo[]>([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [repoSearch, setRepoSearch] = useState("");
  const [pickedRepo, setPickedRepo] = useState<Repo | null>(null);

  const [issues, setIssues] = useState<Issue[] | null>(null);
  const [issuesLoading, setIssuesLoading] = useState(false);
  const [issueSearch, setIssueSearch] = useState("");

  useEffect(() => {
    const t = localStorage.getItem("token");
    if (!t) { router.push("/login"); return; }
    setToken(t);
  }, [router]);

  // Load repos once we have token
  useEffect(() => {
    if (!token) return;
    setReposLoading(true);
    api.githubRepos(token)
      .then((rs: Repo[]) => { setRepos(rs); setGhConnected(true); })
      .catch(() => { setGhConnected(false); })
      .finally(() => setReposLoading(false));
  }, [token]);

  const filteredRepos = useMemo(() => {
    const q = repoSearch.trim().toLowerCase();
    if (!q) return repos;
    return repos.filter(
      (r) =>
        r.full_name.toLowerCase().includes(q) ||
        (r.description || "").toLowerCase().includes(q)
    );
  }, [repos, repoSearch]);

  const filteredIssues = useMemo(() => {
    if (!issues) return [];
    const q = issueSearch.trim().toLowerCase();
    if (!q) return issues;
    return issues.filter((i) => i.title.toLowerCase().includes(q));
  }, [issues, issueSearch]);

  async function pickRepo(r: Repo) {
    setPickedRepo(r);
    setRepoUrl(r.html_url);
    setIssues(null);
    setIssueSearch("");
    if (!token) return;
    const [owner, name] = r.full_name.split("/");
    setIssuesLoading(true);
    try {
      const list = await api.githubRepoIssues(owner, name, token);
      setIssues(list);
    } catch {
      setIssues([]);
    } finally {
      setIssuesLoading(false);
    }
  }

  function clearPicked() {
    setPickedRepo(null);
    setIssues(null);
    setIssueSearch("");
    setRepoUrl("");
    setIssueUrl("");
  }

  function pickIssue(i: Issue) {
    setIssueUrl(i.html_url);
  }

  const hasInput =
    issueUrl.trim() || repoUrl.trim() || errorLog.trim() || mergeConflict.trim();

  async function handleSubmit() {
    if (!token || !hasInput) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.analyze(
        {
          issue_url: issueUrl.trim() || undefined,
          repo_url: repoUrl.trim() || undefined,
          error_log: errorLog.trim() || undefined,
          merge_conflict: mergeConflict.trim() || undefined,
        },
        token
      );
      router.push(`/analyze/${res.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
      setSubmitting(false);
    }
  }

  return (
    <AppShell width="narrow">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <p className="text-xs uppercase tracking-[0.2em] text-crimson font-mono mb-2">Stage 2 · Input</p>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
            What do you need <span className="text-crimson">help</span> with?
          </h2>
          <p className="text-muted-foreground mt-2 text-sm md:text-base max-w-2xl">
            Pick one of your connected GitHub repos, or paste an issue/repo URL, an error trace, or a merge conflict.
            We&apos;ll fetch context (including private repos via OAuth) and produce a step-by-step plan.
          </p>
        </motion.div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className="mb-6 px-4 py-3 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 text-sm flex items-center gap-2"
          >
            <FiAlertCircle size={14} /> {error}
          </motion.div>
        )}

        {/* ---------- Connected GitHub picker ---------- */}
        <Section
          icon={<FiGithub size={14} />}
          title="Pick from your connected GitHub repos"
          hint={
            ghConnected === false
              ? "GitHub not connected — connect from your dashboard to enable picker."
              : "Choose a repo, then optionally pick an open issue from it."
          }
          delay={0}
        >
          {ghConnected === false ? (
            <button
              onClick={() => router.push("/dashboard")}
              className="text-xs text-crimson hover:underline"
            >
              Go to dashboard to connect →
            </button>
          ) : reposLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <FiLoader className="animate-spin" size={12} /> Loading your repos…
            </div>
          ) : pickedRepo ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg bg-crimson/10 border border-crimson/30">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm font-medium truncate">
                    {pickedRepo.private && <FiLock size={11} className="text-crimson shrink-0" />}
                    <span className="truncate">{pickedRepo.full_name}</span>
                  </div>
                  {pickedRepo.description && (
                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{pickedRepo.description}</p>
                  )}
                </div>
                <button
                  onClick={clearPicked}
                  className="text-xs text-muted-foreground hover:text-crimson inline-flex items-center gap-1"
                >
                  <FiX size={12} /> change
                </button>
              </div>

              {/* Issues for picked repo */}
              <div className="border-t border-border pt-3">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
                  Open issues in this repo
                </p>
                {issuesLoading ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <FiLoader className="animate-spin" size={12} /> Loading issues…
                  </div>
                ) : issues && issues.length > 0 ? (
                  <>
                    <div className="relative mb-2">
                      <FiSearch size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input
                        value={issueSearch}
                        onChange={(e) => setIssueSearch(e.target.value)}
                        placeholder="Filter issues…"
                        className="w-full bg-background border border-border rounded-lg pl-8 pr-3 h-9 text-xs focus:outline-none focus:border-crimson/50"
                      />
                    </div>
                    <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
                      {filteredIssues.map((i) => (
                        <button
                          key={i.number}
                          onClick={() => pickIssue(i)}
                          className={`w-full text-left px-3 py-2 rounded-lg border transition-all ${
                            issueUrl === i.html_url
                              ? "border-crimson/50 bg-crimson/10"
                              : "border-border hover:border-crimson/30 hover:bg-crimson/[0.04]"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="text-sm truncate">
                                <span className="text-muted-foreground font-mono mr-1.5">#{i.number}</span>
                                {i.title}
                              </div>
                              {i.labels.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                  {i.labels.slice(0, 4).map((l) => (
                                    <span
                                      key={l.name}
                                      className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted/40 border border-border"
                                    >
                                      {l.name}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            {issueUrl === i.html_url && (
                              <FiCheck size={14} className="text-crimson shrink-0 mt-0.5" />
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">No open issues — repo will be analyzed on its own.</p>
                )}
              </div>
            </div>
          ) : repos.length === 0 ? (
            <p className="text-xs text-muted-foreground">No repos found.</p>
          ) : (
            <>
              <div className="relative mb-3">
                <FiSearch size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={repoSearch}
                  onChange={(e) => setRepoSearch(e.target.value)}
                  placeholder="Search your repos…"
                  className="w-full bg-background border border-border rounded-lg pl-8 pr-3 h-9 text-xs focus:outline-none focus:border-crimson/50"
                />
              </div>
              <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
                {filteredRepos.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => pickRepo(r)}
                    className="w-full text-left px-3 py-2.5 rounded-lg border border-border hover:border-crimson/40 hover:bg-crimson/[0.04] transition-all group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-sm font-medium truncate">
                          {r.private && <FiLock size={11} className="text-muted-foreground shrink-0" />}
                          <span className="truncate">{r.full_name}</span>
                          {r.fork && (
                            <span className="text-[10px] text-muted-foreground font-mono">(fork)</span>
                          )}
                        </div>
                        {r.description && (
                          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{r.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
                          {r.language && <span>{r.language}</span>}
                          <span className="inline-flex items-center gap-1">
                            <FiStar size={10} /> {r.stargazers_count}
                          </span>
                          <span>{r.open_issues_count} open issues</span>
                        </div>
                      </div>
                      <FiChevronRight size={14} className="text-muted-foreground group-hover:text-crimson shrink-0 mt-1" />
                    </div>
                  </button>
                ))}
                {filteredRepos.length === 0 && (
                  <p className="text-xs text-muted-foreground">No repos match &quot;{repoSearch}&quot;.</p>
                )}
              </div>
            </>
          )}
        </Section>

        <div className="my-6 flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">or paste manually</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <div className="space-y-5">
          <Section
            icon={<FiLink size={14} />}
            title="GitHub issue URL"
            hint="https://github.com/owner/repo/issues/123"
            delay={0.05}
          >
            <input
              value={issueUrl}
              onChange={(e) => setIssueUrl(e.target.value)}
              placeholder="https://github.com/owner/repo/issues/123"
              className="w-full bg-background border border-border rounded-lg px-3 h-10 text-sm focus:outline-none focus:border-crimson/50 focus:ring-2 focus:ring-crimson/15 transition-all font-mono"
            />
          </Section>

          <Section
            icon={<FiPackage size={14} />}
            title="GitHub repo URL"
            hint="Public, your own private, or any you have access to via OAuth"
            delay={0.1}
          >
            <input
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/owner/repo"
              className="w-full bg-background border border-border rounded-lg px-3 h-10 text-sm focus:outline-none focus:border-crimson/50 focus:ring-2 focus:ring-crimson/15 transition-all font-mono"
            />
          </Section>

          <Section
            icon={<FiAlertCircle size={14} />}
            title="Error / stack trace"
            hint="Paste runtime errors, build failures, or crash logs"
            delay={0.15}
          >
            <textarea
              value={errorLog}
              onChange={(e) => setErrorLog(e.target.value)}
              rows={5}
              placeholder={`TypeError: Cannot read properties of undefined (reading 'map')\n    at UserList (./components/UserList.tsx:42:15)`}
              className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-crimson/50 focus:ring-2 focus:ring-crimson/15 transition-all font-mono resize-y"
            />
          </Section>

          <Section
            icon={<FiGitMerge size={14} />}
            title="Merge conflict snippet"
            hint="Paste the section between <<<<<<< and >>>>>>>"
            delay={0.2}
          >
            <textarea
              value={mergeConflict}
              onChange={(e) => setMergeConflict(e.target.value)}
              rows={5}
              placeholder={"<<<<<<< HEAD\nconst total = price * quantity;\n=======\nconst total = (price * quantity) + tax;\n>>>>>>> feature/add-tax"}
              className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-crimson/50 focus:ring-2 focus:ring-crimson/15 transition-all font-mono resize-y"
            />
          </Section>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="mt-8 flex items-center justify-between flex-wrap gap-3"
        >
          <p className="text-xs text-muted-foreground">
            {hasInput ? (
              <span className="text-emerald-400 inline-flex items-center gap-1.5">
                <FiCheck size={12} /> Ready to analyze
              </span>
            ) : (
              "Pick a repo or fill at least one field to continue"
            )}
          </p>
          <button
            onClick={handleSubmit}
            disabled={!hasInput || submitting}
            className="inline-flex items-center gap-2 bg-crimson hover:bg-crimson-dark disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed text-white text-sm px-5 h-10 rounded-lg font-medium transition-all glow-crimson disabled:glow-none"
          >
            {submitting ? (
              <>
                <FiLoader className="animate-spin" size={14} />
                Analyzing… (~10s)
              </>
            ) : (
              <>
                <FiZap size={14} /> Analyze with AI
              </>
            )}
          </button>
        </motion.div>
    </AppShell>
  );
}

function Section({
  icon, title, hint, delay = 0, children,
}: { icon: React.ReactNode; title: string; hint: string; delay?: number; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}
      className="bg-surface border border-border rounded-2xl p-5"
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="w-7 h-7 rounded-md bg-crimson/10 border border-crimson/20 text-crimson flex items-center justify-center">
          {icon}
        </span>
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <p className="text-[11.5px] text-muted-foreground mb-3 ml-9">{hint}</p>
      {children}
    </motion.div>
  );
}
