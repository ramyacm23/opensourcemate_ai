"use client";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { FiArrowLeft } from "react-icons/fi";

interface Props {
  email: string;
  loading?: boolean;
  error?: string;
  onSubmit: (otp: string) => void;
  onResend: () => Promise<void> | void;
  onBack?: () => void;
  cooldownSeconds?: number;
}

export default function OtpInput({
  email,
  loading,
  error,
  onSubmit,
  onResend,
  onBack,
  cooldownSeconds = 30,
}: Props) {
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [cooldown, setCooldown] = useState(cooldownSeconds);
  const [resending, setResending] = useState(false);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => { refs.current[0]?.focus(); }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  function handleChange(i: number, v: string) {
    const cleaned = v.replace(/\D/g, "").slice(0, 1);
    const next = [...digits];
    next[i] = cleaned;
    setDigits(next);
    if (cleaned && i < 5) refs.current[i + 1]?.focus();
    if (cleaned && i === 5 && next.every(d => d)) {
      onSubmit(next.join(""));
    }
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      refs.current[i - 1]?.focus();
    }
    if (e.key === "Enter") {
      const code = digits.join("");
      if (code.length === 6) onSubmit(code);
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!text) return;
    e.preventDefault();
    const next = ["", "", "", "", "", ""];
    for (let i = 0; i < text.length; i++) next[i] = text[i];
    setDigits(next);
    const focusIndex = Math.min(text.length, 5);
    refs.current[focusIndex]?.focus();
    if (text.length === 6) onSubmit(text);
  }

  async function handleResend() {
    if (cooldown > 0 || resending) return;
    setResending(true);
    try {
      await onResend();
      setCooldown(cooldownSeconds);
    } finally {
      setResending(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-5"
    >
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-white transition-colors"
        >
          <FiArrowLeft size={13} /> Back
        </button>
      )}
      <div>
        <h1 className="text-2xl font-bold mb-1">Check your email</h1>
        <p className="text-muted-foreground text-sm">
          We sent a 6-digit code to{" "}
          <span className="text-white font-medium">{email}</span>. It expires in 10 minutes.
        </p>
      </div>

      <div className="flex gap-2 sm:gap-3 justify-between" onPaste={handlePaste}>
        {digits.map((d, i) => (
          <input
            key={i}
            ref={el => { refs.current[i] = el; }}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={1}
            value={d}
            onChange={e => handleChange(i, e.target.value)}
            onKeyDown={e => handleKeyDown(i, e)}
            disabled={loading}
            className="w-11 sm:w-12 h-14 text-center text-xl font-semibold rounded-lg bg-surface border border-border focus:border-crimson focus:ring-2 focus:ring-crimson/20 outline-none transition-all"
          />
        ))}
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

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Didn&apos;t get it?</span>
        <button
          type="button"
          onClick={handleResend}
          disabled={cooldown > 0 || resending}
          className="text-crimson hover:underline font-medium disabled:opacity-50 disabled:cursor-not-allowed disabled:no-underline"
        >
          {resending ? "Sending..." : cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
        </button>
      </div>

      {loading && (
        <p className="text-center text-xs text-muted-foreground">Verifying…</p>
      )}
    </motion.div>
  );
}
