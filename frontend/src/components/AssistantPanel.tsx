"use client";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiMessageCircle, FiX, FiSend, FiLoader, FiZap, FiCpu, FiUser, FiAlertCircle,
} from "react-icons/fi";
import { api } from "@/lib/api";
import { Markdown } from "@/components/Markdown";

interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

interface AssistantPanelProps {
  analysisId: number;
  /** A short label shown in the panel header to remind users what's grounding the AI. */
  contextLabel?: string;
}

const STARTERS = [
  "Walk me through the first code suggestion",
  "Why is this the root cause?",
  "Help me set up this repo locally",
  "Explain step 1 like I'm new",
];

export function AssistantPanel({ analysisId, contextLabel }: AssistantPanelProps) {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // Pull token once
  useEffect(() => {
    setToken(localStorage.getItem("token"));
  }, []);

  // Lazy-load history first time the panel opens
  useEffect(() => {
    if (!open || !token || messages.length > 0 || loadingHistory) return;
    setLoadingHistory(true);
    api.listChatMessages(analysisId, token)
      .then((m: ChatMessage[]) => setMessages(m || []))
      .catch(() => { /* silent — empty history is fine */ })
      .finally(() => setLoadingHistory(false));
  }, [open, token, analysisId, messages.length, loadingHistory]);

  // Auto-scroll to bottom on new messages / when opening
  useEffect(() => {
    if (!open) return;
    const el = scrollerRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [open, messages.length, sending]);

  // Auto-resize textarea
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, [input]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function send(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || sending || !token) return;
    setError(null);
    setSending(true);
    // Optimistic user bubble
    const tempId = -Date.now();
    setMessages((prev) => [
      ...prev,
      { id: tempId, role: "user", content: msg, created_at: new Date().toISOString() },
    ]);
    setInput("");
    try {
      const res = await api.sendChatMessage(analysisId, msg, token);
      setMessages((prev) => {
        // replace optimistic temp with confirmed user msg + append assistant
        const without = prev.filter((m) => m.id !== tempId);
        return [...without, res.user_message, res.assistant_message];
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't reach the AI assistant");
      // remove optimistic msg
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      // restore the user's text so they can retry
      setInput(msg);
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <>
      {/* Floating launcher (visible when panel is closed) */}
      <AnimatePresence>
        {!open && (
          <motion.button
            key="launcher"
            initial={{ opacity: 0, scale: 0.85, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 12 }}
            transition={{ type: "spring", stiffness: 320, damping: 24 }}
            onClick={() => setOpen(true)}
            className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 h-12 pl-4 pr-5 rounded-full bg-crimson text-white shadow-[0_10px_30px_-8px_rgba(217,119,87,0.6)] hover:shadow-[0_12px_36px_-6px_rgba(217,119,87,0.7)] hover:bg-crimson-dark transition-all glow-crimson"
            aria-label="Open AI assistant"
          >
            <span className="relative w-7 h-7 rounded-full bg-white/15 flex items-center justify-center">
              <FiMessageCircle size={14} />
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-crimson" />
            </span>
            <span className="text-[13.5px] font-semibold tracking-tight">Ask AI mate</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Slide-in panel */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop only on mobile to avoid covering the analysis content on desktop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setOpen(false)}
              className="md:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            />

            <motion.aside
              key="panel"
              initial={{ x: "100%", opacity: 0.6 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "100%", opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              className="fixed top-0 right-0 bottom-0 z-50 w-full sm:w-[420px] md:w-[460px] flex flex-col bg-background border-l border-border shadow-[-20px_0_60px_-20px_rgba(0,0,0,0.6)]"
              role="dialog"
              aria-label="AI assistant"
            >
              {/* Header */}
              <header className="shrink-0 flex items-center justify-between gap-3 px-5 h-14 border-b border-border bg-surface/40 backdrop-blur-xl">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-8 h-8 rounded-lg bg-crimson/15 border border-crimson/30 text-crimson flex items-center justify-center shrink-0">
                    <FiCpu size={14} />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-[14px] font-semibold tracking-tight text-white truncate">AI mate</h3>
                    <p className="text-[11px] text-muted-foreground truncate">
                      Grounded in this analysis{contextLabel ? ` · ${contextLabel}` : ""}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="w-8 h-8 rounded-lg border border-border bg-background/40 text-muted-foreground hover:text-white hover:border-crimson/40 flex items-center justify-center transition-colors"
                  aria-label="Close assistant"
                >
                  <FiX size={14} />
                </button>
              </header>

              {/* Messages */}
              <div ref={scrollerRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3.5">
                {loadingHistory && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                    <FiLoader className="animate-spin text-crimson" size={12} /> Loading history…
                  </div>
                )}

                {!loadingHistory && messages.length === 0 && (
                  <EmptyState onPick={(p) => send(p)} />
                )}

                {messages.map((m) => (
                  <Bubble key={m.id} role={m.role} content={m.content} />
                ))}

                {sending && <TypingBubble />}
              </div>

              {/* Error banner */}
              {error && (
                <div className="shrink-0 mx-4 mb-2 px-3 py-2 rounded-lg border border-red-500/30 bg-red-500/10 text-red-200 text-[12px] flex items-center gap-2">
                  <FiAlertCircle size={12} /> {error}
                </div>
              )}

              {/* Input */}
              <div className="shrink-0 border-t border-border bg-surface/30 backdrop-blur-xl px-3 py-3">
                <div className="flex items-end gap-2 bg-background border border-border rounded-xl pl-3 pr-1.5 py-1.5 focus-within:border-crimson/50 focus-within:ring-2 focus-within:ring-crimson/15 transition-all">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder="Ask anything about this analysis…"
                    rows={1}
                    className="flex-1 resize-none bg-transparent text-[13.5px] text-white placeholder:text-white/40 focus:outline-none py-1.5 leading-relaxed max-h-40"
                    disabled={sending}
                  />
                  <button
                    onClick={() => send()}
                    disabled={!input.trim() || sending}
                    className="self-end inline-flex items-center justify-center w-9 h-9 rounded-lg bg-crimson hover:bg-crimson-dark disabled:bg-muted disabled:text-white/40 disabled:cursor-not-allowed text-white transition-all"
                    aria-label="Send message"
                  >
                    {sending ? <FiLoader className="animate-spin" size={14} /> : <FiSend size={14} />}
                  </button>
                </div>
                <p className="text-[10.5px] text-muted-foreground mt-1.5 px-1">
                  <kbd className="font-mono">Enter</kbd> to send · <kbd className="font-mono">Shift+Enter</kbd> for newline · <kbd className="font-mono">Esc</kbd> to close
                </p>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

/* ---------------- internals ---------------- */

function Bubble({ role, content }: { role: "user" | "assistant"; content: string }) {
  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-xl bg-crimson/15 border border-crimson/25 px-3.5 py-2.5">
          <p className="text-[13.5px] text-white whitespace-pre-wrap leading-relaxed">{content}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2.5">
      <span className="w-7 h-7 rounded-lg bg-crimson/10 border border-crimson/25 text-crimson flex items-center justify-center shrink-0 mt-0.5">
        <FiCpu size={12} />
      </span>
      <div className="max-w-[88%] rounded-xl bg-surface border border-border px-3.5 py-2.5 text-[13.5px] text-white/90 leading-relaxed min-w-0">
        <Markdown>{content}</Markdown>
      </div>
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="flex items-start gap-2.5">
      <span className="w-7 h-7 rounded-lg bg-crimson/10 border border-crimson/25 text-crimson flex items-center justify-center shrink-0 mt-0.5">
        <FiCpu size={12} />
      </span>
      <div className="rounded-xl bg-surface border border-border px-3.5 py-2.5">
        <div className="flex items-center gap-1.5 h-4">
          <span className="w-1.5 h-1.5 rounded-full bg-crimson animate-bounce [animation-delay:-0.3s]" />
          <span className="w-1.5 h-1.5 rounded-full bg-crimson animate-bounce [animation-delay:-0.15s]" />
          <span className="w-1.5 h-1.5 rounded-full bg-crimson animate-bounce" />
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (s: string) => void }) {
  return (
    <div className="pt-3">
      <div className="flex items-center gap-2.5 mb-3">
        <span className="w-9 h-9 rounded-xl bg-crimson/10 border border-crimson/25 text-crimson flex items-center justify-center">
          <FiZap size={15} />
        </span>
        <div>
          <p className="text-[13.5px] font-semibold text-white">Stuck on something?</p>
          <p className="text-[12px] text-muted-foreground">Ask anything — I&apos;ve read the whole analysis.</p>
        </div>
      </div>
      <div className="space-y-1.5">
        {STARTERS.map((s) => (
          <button
            key={s}
            onClick={() => onPick(s)}
            className="w-full text-left px-3.5 py-2.5 rounded-lg border border-border bg-surface hover:border-crimson/40 hover:bg-crimson/[0.05] text-[13px] text-white/85 hover:text-white transition-all"
          >
            <FiUser size={11} className="inline -mt-0.5 mr-1.5 text-muted-foreground" />
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
