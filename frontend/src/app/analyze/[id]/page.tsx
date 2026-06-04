"use client";
import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  FiArrowLeft, FiLoader, FiAlertCircle, FiCheck, FiCopy,
  FiTerminal, FiFileText, FiCode, FiGitPullRequest, FiZap, FiTrash2,
  FiFile, FiMinus, FiPlus,
} from "react-icons/fi";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Markdown } from "@/components/Markdown";
import { AssistantPanel } from "@/components/AssistantPanel";

interface Analysis {
  id: number;
  issue_url?: string | null;
  repo_url?: string | null;
  error_log?: string | null;
  merge_conflict?: string | null;
  issue_title?: string | null;
  repo_name?: string | null;
  repo_language?: string | null;
  summary?: string | null;
  difficulty?: string | null;
  files_involved?: string | null;
  tech_stack?: string | null;
  root_cause?: string | null;
  solution_steps?: string | null;
  git_commands?: string | null;
  pr_title?: string | null;
  pr_description?: string | null;
  code_suggestions?: string | null;
  status: string;
  error_message?: string | null;
  model_used?: string | null;
  created_at: string;
}

const diffColor: Record<string, string> = {
  easy: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  medium: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  hard: "bg-red-500/15 text-red-300 border-red-500/30",
};

export default function AnalysisResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [data, setData] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { router.push("/login"); return; }
    api.getAnalysis(Number(id), token)
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id, router]);

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1800);
  }

  async function handleDelete() {
    const token = localStorage.getItem("token");
    if (!token || !data) return;
    if (!confirm("Delete this analysis?")) return;
    await api.deleteAnalysis(data.id, token);
    router.push("/analyze/history");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <FiLoader className="animate-spin text-crimson" size={28} />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="text-center">
          <FiAlertCircle className="mx-auto text-crimson mb-3" size={28} />
          <p className="text-sm text-white">{error || "Analysis not found"}</p>
          <button onClick={() => router.push("/analyze")} className="mt-4 text-xs px-3 h-8 rounded-md bg-crimson text-white inline-flex items-center gap-1.5">
            New analysis
          </button>
        </div>
      </div>
    );
  }

  const files = (data.files_involved || "").split("\n").filter(Boolean);
  const tech = (data.tech_stack || "").split(",").map(s => s.trim()).filter(Boolean);
  const cmds = (data.git_commands || "").split("\n").filter(Boolean);

  // Code suggestions arrive as JSON-encoded string
  type CodeSuggestion = {
    file: string;
    lines: string;
    language: string;
    before: string;
    after: string;
    explanation: string;
  };
  let suggestions: CodeSuggestion[] = [];
  if (data.code_suggestions) {
    try {
      const raw = JSON.parse(data.code_suggestions);
      if (Array.isArray(raw)) suggestions = raw as CodeSuggestion[];
    } catch { /* ignore parse errors */ }
  }

  return (
    <div className="max-w-5xl mx-auto px-3 md:px-6 space-y-5">
      <div className="flex items-center justify-between mb-2">
        <button onClick={() => router.push("/analyze")} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-crimson transition-colors">
          <FiArrowLeft size={14} /> New analysis
        </button>
        <button onClick={handleDelete} className="text-xs text-muted-foreground hover:text-red-400 transition-colors inline-flex items-center gap-1">
          <FiTrash2 size={11} /> Delete
        </button>
      </div>

        {data.status === "error" && (
          <div className="px-4 py-3 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 text-sm flex items-center gap-2">
            <FiAlertCircle size={14} /> {data.error_message || "Analysis failed"}
          </div>
        )}

        {/* Header card */}
        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="bg-surface border border-border rounded-2xl p-6">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-[0.2em] text-crimson font-mono mb-2">
                Stage 3 · Analysis
              </p>
              <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
                {data.issue_title || data.repo_name || "Custom analysis"}
              </h2>
              {data.repo_name && (
                <a href={data.issue_url || data.repo_url || `https://github.com/${data.repo_name}`}
                   target="_blank" rel="noreferrer"
                   className="text-sm text-muted-foreground hover:text-crimson transition-colors mt-1 inline-block font-mono">
                  {data.repo_name}{data.issue_url ? ` · ${data.issue_url.split("/").slice(-2).join("/")}` : ""}
                </a>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {data.difficulty && (
                <Badge className={`text-[11px] border ${diffColor[data.difficulty] || "bg-muted text-muted-foreground border-border"}`}>
                  {data.difficulty.toUpperCase()}
                </Badge>
              )}
              {data.repo_language && (
                <Badge className="text-[11px] bg-muted text-muted-foreground border-border">
                  {data.repo_language}
                </Badge>
              )}
              {data.model_used && (
                <Badge className="text-[10px] bg-background text-muted-foreground border-border font-mono">
                  {data.model_used}
                </Badge>
              )}
            </div>
          </div>

          {data.summary && (
            <div className="mt-5">
              <Markdown>{data.summary}</Markdown>
            </div>
          )}

          {tech.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-5 pt-5 border-t border-border">
              {tech.map((t, i) => (
                <span key={i} className="text-[11px] px-2 py-1 rounded-md bg-crimson/10 text-crimson border border-crimson/20">
                  {t}
                </span>
              ))}
            </div>
          )}
        </motion.section>

        {/* Root cause + Files */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {data.root_cause && !["n/a", "na", "none", "not applicable"].includes(data.root_cause.trim().toLowerCase()) && (
            <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
              className="md:col-span-2 bg-surface border border-border rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-7 h-7 rounded-md bg-crimson/10 border border-crimson/20 text-crimson flex items-center justify-center">
                  <FiZap size={13} />
                </span>
                <h3 className="text-sm font-semibold">Root cause</h3>
              </div>
              <Markdown>{data.root_cause}</Markdown>
            </motion.section>
          )}

          {files.length > 0 && (
            <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="bg-surface border border-border rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-7 h-7 rounded-md bg-crimson/10 border border-crimson/20 text-crimson flex items-center justify-center">
                  <FiFileText size={13} />
                </span>
                <h3 className="text-sm font-semibold">Files involved</h3>
              </div>
              <ul className="space-y-1.5">
                {files.map((f, i) => (
                  <li key={i} className="text-[12.5px] font-mono text-muted-foreground bg-background border border-border rounded px-2 py-1 truncate">
                    {f}
                  </li>
                ))}
              </ul>
            </motion.section>
          )}
        </div>

        {/* Solution */}
        {data.solution_steps && (
          <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="bg-surface border border-border rounded-2xl overflow-hidden">
            <header className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-md bg-crimson/10 border border-crimson/20 text-crimson flex items-center justify-center">
                  <FiCode size={13} />
                </span>
                <div>
                  <h3 className="text-sm font-semibold">Step-by-step solution</h3>
                  <p className="text-[11px] text-muted-foreground">Stage 4 · Smart guidance</p>
                </div>
              </div>
              <button onClick={() => copy(data.solution_steps || "", "sol")}
                className="text-xs text-muted-foreground hover:text-crimson transition-colors inline-flex items-center gap-1">
                {copied === "sol" ? <FiCheck size={11} /> : <FiCopy size={11} />}
                {copied === "sol" ? "Copied" : "Copy"}
              </button>
            </header>
            <div className="p-6">
              <Markdown>{data.solution_steps}</Markdown>
            </div>
          </motion.section>
        )}

        {/* Code canvas — concrete code suggestions with file location + before/after */}
        {suggestions.length > 0 && (
          <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}
            className="bg-surface border border-border rounded-2xl overflow-hidden">
            <header className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-md bg-crimson/10 border border-crimson/20 text-crimson flex items-center justify-center">
                  <FiFile size={13} />
                </span>
                <div>
                  <h3 className="text-sm font-semibold">Code suggestions</h3>
                  <p className="text-[11px] text-muted-foreground">
                    {suggestions.length} concrete change{suggestions.length === 1 ? "" : "s"} · before vs after with file location
                  </p>
                </div>
              </div>
            </header>
            <div className="divide-y divide-border">
              {suggestions.map((s, i) => (
                <div key={i} className="px-6 py-5">
                  {/* File header */}
                  <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-mono text-crimson bg-crimson/10 border border-crimson/20 rounded px-1.5 py-0.5 shrink-0">
                          #{i + 1}
                        </span>
                        <code className="text-[13.5px] font-mono text-white font-medium break-all">
                          {s.file || "(file unknown)"}
                        </code>
                        {s.lines && (
                          <span className="text-[11px] font-mono text-muted-foreground bg-background border border-border rounded px-1.5 py-0.5">
                            L{s.lines}
                          </span>
                        )}
                        {s.language && (
                          <span className="text-[10.5px] uppercase tracking-wider text-muted-foreground bg-background border border-border rounded px-1.5 py-0.5">
                            {s.language}
                          </span>
                        )}
                      </div>
                      {s.explanation && (
                        <p className="text-[13px] text-white/75 mt-2 leading-relaxed">{s.explanation}</p>
                      )}
                    </div>
                  </div>

                  {/* Diff canvas */}
                  <div className="grid md:grid-cols-2 gap-3">
                    {/* Before */}
                    <div className="border border-red-500/25 bg-red-500/[0.04] rounded-lg overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-2 border-b border-red-500/20 bg-red-500/[0.06]">
                        <div className="flex items-center gap-1.5 text-[11px] font-mono text-red-300">
                          <FiMinus size={11} /> Before
                        </div>
                        {s.before && (
                          <button
                            onClick={() => copy(s.before, `before-${i}`)}
                            className="text-[11px] text-muted-foreground hover:text-red-300 transition-colors inline-flex items-center gap-1"
                          >
                            {copied === `before-${i}` ? <FiCheck size={10} /> : <FiCopy size={10} />}
                          </button>
                        )}
                      </div>
                      <pre className="p-3 text-[12.5px] font-mono text-white/90 overflow-x-auto leading-relaxed whitespace-pre">
{s.before || <span className="text-muted-foreground italic">(new file — no existing code)</span>}
                      </pre>
                    </div>

                    {/* After */}
                    <div className="border border-emerald-500/25 bg-emerald-500/[0.04] rounded-lg overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-2 border-b border-emerald-500/20 bg-emerald-500/[0.06]">
                        <div className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-300">
                          <FiPlus size={11} /> After
                        </div>
                        {s.after && (
                          <button
                            onClick={() => copy(s.after, `after-${i}`)}
                            className="text-[11px] text-muted-foreground hover:text-emerald-300 transition-colors inline-flex items-center gap-1"
                          >
                            {copied === `after-${i}` ? <FiCheck size={10} /> : <FiCopy size={10} />}
                          </button>
                        )}
                      </div>
                      <pre className="p-3 text-[12.5px] font-mono text-white/90 overflow-x-auto leading-relaxed whitespace-pre">
{s.after || <span className="text-muted-foreground italic">(deleted)</span>}
                      </pre>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.section>
        )}

        {/* Git commands */}
        {cmds.length > 0 && (
          <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="bg-surface border border-border rounded-2xl overflow-hidden">
            <header className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-md bg-crimson/10 border border-crimson/20 text-crimson flex items-center justify-center">
                  <FiTerminal size={13} />
                </span>
                <div>
                  <h3 className="text-sm font-semibold">Git commands</h3>
                  <p className="text-[11px] text-muted-foreground">Run these in your terminal, in order</p>
                </div>
              </div>
              <button onClick={() => copy(cmds.join("\n"), "cmd")}
                className="text-xs text-muted-foreground hover:text-crimson transition-colors inline-flex items-center gap-1">
                {copied === "cmd" ? <FiCheck size={11} /> : <FiCopy size={11} />}
                {copied === "cmd" ? "Copied" : "Copy all"}
              </button>
            </header>
            <ul className="divide-y divide-border">
              {cmds.map((c, i) => (
                <li key={i} className="px-6 py-3 flex items-center gap-3 group hover:bg-crimson/[0.03] transition-colors">
                  <span className="text-[11px] font-mono text-crimson w-5 shrink-0">{i + 1}</span>
                  <code className="text-[13px] font-mono text-white/90 flex-1">{c}</code>
                  <button onClick={() => copy(c, `cmd-${i}`)}
                    className="opacity-0 group-hover:opacity-100 text-xs text-muted-foreground hover:text-crimson transition-all">
                    {copied === `cmd-${i}` ? <FiCheck size={12} /> : <FiCopy size={12} />}
                  </button>
                </li>
              ))}
            </ul>
          </motion.section>
        )}

        {/* PR draft */}
        {(data.pr_title || data.pr_description) && (
          <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
            className="bg-surface border border-border rounded-2xl overflow-hidden">
            <header className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-md bg-crimson/10 border border-crimson/20 text-crimson flex items-center justify-center">
                  <FiGitPullRequest size={13} />
                </span>
                <div>
                  <h3 className="text-sm font-semibold">Pull request draft</h3>
                  <p className="text-[11px] text-muted-foreground">Stage 5 · Ready to paste into GitHub</p>
                </div>
              </div>
            </header>
            <div className="p-6 space-y-4">
              {data.pr_title && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11.5px] uppercase tracking-wider text-muted-foreground font-mono">Title</label>
                    <button onClick={() => copy(data.pr_title || "", "prt")}
                      className="text-xs text-muted-foreground hover:text-crimson transition-colors inline-flex items-center gap-1">
                      {copied === "prt" ? <FiCheck size={11} /> : <FiCopy size={11} />}
                    </button>
                  </div>
                  <p className="text-sm font-mono bg-background border border-border rounded-md px-3 py-2">
                    {data.pr_title}
                  </p>
                </div>
              )}
              {data.pr_description && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11.5px] uppercase tracking-wider text-muted-foreground font-mono">Description</label>
                    <button onClick={() => copy(data.pr_description || "", "prd")}
                      className="text-xs text-muted-foreground hover:text-crimson transition-colors inline-flex items-center gap-1">
                      {copied === "prd" ? <FiCheck size={11} /> : <FiCopy size={11} />}
                    </button>
                  </div>
                  <div className="bg-background border border-border rounded-md px-4 py-3">
                    <Markdown>{data.pr_description}</Markdown>
                  </div>
                </div>
              )}
            </div>
          </motion.section>
        )}
        <AssistantPanel
          analysisId={data.id}
          contextLabel={data.repo_name || data.issue_title || undefined}
        />
    </div>
  );
}
