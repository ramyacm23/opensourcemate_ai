"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FiMail, FiLock, FiArrowRight, FiEye, FiEyeOff, FiGithub } from "react-icons/fi";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import AuthLeft from "@/components/auth/AuthLeft";
import StatusOverlay from "@/components/auth/StatusOverlay";
import { api } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<null | "success" | "error">(null);
  const [shake, setShake] = useState(0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const data = await api.login(email, password);
      localStorage.setItem("token", data.access_token);
      const user = await api.dashboard(data.access_token);
      setStatus("success");
      setTimeout(() => {
        router.push(user.onboarding_completed ? "/dashboard" : "/onboarding");
      }, 1300);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setError(/invalid|incorrect|credential|password|email/i.test(msg) ? "Invalid email or password" : msg);
      setStatus("error");
      setShake(s => s + 1);
      setTimeout(() => setStatus(null), 1600);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background grid grid-cols-1 lg:grid-cols-2">
      <StatusOverlay
        show={status === "success"}
        variant="success"
        title="Welcome back!"
        message="Signed in successfully. Taking you to your dashboard…"
        hint="Redirecting"
      />
      <StatusOverlay
        show={status === "error"}
        variant="error"
        title="Login failed"
        message={error || "Invalid email or password."}
        hint="Try again"
      />
      <AuthLeft
        heading="Welcome back to OpenSourceMate."
        sub="Pick up right where you left off. Your contributions are making a difference."
      />

      <div className="flex items-center justify-center p-8 relative">
        <div className="absolute inset-0 grid-bg opacity-30" />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          key={shake}
          className="relative z-10 w-full max-w-md"
        >
          <div className="mb-8">
            <h1 className="text-2xl font-bold mb-1">Sign in</h1>
            <p className="text-muted-foreground text-sm">Good to have you back.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <Button
              type="button"
              onClick={() => { window.location.href = api.githubSignupUrl(); }}
              className="w-full h-11 bg-white text-slate-900 hover:bg-slate-100 font-medium transition-all flex items-center justify-center gap-2"
            >
              <FiGithub size={16} /> Continue with GitHub
            </Button>

            <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              <span className="flex-1 h-px bg-border" />
              or with email
              <span className="flex-1 h-px bg-border" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm text-muted-foreground">Email</Label>
              <div className="relative">
                <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="pl-9 bg-surface border-border focus:border-crimson focus:ring-crimson/20 h-11"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm text-muted-foreground">Password</Label>
                <Link href="/forgot-password" className="text-xs text-crimson hover:underline font-medium">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} />
                <Input
                  id="password"
                  type={show ? "text" : "password"}
                  placeholder="Your password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="pl-9 pr-9 bg-surface border-border focus:border-crimson focus:ring-crimson/20 h-11"
                />
                <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white transition-colors">
                  {show ? <FiEyeOff size={15} /> : <FiEye size={15} />}
                </button>
              </div>
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2"
              >
                {error}
              </motion.p>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-crimson hover:bg-crimson-dark text-white font-medium glow-crimson"
            >
              {loading ? "Signing in..." : <span className="flex items-center gap-2">Sign In <FiArrowRight /></span>}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-crimson hover:underline font-medium">Create one</Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
