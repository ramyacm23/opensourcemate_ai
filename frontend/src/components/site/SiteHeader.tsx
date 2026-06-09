"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { FiArrowRight, FiCode, FiMenu, FiX } from "react-icons/fi";

const NAV = [
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close menu on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll when menu is open
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  return (
    <nav className="sticky top-0 z-40 backdrop-blur-md bg-background/70 border-b border-border">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-4 sm:px-6 py-4">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="w-7 h-7 rounded-md bg-crimson/15 border border-crimson/30 flex items-center justify-center text-crimson">
            <FiCode size={14} />
          </span>
          <span className="text-white text-[15px] font-semibold tracking-tight">
            OpenSource<span className="text-crimson">Mate</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1 sm:gap-2">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="inline-flex text-sm text-muted-foreground hover:text-white transition-colors px-4 py-2"
            >
              {n.label}
            </Link>
          ))}
          <Link
            href="/login"
            className="text-sm text-muted-foreground hover:text-white transition-colors px-4 py-2"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="inline-flex items-center gap-1.5 text-sm bg-crimson hover:bg-crimson-dark text-white px-4 py-2 rounded-lg transition-all font-medium shadow-[0_4px_20px_-4px_rgba(217,119,87,0.5)]"
          >
            Get Started <FiArrowRight size={14} />
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="site-mobile-menu"
          onClick={() => setOpen((v) => !v)}
          className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg border border-border text-white hover:bg-white/5 transition-colors"
        >
          {open ? <FiX size={18} /> : <FiMenu size={18} />}
        </button>
      </div>

      {/* Mobile sheet */}
      <div
        id="site-mobile-menu"
        className={`md:hidden fixed inset-x-0 top-[65px] z-30 origin-top transition-all duration-200 ${
          open
            ? "opacity-100 translate-y-0 pointer-events-auto"
            : "opacity-0 -translate-y-2 pointer-events-none"
        }`}
      >
        <div className="bg-background/95 backdrop-blur-md border-b border-border shadow-2xl">
          <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col gap-1">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="block text-[15px] text-white/90 hover:text-white hover:bg-white/5 rounded-lg px-3 py-3 transition-colors"
              >
                {n.label}
              </Link>
            ))}
            <Link
              href="/login"
              className="block text-[15px] text-white/90 hover:text-white hover:bg-white/5 rounded-lg px-3 py-3 transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="mt-2 inline-flex items-center justify-center gap-1.5 text-[15px] bg-crimson hover:bg-crimson-dark text-white px-4 py-3 rounded-lg transition-all font-medium shadow-[0_4px_20px_-4px_rgba(217,119,87,0.5)]"
            >
              Get Started <FiArrowRight size={14} />
            </Link>
          </div>
        </div>

        {/* Backdrop */}
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
          className="block w-full h-[calc(100vh-65px)] bg-background/40 backdrop-blur-[2px]"
        />
      </div>
    </nav>
  );
}
