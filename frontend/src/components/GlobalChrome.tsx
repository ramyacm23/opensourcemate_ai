"use client";

import { usePathname } from "next/navigation";
import { FloatingSidebar } from "./FloatingSidebar";

// Routes where we DON'T want the sidebar (public pages)
const PUBLIC_PREFIXES = ["/login", "/register", "/onboarding"];

export function GlobalChrome() {
  const pathname = usePathname() || "/";

  // Hide on landing page and all public auth pages
  if (pathname === "/") return null;
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return null;

  return <FloatingSidebar />;
}
