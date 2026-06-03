"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  FiHome, FiZap, FiClock, FiUser, FiLogOut, FiCode, FiGithub,
  FiChevronLeft, FiChevronRight, FiBell, FiSearch, FiMenu, FiX,
} from "react-icons/fi";
import {
  Tooltip, TooltipContent, TooltipTrigger, TooltipProvider,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { api, resolveAvatar } from "@/lib/api";

interface ShellUser {
  id: number;
  name: string;
  email: string;
  avatar_url?: string | null;
  github_avatar_url?: string | null;
}

const NAV = [
  { href: "/dashboard",       label: "Dashboard", icon: FiHome },
  { href: "/analyze",         label: "Analyze",   icon: FiZap  },
  { href: "/analyze/history", label: "History",   icon: FiClock },
  { href: "/profile",         label: "Profile",   icon: FiUser },
];

const TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/analyze": "New analysis",
  "/analyze/history": "Analysis history",
  "/profile": "Profile",
};

function deriveTitle(pathname: string): string {
  if (TITLES[pathname]) return TITLES[pathname];
  if (pathname.startsWith("/analyze/") && pathname !== "/analyze/history") return "Analysis";
  return "OpenSourceMate";
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<ShellUser | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");

  // Hydrate collapsed state from localStorage
  useEffect(() => {
    const v = typeof window !== "undefined" ? localStorage.getItem("osm-sidebar-collapsed") : null;
    if (v === "1") setCollapsed(true);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    api.dashboard(token).then(setUser).catch(() => {});
  }, [pathname]);

  // Close mobile drawer on route change
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("osm-sidebar-collapsed", next ? "1" : "0");
  }

  function logout() {
    localStorage.removeItem("token");
    router.push("/");
  }

  const initial = ((user?.name || user?.email || "?")[0] || "?").toUpperCase();
  const avatarSrc = resolveAvatar(user?.avatar_url) || user?.github_avatar_url;
  const title = deriveTitle(pathname || "/");

  // Pixel widths so we can drive padding precisely
  const sidebarW = collapsed ? 72 : 232;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="min-h-screen bg-background relative text-white">
        {/* Background fx (global) */}
        <div className="fixed inset-0 grid-bg opacity-50 pointer-events-none" />
        <div className="fixed top-[-200px] left-1/2 -translate-x-1/2 w-[1100px] h-[500px] bg-crimson/8 rounded-full blur-[120px] pointer-events-none" />

        {/* ========== Floating Sidebar (desktop) ========== */}
        <aside
          aria-label="Primary"
          style={{ width: sidebarW }}
          className={cn(
            "hidden md:flex fixed left-3 top-3 bottom-3 z-40 flex-col",
            "bg-surface/85 backdrop-blur-xl border border-border rounded-2xl",
            "shadow-[0_8px_40px_-12px_rgba(0,0,0,0.7)]",
            "transition-[width] duration-200 ease-out"
          )}
        >
          {/* Brand */}
          <button
            onClick={() => router.push("/dashboard")}
            className="flex items-center gap-2.5 px-3 py-3.5 border-b border-border hover:opacity-90 transition"
          >
            <span className="w-9 h-9 rounded-xl bg-crimson/15 border border-crimson/30 text-crimson flex items-center justify-center shrink-0">
              <FiCode size={16} />
            </span>
            {!collapsed && (
              <span className="text-white text-[15px] font-semibold tracking-tight whitespace-nowrap">
                OpenSource<span className="text-crimson">Mate</span>
              </span>
            )}
          </button>

          {/* Nav items */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {NAV.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(item.href));
              const Icon = item.icon;

              const button = (
                <button
                  onClick={() => router.push(item.href)}
                  aria-label={item.label}
                  className={cn(
                    "relative w-full flex items-center gap-3 rounded-xl transition-all border",
                    "h-10",
                    collapsed ? "justify-center px-0" : "px-3",
                    active
                      ? "bg-crimson/15 border-crimson/35 text-crimson"
                      : "bg-transparent border-transparent text-muted-foreground hover:text-white hover:bg-muted/30"
                  )}
                >
                  <Icon size={16} className="shrink-0" />
                  {!collapsed && (
                    <span className="text-sm font-medium whitespace-nowrap">{item.label}</span>
                  )}
                  {active && (
                    <span className="absolute left-[-10px] top-1/2 -translate-y-1/2 w-1 h-5 rounded-full bg-crimson" />
                  )}
                </button>
              );

              return collapsed ? (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>{button}</TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              ) : (
                <div key={item.href}>{button}</div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="p-2 border-t border-border space-y-1">
            {/* GitHub external */}
            <a
              href="https://github.com/Zyora-Dev/opensourcemate"
              target="_blank"
              rel="noreferrer"
              className={cn(
                "w-full flex items-center gap-3 rounded-xl h-10 text-muted-foreground hover:text-white hover:bg-muted/30 transition-all",
                collapsed ? "justify-center" : "px-3"
              )}
            >
              <FiGithub size={15} className="shrink-0" />
              {!collapsed && <span className="text-sm">GitHub</span>}
            </a>

            {/* Sign out */}
            <button
              onClick={logout}
              className={cn(
                "w-full flex items-center gap-3 rounded-xl h-10 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all",
                collapsed ? "justify-center" : "px-3"
              )}
            >
              <FiLogOut size={15} className="shrink-0" />
              {!collapsed && <span className="text-sm">Sign out</span>}
            </button>

            {/* Collapse toggle */}
            <button
              onClick={toggleCollapsed}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className={cn(
                "w-full flex items-center gap-3 rounded-xl h-9 mt-1 border border-border bg-background/40 hover:bg-muted/30 text-muted-foreground hover:text-white transition-all",
                collapsed ? "justify-center" : "px-3"
              )}
            >
              {collapsed ? <FiChevronRight size={14} /> : <FiChevronLeft size={14} />}
              {!collapsed && <span className="text-xs">Collapse</span>}
            </button>
          </div>
        </aside>

        {/* ========== Mobile drawer ========== */}
        {mobileOpen && (
          <div
            className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
        )}
        <aside
          aria-label="Primary mobile"
          className={cn(
            "md:hidden fixed left-3 top-3 bottom-3 z-50 w-[260px]",
            "bg-surface/95 backdrop-blur-xl border border-border rounded-2xl",
            "shadow-[0_8px_40px_-12px_rgba(0,0,0,0.7)]",
            "flex flex-col transition-transform duration-200 ease-out",
            mobileOpen ? "translate-x-0" : "-translate-x-[300px]"
          )}
        >
          <div className="flex items-center justify-between gap-2 px-3 py-3.5 border-b border-border">
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl bg-crimson/15 border border-crimson/30 text-crimson flex items-center justify-center">
                <FiCode size={16} />
              </span>
              <span className="text-white text-[15px] font-semibold tracking-tight">
                OpenSource<span className="text-crimson">Mate</span>
              </span>
            </div>
            <button
              onClick={() => setMobileOpen(false)}
              className="w-8 h-8 rounded-lg text-muted-foreground hover:text-white hover:bg-muted/30 flex items-center justify-center"
            >
              <FiX size={16} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {NAV.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(item.href));
              const Icon = item.icon;
              return (
                <button
                  key={item.href}
                  onClick={() => router.push(item.href)}
                  className={cn(
                    "w-full flex items-center gap-3 rounded-xl h-10 px-3 border transition-all",
                    active
                      ? "bg-crimson/15 border-crimson/35 text-crimson"
                      : "bg-transparent border-transparent text-muted-foreground hover:text-white hover:bg-muted/30"
                  )}
                >
                  <Icon size={16} />
                  <span className="text-sm font-medium">{item.label}</span>
                </button>
              );
            })}
          </div>
          <div className="p-2 border-t border-border">
            <button
              onClick={logout}
              className="w-full flex items-center gap-3 rounded-xl h-10 px-3 text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
            >
              <FiLogOut size={15} />
              <span className="text-sm">Sign out</span>
            </button>
          </div>
        </aside>

        {/* ========== Main column ========== */}
        <div
          className="min-h-screen flex flex-col px-3"
          style={{ ["--sidebar-w" as string]: `${sidebarW}px` }}
        >
          {/* Header */}
          <header className="sticky top-3 z-30 md:ml-[calc(var(--sidebar-w)+12px)] transition-[margin] duration-200 ease-out">
            <div className="bg-surface/80 backdrop-blur-xl border border-border rounded-2xl shadow-[0_4px_20px_-8px_rgba(0,0,0,0.5)]">
              <div className="flex items-center justify-between gap-3 px-4 md:px-5 h-14">
                {/* Mobile menu */}
                <button
                  onClick={() => setMobileOpen(true)}
                  className="md:hidden w-9 h-9 rounded-lg border border-border bg-background/40 text-muted-foreground hover:text-white flex items-center justify-center"
                >
                  <FiMenu size={16} />
                </button>

                {/* Title */}
                <div className="min-w-0 flex-1 md:flex-initial">
                  <h1 className="text-[15px] md:text-base font-semibold tracking-tight truncate">{title}</h1>
                </div>

                {/* Search (md+) */}
                <div className="relative hidden md:block flex-1 max-w-md">
                  <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={13} />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search your workspace…"
                    className="w-full bg-background/50 border border-border rounded-lg pl-9 pr-3 h-9 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-crimson/50 focus:ring-2 focus:ring-crimson/15 transition-all"
                  />
                  <kbd className="hidden lg:inline absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono text-muted-foreground bg-background border border-border rounded px-1.5 py-0.5">⌘K</kbd>
                </div>

                {/* Right cluster */}
                <div className="flex items-center gap-1.5">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="w-9 h-9 rounded-lg border border-border bg-background/40 text-muted-foreground hover:text-white hover:border-crimson/40 transition-all flex items-center justify-center">
                        <FiBell size={14} />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Notifications</TooltipContent>
                  </Tooltip>

                  {user && (
                    <button
                      onClick={() => router.push("/profile")}
                      title="View profile"
                      className="flex items-center gap-2 pl-2 ml-1 border-l border-border hover:opacity-80 transition-opacity"
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
                      <div className="hidden lg:block leading-tight text-left">
                        <p className="text-xs font-medium text-white max-w-[140px] truncate">
                          {user.name || "Contributor"}
                        </p>
                        <p className="text-[10.5px] text-muted-foreground max-w-[140px] truncate">
                          {user.email}
                        </p>
                      </div>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </header>

          {/* Content */}
          <main className="relative z-10 flex-1 md:ml-[calc(var(--sidebar-w)+12px)] transition-[margin] duration-200 ease-out pt-5 pb-6 md:pb-10">
            {children}
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
