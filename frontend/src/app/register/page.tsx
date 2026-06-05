"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FiMail, FiLock, FiArrowRight, FiEye, FiEyeOff, FiGithub } from "react-icons/fi";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import AuthLeft from "@/components/auth/AuthLeft";
import StatusOverlay from "@/components/auth/StatusOverlay";
import OtpInput from "@/components/auth/OtpInput";
import { api } from "@/lib/api";

type Step = "form" | "otp";

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("form");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [otpError, setOtpError] = useState("");
  const [status, setStatus] = useState<null | "success" | "error" | "sent">(null);
  const [shake, setShake] = useState(0);

  async function handleStart(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (password.length < 8) throw new Error("Password must be at least 8 characters");
      await api.registerStart(email, password);
      setStatus("sent");
      setTimeout(() => setStatus(null), 1400);
      setStep("otp");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setError(msg);
      setStatus("error");
      setShake(s => s + 1);
      setTimeout(() => setStatus(null), 1700);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(otp: string) {
    setLoading(true);
    setOtpError("");
    try {
      const data = await api.registerVerify(email, otp);
      localStorage.setItem("token", data.access_token);
      setStatus("success");
      setTimeout(() => router.push("/onboarding"), 1300);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Verification failed";
      setOtpError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setOtpError("");
    await api.registerStart(email, password);
  }

  return (
    <div className="min-h-screen bg-background grid grid-cols-1 lg:grid-cols-2">
      <StatusOverlay
        show={status === "sent"}
        variant="welcome"
        title="Code sent"
        message={`We emailed a 6-digit code to ${email}.`}
        hint="Check your inbox"
      />
      <StatusOverlay
        show={status === "success"}
        variant="success"
        title="Email verified!"
        message="Welcome aboard. Let's personalise your experience next."
        hint="Taking you to onboarding"
      />
      <StatusOverlay
        show={status === "error"}
        variant="error"
        title="Couldn't send code"
        message={error || "Please try again."}
        hint="Check your details"
      />
      <AuthLeft
        heading="Contribute to Open Source with confidence."
        sub="Join thousands of developers making meaningful contributions guided by AI — faster, smarter, better."
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
          <AnimatePresence mode="wait">
            {step === "form" ? (
              <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="mb-8">
                  <h1 className="text-2xl font-bold mb-1">Create your account</h1>
                  <p className="text-muted-foreground text-sm">Start your open source journey today.</p>
                </div>

                <form onSubmit={handleStart} className="space-y-5">
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
                    <Label htmlFor="password" className="text-sm text-muted-foreground">Password</Label>
                    <div className="relative">
                      <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} />
                      <Input
                        id="password"
                        type={show ? "text" : "password"}
                        placeholder="Min. 8 characters"
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
                    className="w-full h-11 bg-crimson hover:bg-crimson-dark text-white font-medium transition-all glow-crimson"
                  >
                    {loading ? "Sending code..." : <span className="flex items-center gap-2">Continue <FiArrowRight /></span>}
                  </Button>
                </form>

                <p className="text-center text-sm text-muted-foreground mt-6">
                  Already have an account?{" "}
                  <Link href="/login" className="text-crimson hover:underline font-medium">Sign in</Link>
                </p>
              </motion.div>
            ) : (
              <motion.div key="otp" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <OtpInput
                  email={email}
                  loading={loading}
                  error={otpError}
                  onSubmit={handleVerify}
                  onResend={handleResend}
                  onBack={() => { setStep("form"); setOtpError(""); }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
