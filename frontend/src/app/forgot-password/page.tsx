"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FiMail, FiLock, FiArrowRight, FiEye, FiEyeOff, FiArrowLeft } from "react-icons/fi";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import AuthLeft from "@/components/auth/AuthLeft";
import StatusOverlay from "@/components/auth/StatusOverlay";
import OtpInput from "@/components/auth/OtpInput";
import { api } from "@/lib/api";

type Step = "email" | "otp" | "reset";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [otpError, setOtpError] = useState("");
  const [status, setStatus] = useState<null | "success" | "error" | "sent">(null);

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api.forgotPasswordRequest(email);
      setStatus("sent");
      setTimeout(() => setStatus(null), 1400);
      setStep("otp");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function handleOtpSubmit(code: string) {
    setOtp(code);
    setOtpError("");
    setStep("reset");
  }

  async function handleResend() {
    setOtpError("");
    await api.forgotPasswordRequest(email);
  }

  async function handleResetSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (newPassword.length < 8) throw new Error("Password must be at least 8 characters");
      const data = await api.forgotPasswordVerify(email, otp, newPassword);
      localStorage.setItem("token", data.access_token);
      setStatus("success");
      setTimeout(() => router.push("/dashboard"), 1300);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Reset failed";
      // If OTP is wrong, surface inside the OTP step.
      if (/code|otp|attempt/i.test(msg)) {
        setOtpError(msg);
        setStep("otp");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background grid grid-cols-1 lg:grid-cols-2">
      <StatusOverlay
        show={status === "sent"}
        variant="welcome"
        title="Code sent"
        message={`If ${email} is registered, we just emailed a 6-digit code.`}
        hint="Check your inbox"
      />
      <StatusOverlay
        show={status === "success"}
        variant="success"
        title="Password updated!"
        message="You're now signed in. Taking you to your dashboard…"
        hint="Redirecting"
      />
      <AuthLeft
        heading="Reset your password."
        sub="A short verification code is all that stands between you and your dashboard."
      />

      <div className="flex items-center justify-center p-8 relative">
        <div className="absolute inset-0 grid-bg opacity-30" />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10 w-full max-w-md"
        >
          <AnimatePresence mode="wait">
            {step === "email" && (
              <motion.div key="email" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Link href="/login" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-white mb-5 transition-colors">
                  <FiArrowLeft size={13} /> Back to sign in
                </Link>
                <div className="mb-8">
                  <h1 className="text-2xl font-bold mb-1">Forgot your password?</h1>
                  <p className="text-muted-foreground text-sm">No worries — enter your email and we&apos;ll send you a verification code.</p>
                </div>

                <form onSubmit={handleEmailSubmit} className="space-y-5">
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
                    {loading ? "Sending code..." : <span className="flex items-center gap-2">Send code <FiArrowRight /></span>}
                  </Button>
                </form>

                <p className="text-center text-sm text-muted-foreground mt-6">
                  Remembered it?{" "}
                  <Link href="/login" className="text-crimson hover:underline font-medium">Sign in</Link>
                </p>
              </motion.div>
            )}

            {step === "otp" && (
              <motion.div key="otp" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <OtpInput
                  email={email}
                  loading={loading}
                  error={otpError}
                  onSubmit={handleOtpSubmit}
                  onResend={handleResend}
                  onBack={() => { setStep("email"); setOtpError(""); }}
                />
              </motion.div>
            )}

            {step === "reset" && (
              <motion.div key="reset" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <button
                  type="button"
                  onClick={() => { setStep("otp"); setError(""); }}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-white mb-5 transition-colors"
                >
                  <FiArrowLeft size={13} /> Back
                </button>
                <div className="mb-8">
                  <h1 className="text-2xl font-bold mb-1">Set a new password</h1>
                  <p className="text-muted-foreground text-sm">Choose something strong — at least 8 characters.</p>
                </div>

                <form onSubmit={handleResetSubmit} className="space-y-5">
                  <div className="space-y-1.5">
                    <Label htmlFor="newpw" className="text-sm text-muted-foreground">New password</Label>
                    <div className="relative">
                      <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} />
                      <Input
                        id="newpw"
                        type={show ? "text" : "password"}
                        placeholder="Min. 8 characters"
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        required
                        autoFocus
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
                    {loading ? "Updating..." : <span className="flex items-center gap-2">Update password <FiArrowRight /></span>}
                  </Button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
