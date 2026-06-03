"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  FiHome, FiZap, FiClock, FiUser, FiLogOut, FiCode, FiGithub,
} from "react-icons/fi";
import {
  Tooltip, TooltipContent, TooltipTrigger, TooltipProvider,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { api, resolveAvatar } from "@/lib/api";

const NAV = [
  { href: "/dashboard",       label: "Dashboard", icon: FiHome },
  { href: "/analyze",         label: "Analyze",   icon: FiZap  },
  { href: "/analyze/history", label: "History",   icon: FiClock },
  { href: "/profile",         label: "Profile",   icon: FiUser },
];

interface ShellUser {
  name: string;
  email: string;
  avatar_url?: string | null;
  github_avatar_url?: string | null;
}

export function FloatingSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<ShellUser | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    api.dashboard(token).then(setUser).catch(() => {});
  }, [pathname]);

  function logout() {
    localStorage.removeItem("token");
    router.push("/");
  }

  const initial = ((user?.name || user?.email || "?")[0] || "?").toUpperCase();
  const avatarSrc = resolveAvatar(user?.avatar_url) || user?.github_avatar_url;

  return (
    <TooltipProvider delayDuration={150}>
      <aside
        aria-label="Primary"
        className={cn(
          "fixed left-3 top-1/2 -translate-y-1/2 z-40",
          "hidden md:flex flex-col items-center gap-1.5",
          "p-2 rounded-2xl",
          "bg-surface/80 backdrop-blur-xl border border-border",
          "shadow-[0_8px_32px_-8px_rgba(0,0,0,0.6)]"
        )}
      >
        {/* Brand */}
        <button
          onClick={() => router.push("/dashboard")}
          aria-label="OpenSourceMate"
          className="w-10 h-10 rounded-xl bg-crimson/15 border border-crimson/30 text-crimson flex items-center justify-center hover:bg-crimson/25 transition-colors"
        >
          <FiCode size={16} />
        </button>

        <div className="w-7 h-px bg-border my-1" />

        {/* Nav items */}
        {NAV.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Tooltip key={item.href}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => router.push(item.href)}
                  aria-label={item.label}
                  className={cn(
                    "relative w-10 h-10 rounded-xl flex items-center justify-center transition-all border",
                    active
                      ? "bg-crimson/15 border-crimson/40 text-crimson"
                      : "bg-transparent border-transparent text-muted-foreground hover:text-white hover:bg-muted/30"
                  )}
                >
                  <Icon size={16} />
                  {active && (
                    <span className="absolute left-[-8px] top-1/2 -translate-y-1/2 w-1 h-5 rounded-full bg-crimson" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">{item.label}</TooltipContent>
            </Tooltip>
          );
        })}

        <div className="w-7 h-px bg-border my-1" />

        {/* GitHub external */}
        <Tooltip>
          <TooltipTrigger asChild>
            <a
              href="https://github.com/Zyora-Dev/opensourcemate"
              target="_blank"
              rel="noreferrer"
              aria-label="GitHub repo"
              className="w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:text-white hover:bg-muted/30 transition-all"
            >
              <FiGithub size={15} />
            </a>
          </TooltipTrigger>
          <TooltipContent side="right">View on GitHub</TooltipContent>
        </Tooltip>

        {/* User avatar -> profile */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => router.push("/profile")}
              aria-label="Profile"
              className="w-10 h-10 rounded-xl overflow-hidden border border-border hover:border-crimson/40 transition-all flex items-center justify-center"
            >
              {avatarSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarSrc} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs font-semibold text-crimson bg-crimson/10 w-full h-full flex items-center justify-center">
                  {initial}
                </span>
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {user?.name || user?.email || "Profile"}
          </TooltipContent>
        </Tooltip>

        {/* Logout */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={logout}
              aria-label="Sign out"
              className="w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all"
            >
              <FiLogOut size={15} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">Sign out</TooltipContent>
        </Tooltip>
      </aside>

      {/* Mobile bottom bar */}
      <nav
        aria-label="Primary mobile"
        className="md:hidden fixed bottom-3 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1 p-1.5 rounded-2xl bg-surface/85 backdrop-blur-xl border border-border shadow-[0_8px_32px_-8px_rgba(0,0,0,0.6)]"
      >
        {NAV.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              aria-label={item.label}
              className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                active
                  ? "bg-crimson/15 text-crimson"
                  : "text-muted-foreground hover:text-white"
              )}
            >
              <Icon size={16} />
            </button>
          );
        })}
      </nav>
    </TooltipProvider>
  );
}
