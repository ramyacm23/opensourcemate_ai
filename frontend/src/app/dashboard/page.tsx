"use client";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  FiCode, FiZap, FiLogOut, FiUser, FiGlobe, FiLinkedin,
  FiSearch, FiTrendingUp, FiGitPullRequest, FiActivity,
  FiArrowRight, FiBell, FiCpu, FiTerminal, FiCheckCircle,
  FiInbox, FiShield, FiPhone, FiMail, FiAward, FiPlus,
  FiGithub, FiStar, FiGitBranch, FiAlertCircle, FiRefreshCw, FiLink,
} from "react-icons/fi";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { api, resolveAvatar } from "@/lib/api";

interface User {
  id: number; email: string; name: string; mobile: string;
  user_type: string; website: string; linkedin: string; onboarding_completed: boolean;
  avatar_url?: string | null;
  github_username?: string | null;
  github_avatar_url?: string | null;
}

interface GHRepo {
  id: number; name: string; full_name: string; html_url: string;
  description: string | null; language: string | null;
  stargazers_count: number; forks_count: number; open_issues_count: number;
  private: boolean; fork: boolean; updated_at: string;
}

const typeColor: Record<string, string> = {
  Freelancer:  "bg-sky-500/10 text-sky-300 border-sky-500/30",
  Student:     "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  Enterprise:  "bg-violet-500/10 text-violet-300 border-violet-500/30",
};

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [query, setQuery] = useState("");
  const [repos, setRepos] = useState<GHRepo[] | null>(null);
  const [reposError, setReposError] = useState<string | null>(null);
  const [reposLoading, setReposLoading] = useState(false);

  useEffect(() => {
    // Handle GitHub OAuth fragment-token for first-time signup landing here
    if (typeof window !== "undefined" && window.location.hash.includes("token=")) {
      const params = new URLSearchParams(window.location.hash.slice(1));
      const t = params.get("token");
      if (t) {
        localStorage.setItem("token", t);
        history.replaceState(null, "", window.location.pathname + window.location.search);
      }
    }
    const token = localStorage.getItem("token");
    if (!token) { router.push("/login"); return; }
    api.dashboard(token)
      .then(setUser)
      .catch(() => router.push("/login"));
  }, [router]);

  // Whenever the user is loaded with GitHub connected, pull their repos
  useEffect(() => {
    if (!user?.github_username) return;
    const token = localStorage.getItem("token");
    if (!token) return;
    setReposLoading(true);
    setReposError(null);
    api.githubRepos(token)
      .then((r: GHRepo[]) => setRepos(r))
      .catch((e: Error) => setReposError(e.message || "Failed to fetch repos"))
      .finally(() => setReposLoading(false));
  }, [user?.github_username]);

  function connectGithub() {
    const token = localStorage.getItem("token");
    if (!token) return;
    window.location.href = api.githubConnectUrl(token);
  }

  async function disconnectGithub() {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      await api.githubDisconnect(token);
      const fresh = await api.dashboard(token);
      setUser(fresh);
      setRepos(null);
    } catch {}
  }

  function logout() {
    localStorage.removeItem("token");
    router.push("/");
  }

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  const profileCompletion = useMemo(() => {
    if (!user) return 0;
    const fields = [user.name, user.email, user.mobile, user.user_type, user.website, user.linkedin];
    const filled = fields.filter(f => f && f.trim() !== "").length;
    return Math.round((filled / fields.length) * 100);
  }, [user]);

  const linksCount = useMemo(() => {
    if (!user) return 0;
    return [user.website, user.linkedin, user.github_username].filter(v => v && v.trim() !== "").length;
  }, [user]);

  if (!user) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex items-center gap-3 text-muted-foreground text-sm">
        <span className="w-5 h-5 border-2 border-crimson border-t-transparent rounded-full animate-spin" />
        Loading your workspace…
      </div>
    </div>
  );

  const firstName = user.name?.split(" ")[0] || "there";
  const initial = (user.name || user.email)[0]?.toUpperCase();

  // Real account events from what we know about this user
  const accountEvents = [
    { icon: <FiUser />,        color: "text-sky-400",     text: "Account created" },
    user.onboarding_completed && { icon: <FiCheckCircle />, color: "text-emerald-400", text: "Onboarding completed" },
    user.github_username && { icon: <FiGithub />,  color: "text-white",      text: `Linked GitHub @${user.github_username}` },
    user.website  && { icon: <FiGlobe />,    color: "text-crimson",     text: "Linked website" },
    user.linkedin && { icon: <FiLinkedin />, color: "text-sky-400",     text: "Linked LinkedIn" },
  ].filter(Boolean) as { icon: React.ReactNode; color: string; text: string }[];

  return (
    <div className="min-h-screen bg-background relative">
      <div className="fixed inset-0 grid-bg opacity-60 pointer-events-none" />
      <div className="fixed top-[-200px] left-1/2 -translate-x-1/2 w-[1100px] h-[500px] bg-crimson/8 rounded-full blur-[120px] pointer-events-none" />

      <nav className="sticky top-0 z-30 backdrop-blur-md bg-background/70 border-b border-border">
        <div className="max-w-7xl mx-auto px-6 pl-20 md:pl-24 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-md bg-crimson/15 border border-crimson/30 flex items-center justify-center text-crimson">
              <FiCode size={14} />
            </span>
            <span className="text-white text-[15px] font-semibold tracking-tight hidden sm:inline">
              OpenSource<span className="text-crimson">Mate</span>
            </span>
          </div>

          <div className="relative flex-1 max-w-lg">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search your workspace…"
              className="w-full bg-surface border border-border rounded-lg pl-9 pr-3 h-9 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-crimson/50 focus:ring-2 focus:ring-crimson/15 transition-all"
            />
            <kbd className="hidden md:inline absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono text-muted-foreground bg-background border border-border rounded px-1.5 py-0.5">⌘K</kbd>
          </div>

          <div className="flex items-center gap-1.5">
            <button className="w-9 h-9 rounded-lg border border-border bg-surface text-muted-foreground hover:text-white hover:border-crimson/40 transition-all flex items-center justify-center relative">
              <FiBell size={15} />
            </button>
            <div className="hidden sm:flex items-center gap-2 pl-2 ml-1 border-l border-border">
              <button
                onClick={() => router.push("/profile")}
                title="View profile"
                className="flex items-center gap-2 hover:opacity-80 transition-opacity"
              >
                {(() => {
                  const src = resolveAvatar(user.avatar_url) || user.github_avatar_url;
                  return src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={src} alt={user.name || user.email}
                      className="w-8 h-8 rounded-full object-cover border border-crimson/30" />
                  ) : (
                    <span className="w-8 h-8 rounded-full bg-crimson/15 border border-crimson/30 text-crimson flex items-center justify-center text-sm font-semibold">
                      {initial}
                    </span>
                  );
                })()}
                <div className="leading-tight text-left">
                  <p className="text-xs font-medium text-white max-w-[140px] truncate">{user.name || "Contributor"}</p>
                  <p className="text-[10.5px] text-muted-foreground max-w-[140px] truncate">{user.email}</p>
                </div>
              </button>
            </div>
            <button onClick={logout} title="Sign out" className="w-9 h-9 rounded-lg border border-border bg-surface text-muted-foreground hover:text-red-400 hover:border-red-400/40 transition-all flex items-center justify-center">
              <FiLogOut size={15} />
            </button>
          </div>
        </div>
      </nav>

      <main className="relative z-10 max-w-7xl mx-auto px-6 pl-20 md:pl-24 pb-24 md:pb-10 py-8 md:py-10">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="flex items-start justify-between gap-4 mb-8 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-crimson font-mono mb-2">{greeting}</p>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
              Welcome back, <span className="text-crimson">{firstName}</span>
            </h1>
            <p className="text-muted-foreground mt-1.5 text-sm md:text-base">
              Your workspace is ready. Let&apos;s ship something open.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={`text-[11px] border ${typeColor[user.user_type] || "bg-muted text-muted-foreground border-border"}`}>
              {user.user_type || "Member"}
            </Badge>
            <button
              onClick={() => router.push("/analyze")}
              className="inline-flex items-center gap-1.5 bg-crimson hover:bg-crimson-dark text-white text-sm px-4 h-9 rounded-lg font-medium transition-all glow-crimson"
            >
              <FiZap size={14} /> Analyze with AI
            </button>
          </div>
        </motion.div>

        {/* Stats — derived from real user record */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-8">
          {[
            {
              icon: <FiAward size={16} />, label: "Profile completion",
              value: `${profileCompletion}%`,
              trend: profileCompletion === 100 ? "complete" : "in progress",
            },
            {
              icon: <FiShield size={16} />, label: "Account status",
              value: user.onboarding_completed ? "Active" : "Pending",
              trend: user.onboarding_completed ? "verified" : "onboarding",
            },
            {
              icon: <FiGlobe size={16} />, label: "Linked profiles",
              value: String(linksCount),
              trend: `of 3`,
            },
            {
              icon: <FiUser size={16} />, label: "Member ID",
              value: `#${user.id}`,
              trend: user.user_type || "member",
            },
          ].map((s, i) => (
            <motion.div key={s.label}
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i + 0.15 }}
              className="bg-surface border border-border rounded-xl p-4 hover:border-crimson/30 transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="w-8 h-8 rounded-lg bg-crimson/10 border border-crimson/20 flex items-center justify-center text-crimson">
                  {s.icon}
                </span>
                <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">{s.trend}</span>
              </div>
              <p className="text-2xl md:text-3xl font-semibold tracking-tight">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5">
          {/* LEFT: GitHub repos OR Connect-GitHub CTA */}
          <motion.section
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="lg:col-span-2 bg-surface border border-border rounded-2xl overflow-hidden"
          >
            <header className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-lg bg-crimson/10 border border-crimson/20 flex items-center justify-center text-crimson">
                  <FiGithub size={15} />
                </span>
                <div>
                  <h2 className="font-semibold text-sm">
                    {user.github_username ? "Your GitHub repositories" : "Connect GitHub"}
                  </h2>
                  <p className="text-[11.5px] text-muted-foreground">
                    {user.github_username
                      ? <>Live from <span className="font-mono text-crimson">@{user.github_username}</span></>
                      : "Link your GitHub to import repos and track contributions"}
                  </p>
                </div>
              </div>
              {user.github_username ? (
                <button
                  onClick={() => {
                    const token = localStorage.getItem("token");
                    if (!token) return;
                    setReposLoading(true);
                    api.githubRepos(token)
                      .then((r: GHRepo[]) => { setRepos(r); setReposError(null); })
                      .catch((e: Error) => setReposError(e.message))
                      .finally(() => setReposLoading(false));
                  }}
                  className="text-xs text-muted-foreground hover:text-crimson transition-colors flex items-center gap-1"
                >
                  <FiRefreshCw size={11} className={reposLoading ? "animate-spin" : ""} /> Refresh
                </button>
              ) : null}
            </header>

            {!user.github_username ? (
              <div className="px-5 py-16 text-center">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-crimson/10 border border-crimson/20 flex items-center justify-center text-crimson mb-4">
                  <FiGithub size={22} />
                </div>
                <h3 className="text-base font-semibold text-white">Connect your GitHub</h3>
                <p className="text-[13px] text-muted-foreground mt-1.5 max-w-sm mx-auto">
                  We&apos;ll fetch your repos, suggest matching issues for your stack, and help you track contributions automatically.
                </p>
                <button
                  onClick={connectGithub}
                  className="mt-5 inline-flex items-center gap-2 bg-white text-slate-900 hover:bg-slate-100 text-sm px-4 h-9 rounded-lg font-medium transition-all"
                >
                  <FiGithub size={14} /> Connect with GitHub
                </button>
              </div>
            ) : reposLoading && !repos ? (
              <ul className="divide-y divide-border">
                {[0,1,2,3].map(i => (
                  <li key={i} className="px-5 py-4 animate-pulse flex gap-3">
                    <div className="w-9 h-9 rounded-lg bg-border" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 bg-border rounded w-1/3" />
                      <div className="h-2.5 bg-border rounded w-2/3" />
                    </div>
                  </li>
                ))}
              </ul>
            ) : reposError ? (
              <div className="px-5 py-12 text-center">
                <FiAlertCircle className="mx-auto text-crimson mb-2" size={20} />
                <p className="text-sm text-white">{reposError}</p>
                <button onClick={connectGithub} className="mt-3 text-xs inline-flex items-center gap-1.5 px-3 h-8 rounded-md border border-border hover:border-crimson/40 hover:text-crimson transition-all">
                  <FiLink size={11} /> Reconnect GitHub
                </button>
              </div>
            ) : repos && repos.length === 0 ? (
              <div className="px-5 py-16 text-center text-[13px] text-muted-foreground">No repos found on your GitHub yet.</div>
            ) : (
              <ul className="divide-y divide-border">
                {(repos || [])
                  .filter(r => !query.trim() ||
                    r.full_name.toLowerCase().includes(query.toLowerCase()) ||
                    (r.description || "").toLowerCase().includes(query.toLowerCase()) ||
                    (r.language || "").toLowerCase().includes(query.toLowerCase()))
                  .map((r, i) => (
                    <motion.li
                      key={r.id}
                      initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.04 * i + 0.35 }}
                      className="group hover:bg-crimson/[0.03] transition-colors"
                    >
                      <a href={r.html_url} target="_blank" rel="noreferrer" className="block px-5 py-4">
                        <div className="flex items-start gap-3">
                          <span className="mt-0.5 w-9 h-9 rounded-lg bg-background border border-border flex items-center justify-center text-crimson text-base shrink-0">
                            {r.fork ? <FiGitBranch /> : <FiCode />}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <h3 className="text-sm text-white group-hover:text-crimson transition-colors font-medium truncate">
                                {r.full_name}
                              </h3>
                              {r.private && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">Private</span>}
                              {r.fork && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">Fork</span>}
                            </div>
                            {r.description && (
                              <p className="text-[12.5px] text-muted-foreground leading-snug line-clamp-2">{r.description}</p>
                            )}
                            <div className="flex flex-wrap items-center gap-3 mt-2 text-[11.5px] text-muted-foreground">
                              {r.language && (
                                <span className="inline-flex items-center gap-1">
                                  <span className="w-2 h-2 rounded-full bg-crimson" /> {r.language}
                                </span>
                              )}
                              <span className="inline-flex items-center gap-1"><FiStar size={10} /> {r.stargazers_count}</span>
                              <span className="inline-flex items-center gap-1"><FiGitBranch size={10} /> {r.forks_count}</span>
                              <span className="inline-flex items-center gap-1"><FiAlertCircle size={10} /> {r.open_issues_count} open</span>
                            </div>
                          </div>
                          <FiArrowRight className="text-muted-foreground group-hover:text-crimson transition-colors mt-1 shrink-0" size={14} />
                        </div>
                      </a>
                    </motion.li>
                  ))}
              </ul>
            )}
          </motion.section>

          {/* RIGHT */}
          <div className="space-y-4 md:space-y-5">
            {/* Profile — fully real */}
            <motion.section
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
              className="bg-surface border border-border rounded-2xl p-5"
            >
              <div className="flex items-center gap-3 mb-4">
                <span className="w-12 h-12 rounded-full bg-crimson/15 border border-crimson/30 text-crimson flex items-center justify-center text-lg font-semibold">
                  {initial}
                </span>
                <div className="min-w-0">
                  <p className="font-semibold truncate">{user.name || "Contributor"}</p>
                  <p className="text-[11.5px] text-muted-foreground truncate">{user.email}</p>
                </div>
              </div>

              <div className="space-y-2.5 text-[12.5px]">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground inline-flex items-center gap-1.5"><FiMail size={11} /> Email</span>
                  <span className="text-white truncate ml-3 max-w-[180px]">{user.email}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground inline-flex items-center gap-1.5"><FiPhone size={11} /> Mobile</span>
                  <span className="text-white truncate ml-3">{user.mobile || "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground inline-flex items-center gap-1.5"><FiUser size={11} /> Type</span>
                  <span className="text-white truncate ml-3">{user.user_type || "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground inline-flex items-center gap-1.5"><FiShield size={11} /> Status</span>
                  <span className={user.onboarding_completed ? "text-emerald-400" : "text-amber-400"}>
                    {user.onboarding_completed ? "Onboarded" : "Pending"}
                  </span>
                </div>
              </div>

              {(user.website || user.linkedin || user.github_username) && (
                <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border">
                  {user.github_username && (
                    <a href={`https://github.com/${user.github_username}`} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-border hover:border-crimson/40 hover:text-crimson transition-all">
                      <FiGithub size={12} /> @{user.github_username}
                    </a>
                  )}
                  {user.website && (
                    <a href={user.website} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-border hover:border-crimson/40 hover:text-crimson transition-all">
                      <FiGlobe size={12} /> Website
                    </a>
                  )}
                  {user.linkedin && (
                    <a href={user.linkedin} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-border hover:border-crimson/40 hover:text-crimson transition-all">
                      <FiLinkedin size={12} /> LinkedIn
                    </a>
                  )}
                </div>
              )}

              {!user.github_username ? (
                <button onClick={connectGithub} className="w-full mt-3 text-xs bg-white text-slate-900 hover:bg-slate-100 transition-colors inline-flex items-center justify-center gap-1.5 rounded-md py-2 font-medium">
                  <FiGithub size={12} /> Connect GitHub
                </button>
              ) : (
                <button onClick={disconnectGithub} className="w-full mt-3 text-xs text-muted-foreground hover:text-red-400 transition-colors inline-flex items-center justify-center gap-1.5 border border-border hover:border-red-400/40 rounded-md py-2">
                  <FiGithub size={12} /> Disconnect GitHub
                </button>
              )}

              <button
                onClick={() => router.push("/profile")}
                className="w-full mt-4 text-xs text-muted-foreground hover:text-crimson transition-colors inline-flex items-center justify-center gap-1.5 border border-border hover:border-crimson/40 rounded-md py-2"
              >
                <FiUser size={12} /> Edit profile
              </button>
            </motion.section>

            {/* Activity — real account milestones only */}
            <motion.section
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
              className="bg-surface border border-border rounded-2xl p-5"
            >
              <div className="flex items-center gap-2.5 mb-4">
                <span className="w-8 h-8 rounded-lg bg-crimson/10 border border-crimson/20 flex items-center justify-center text-crimson">
                  <FiActivity size={15} />
                </span>
                <div>
                  <h2 className="font-semibold text-sm">Account milestones</h2>
                  <p className="text-[11.5px] text-muted-foreground">{accountEvents.length} completed</p>
                </div>
              </div>
              <ul className="space-y-3">
                {accountEvents.map((a, i) => (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.06 * i + 0.45 }}
                    className="flex items-start gap-3 text-[12.5px]"
                  >
                    <span className={`mt-0.5 ${a.color}`}>{a.icon}</span>
                    <p className="text-white leading-snug">{a.text}</p>
                  </motion.li>
                ))}
              </ul>
            </motion.section>

            {/* AI tip — driven by real profile state */}
            <motion.section
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
              className="relative overflow-hidden rounded-2xl border border-crimson/30 bg-gradient-to-br from-crimson/15 via-surface to-surface p-5"
            >
              <div className="absolute -top-12 -right-12 w-40 h-40 bg-crimson/20 rounded-full blur-3xl pointer-events-none" />
              <div className="relative">
                <div className="inline-flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.18em] text-crimson font-mono mb-3">
                  <FiCpu size={11} /> AI tip
                </div>
                <p className="text-sm leading-relaxed text-white/90">
                  {profileCompletion < 100 ? (
                    <>
                      Your profile is{" "}
                      <span className="text-crimson font-semibold">{profileCompletion}%</span> complete.
                      Add the missing fields so we can match you to better issues.
                    </>
                  ) : (
                    <>Profile is complete. Track your first issue to start building your contribution history.</>
                  )}
                </p>
                <button className="mt-4 inline-flex items-center gap-1.5 text-xs bg-crimson hover:bg-crimson-dark text-white px-3 h-8 rounded-md font-medium transition-all">
                  <FiTerminal size={12} /> {profileCompletion < 100 ? "Complete profile" : "Open guided session"}
                </button>
              </div>
            </motion.section>
          </div>
        </div>
      </main>
    </div>
  );
}
