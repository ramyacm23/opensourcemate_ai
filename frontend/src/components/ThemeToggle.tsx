"use client";

import { Moon, Sun } from "lucide-react";

import { useTheme } from "@/components/ThemeProvider";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { mounted, theme, toggleTheme } = useTheme();

  if (!mounted) {
    return (
      <span
        aria-hidden="true"
        className={cn(
          "inline-flex h-10 w-10 shrink-0 rounded-xl border border-border bg-background/70 opacity-0",
          className
        )}
      />
    );
  }

  const nextTheme = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${nextTheme} theme`}
      title={`Switch to ${nextTheme} theme`}
      className={cn(
        "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-background/70 text-muted-foreground shadow-sm transition-all",
        "hover:border-crimson/35 hover:bg-surface hover:text-foreground",
        className
      )}
    >
      {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
