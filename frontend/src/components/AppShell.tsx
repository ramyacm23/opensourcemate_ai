"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  FiCode, FiSearch, FiBell, FiLogOut, FiHome, FiZap, FiClock, FiUser,
} from "react-icons/fi";
import { api, resolveAvatar } from "@/lib/api";

interface ShellUser {
  id: number;
  email: string;
  name: string;
  avatar_url?: string | null;
  github_avatar_url?: string | null;
}

interface AppShellProps {
  children: React.ReactNode;
  /** "narrow" = max-w-4xl (forms), "wide" = max-w-7xl (dashboards) */
  width?: "narrow" | "wide";
}

const NAV_ITEMS = [
  { href: "/dashboard",       label: "Dashboard", icon: FiHome },
  { href: "/analyze",         label: "Analyze",   icon: FiZap  },
  { href: "/analyze/history", label: "History",   icon: FiClock },
  { href: "/profile",         label: "Profile",   icon: FiUser },
];

export default function AppShell({ children, width = "wide" }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<ShellUser | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { router.push("/login"); return; }
    api.dashboard(token)
      .then((u: ShellUser) => setUser(u))
      .catch(() => router.push("/login"));
  }, [router]);

  function logout() {
    localStorage.removeItem("token");
    router.push("/");
  }

  const containerCls = width === "narrow" ? "max-w-4xl" : "max-w-7xl";

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground text-sm">
          <span className="w-5 h-5 border-2 border-crimson border-t-transparent rounded-full animate-spin" />
          Loading…
        </div>
      </div>
    );
  }

  const initial = (user.name || user.email)[0]?.toUpperCase();
  const avatarSrc = resolveAvatar(user.avatar_url) || user.github_avatar_url;

  return (
    <div className="min-h-screen bg-background relative">
      <div className="fixed inset-0 grid-bg opacity-60 pointer-events-none" />
      <div className="fixed top-[-200px] left-1/2 -translate-x-1/2 w-[1100px] h-[500px] bg-crimson/8 rounded-full blur-[120px] pointer-events-none" />

      <nav className="sticky top-0 z-30 backdrop-blur-md bg-background/70 border-b border-border">
        <div className={`${containerCls} mx-auto px-6 py-3.5 flex items-center justify-between gap-4`}>
          <button
            onClick={() => router.push("/dashboard")}
            className="flex items-center gap-2.5 hover:opacity-80 transition"
          >
            <span className="w-7 h-7 rounded-md bg-crimson/15 border border-crimson/30 flex items-center justify-center text-crimson">
              <FiCode size={14} />
            </span>
            <span className="text-white text-[15px] font-semibold tracking-tight hidden sm:inline">
              OpenSource<span className="text-crimson">Mate</span>
            </span>
          </button>

          {/* Tabs */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(item.href));
              const Icon = item.icon;
              return (
                <button
                  key={item.href}
                  onClick={() => router.push(item.href)}
                  className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-medium transition-all ${
                    active
                      ? "bg-crimson/15 border border-crimson/30 text-crimson"
                      : "text-muted-foreground hover:text-white hover:bg-surface border border-transparent"
                  }`}
                >
                  <Icon size={13} />
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="relative flex-1 max-w-xs hidden lg:block">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="w-full bg-surface border border-border rounded-lg pl-9 pr-3 h-9 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-crimson/50 focus:ring-2 focus:ring-crimson/15 transition-all"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <button className="w-9 h-9 rounded-lg border border-border bg-surface text-muted-foreground hover:text-white hover:border-crimson/40 transition-all flex items-center justify-center">
              <FiBell size={15} />
            </button>
            <div className="hidden sm:flex items-center gap-2 pl-2 ml-1 border-l border-border">
              <button
                onClick={() => router.push("/profile")}
                title="View profile"
                className="flex items-center gap-2 hover:opacity-80 transition-opacity"
              >
                {avatarSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarSrc}
                    alt={user.name || user.email}
                    className="w-8 h-8 rounded-full object-cover border border-crimson/30"
                  />
                ) : (
                  <span className="w-8 h-8 rounded-full bg-crimson/15 border border-crimson/30 text-crimson flex items-center justify-center text-sm font-semibold">
                    {initial}
                  </span>
                )}
                <div className="leading-tight text-left">
                  <p className="text-xs font-medium text-white max-w-[140px] truncate">{user.name || "Contributor"}</p>
                  <p className="text-[10.5px] text-muted-foreground max-w-[140px] truncate">{user.email}</p>
                </div>
              </button>
            </div>
            <button
              onClick={logout}
              title="Sign out"
              className="w-9 h-9 rounded-lg border border-border bg-surface text-muted-foreground hover:text-red-400 hover:border-red-400/40 transition-all flex items-center justify-center"
            >
              <FiLogOut size={15} />
            </button>
          </div>
        </div>

        {/* Mobile tabs */}
        <div className="md:hidden border-t border-border overflow-x-auto">
          <div className="flex items-center gap-1 px-4 py-2">
            {NAV_ITEMS.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(item.href));
              const Icon = item.icon;
              return (
                <button
                  key={item.href}
                  onClick={() => router.push(item.href)}
                  className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-[11px] font-medium whitespace-nowrap transition-all ${
                    active
                      ? "bg-crimson/15 border border-crimson/30 text-crimson"
                      : "text-muted-foreground border border-transparent"
                  }`}
                >
                  <Icon size={12} />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      <main className={`relative z-10 ${containerCls} mx-auto px-6 py-8 md:py-10`}>
        {children}
      </main>
    </div>
  );
}
