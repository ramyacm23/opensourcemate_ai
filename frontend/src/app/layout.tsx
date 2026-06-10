import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ProtectedShell } from "@/components/ProtectedShell";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeToggle } from "@/components/ThemeToggle";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const themeScript = `
(() => {
  const storageKey = "osm-theme";
  try {
    const stored = window.localStorage.getItem(storageKey);
    const theme =
      stored === "light" || stored === "dark"
        ? stored
        : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
    root.dataset.theme = theme;
  } catch {
    const root = document.documentElement;
    root.classList.add("dark");
    root.dataset.theme = "dark";
  }
})();
`;

export const metadata: Metadata = {
  title: "OpenSourceMate",
  description: "Opensource contribution made easier and seamless with AI assistance",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}>
        <ThemeProvider>
          <div className="fixed right-4 top-4 z-[120] sm:right-5 sm:top-5">
            <ThemeToggle className="bg-background/80 backdrop-blur-md" />
          </div>
          <ProtectedShell>{children}</ProtectedShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
