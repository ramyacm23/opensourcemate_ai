"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { FiLoader, FiZap, FiInbox, FiClock } from "react-icons/fi";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";

interface Item {
  id: number;
  issue_url?: string | null;
  repo_name?: string | null;
  summary?: string | null;
  difficulty?: string | null;
  status: string;
  created_at: string;
}

const diffColor: Record<string, string> = {
  easy: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  medium: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  hard: "bg-red-500/15 text-red-300 border-red-500/30",
};

export default function HistoryPage() {
  const router = useRouter();
  const [items, setItems] = useState<Item[] | null>(null);

  useEffect(() => {
    const t = localStorage.getItem("token");
    if (!t) { router.push("/login"); return; }
    api.listAnalyses(t).then(setItems).catch(() => setItems([]));
  }, [router]);

  return (
    <div className="max-w-4xl mx-auto px-3 md:px-6">
      <div className="flex items-center justify-end mb-3">
        <button onClick={() => router.push("/analyze")} className="text-xs text-crimson hover:text-crimson-dark inline-flex items-center gap-1">
          <FiZap size={11} /> New
        </button>
      </div>

        {items === null ? (
          <div className="text-center py-20">
            <FiLoader className="animate-spin text-crimson mx-auto" size={24} />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-crimson/10 border border-crimson/20 flex items-center justify-center text-crimson mb-4">
              <FiInbox size={22} />
            </div>
            <h2 className="text-lg font-semibold">No analyses yet</h2>
            <p className="text-sm text-muted-foreground mt-1.5">Run your first analysis to see it here.</p>
            <button onClick={() => router.push("/analyze")} className="mt-5 inline-flex items-center gap-1.5 bg-crimson hover:bg-crimson-dark text-white text-sm px-4 h-9 rounded-lg font-medium transition-all">
              <FiZap size={14} /> Start now
            </button>
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((it, i) => (
              <motion.li
                key={it.id}
                initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
              >
                <button
                  onClick={() => router.push(`/analyze/${it.id}`)}
                  className="w-full text-left bg-surface border border-border hover:border-crimson/40 hover:bg-crimson/[0.03] rounded-2xl p-5 transition-all"
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white truncate font-medium">
                        {it.repo_name || it.issue_url || `Analysis #${it.id}`}
                      </p>
                      {it.summary && (
                        <p className="text-[12.5px] text-muted-foreground mt-1 line-clamp-2">{it.summary}</p>
                      )}
                      <p className="text-[10.5px] text-muted-foreground mt-2 inline-flex items-center gap-1 font-mono">
                        <FiClock size={10} />
                        {new Date(it.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      {it.difficulty && (
                        <Badge className={`text-[10px] border ${diffColor[it.difficulty] || "bg-muted text-muted-foreground border-border"}`}>
                          {it.difficulty.toUpperCase()}
                        </Badge>
                      )}
                      {it.status === "error" && (
                        <Badge className="text-[10px] bg-red-500/15 text-red-300 border-red-500/30">FAILED</Badge>
                      )}
                    </div>
                  </div>
                </button>
              </motion.li>
            ))}
          </ul>
        )}
    </div>
  );
}
