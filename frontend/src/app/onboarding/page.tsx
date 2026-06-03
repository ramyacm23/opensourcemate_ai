"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  FiUser, FiPhone, FiGlobe, FiLinkedin, FiArrowRight, FiArrowLeft, FiCheck, FiCode,
} from "react-icons/fi";
import { MdOutlineWork, MdSchool, MdBusiness } from "react-icons/md";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import FloatingDevIcons from "@/components/auth/FloatingDevIcons";
import StatusOverlay from "@/components/auth/StatusOverlay";
import { api } from "@/lib/api";

const userTypes = [
  { value: "Freelancer", label: "Freelancer", icon: <MdOutlineWork size={22} />, desc: "Independent contributor" },
  { value: "Student", label: "Student", icon: <MdSchool size={22} />, desc: "Learning & growing" },
  { value: "Enterprise", label: "Enterprise", icon: <MdBusiness size={22} />, desc: "Company / team" },
];

const steps = ["About you", "Your role", "Online presence"];

const variants = {
  enter: (dir: number) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -60 : 60, opacity: 0 }),
};

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [welcome, setWelcome] = useState(true);
  const [status, setStatus] = useState<null | "success" | "error">(null);

  // Show welcome splash for ~1.6s on mount
  useEffect(() => {
    // GitHub OAuth signup returns here with #token=...
    if (typeof window !== "undefined" && window.location.hash.includes("token=")) {
      const params = new URLSearchParams(window.location.hash.slice(1));
      const t = params.get("token");
      if (t) {
        localStorage.setItem("token", t);
        history.replaceState(null, "", window.location.pathname);
      }
    }
    const t = setTimeout(() => setWelcome(false), 1700);
    return () => clearTimeout(t);
  }, []);

  const [form, setForm] = useState({
    name: "", mobile: "", user_type: "", website: "", linkedin: "",
  });

  function set(k: string, v: string) {
    setForm(f => ({ ...f, [k]: v }));
  }

  function next() { setDir(1); setStep(s => s + 1); }
  function back() { setDir(-1); setStep(s => s - 1); }

  async function submit() {
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("token") || "";
      await api.onboard(form, token);
      setStatus("success");
      setTimeout(() => router.push("/dashboard"), 1600);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setError(msg);
      setStatus("error");
      setTimeout(() => setStatus(null), 1700);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background grid-bg flex items-center justify-center p-6 relative overflow-hidden">
      {/* Floating dev icons backdrop */}
      <FloatingDevIcons />

      {/* Welcome splash */}
      <StatusOverlay
        show={welcome}
        variant="welcome"
        title="Welcome to OpenSourceMate"
        message="Let’s set up your contributor profile in three quick steps."
        hint="Getting things ready"
      />

      {/* Success / error overlays */}
      <StatusOverlay
        show={status === "success"}
        variant="success"
        title="You’re all set!"
        message="Your profile is ready. Taking you to your dashboard…"
        hint="Almost there"
      />
      <StatusOverlay
        show={status === "error"}
        variant="error"
        title="Couldn’t save profile"
        message={error || "Please review your details and try again."}
        hint="Try again"
      />

      {/* Glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-96 h-64 bg-crimson/8 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-lg relative z-10">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <span className="w-7 h-7 rounded-md bg-crimson/15 border border-crimson/30 flex items-center justify-center text-crimson">
            <FiCode size={14} />
          </span>
          <span className="text-white font-semibold text-[15px] tracking-tight">OpenSource<span className="text-crimson">Mate</span></span>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center gap-2 flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                i < step ? "bg-crimson text-white" : i === step ? "bg-crimson text-white glow-crimson" : "bg-surface border border-border text-muted-foreground"
              }`}>
                {i < step ? <FiCheck size={12} /> : i + 1}
              </div>
              <span className={`text-xs hidden sm:block ${i === step ? "text-white" : "text-muted-foreground"}`}>{s}</span>
              {i < steps.length - 1 && (
                <div className={`flex-1 h-px transition-all duration-500 ${i < step ? "bg-crimson" : "bg-border"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="bg-surface border border-border rounded-2xl p-8 overflow-hidden min-h-[320px]">
          <AnimatePresence custom={dir} mode="wait">
            {step === 0 && (
              <motion.div key="step0" custom={dir} variants={variants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }}>
                <h2 className="text-xl font-bold mb-1">Tell us about yourself</h2>
                <p className="text-muted-foreground text-sm mb-6">We&apos;ll personalise your experience.</p>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm text-muted-foreground">Full Name</Label>
                    <div className="relative">
                      <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} />
                      <Input placeholder="John Doe" value={form.name} onChange={e => set("name", e.target.value)}
                        className="pl-9 bg-background border-border focus:border-crimson h-11" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm text-muted-foreground">Mobile Number</Label>
                    <div className="relative">
                      <FiPhone className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} />
                      <Input placeholder="+1 234 567 890" value={form.mobile} onChange={e => set("mobile", e.target.value)}
                        className="pl-9 bg-background border-border focus:border-crimson h-11" />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div key="step1" custom={dir} variants={variants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }}>
                <h2 className="text-xl font-bold mb-1">What describes you best?</h2>
                <p className="text-muted-foreground text-sm mb-6">Choose your contributor type.</p>
                <div className="grid grid-cols-3 gap-3">
                  {userTypes.map(t => (
                    <button key={t.value} onClick={() => set("user_type", t.value)}
                      className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all duration-200 ${
                        form.user_type === t.value
                          ? "border-crimson bg-crimson/10 text-crimson"
                          : "border-border bg-background text-muted-foreground hover:border-crimson/30"
                      }`}>
                      {t.icon}
                      <span className="text-xs font-medium">{t.label}</span>
                      <span className="text-[10px] opacity-70">{t.desc}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="step2" custom={dir} variants={variants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }}>
                <h2 className="text-xl font-bold mb-1">Your online presence</h2>
                <p className="text-muted-foreground text-sm mb-6">Optional — helps others find you.</p>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm text-muted-foreground">Website</Label>
                    <div className="relative">
                      <FiGlobe className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} />
                      <Input placeholder="https://yoursite.com" value={form.website} onChange={e => set("website", e.target.value)}
                        className="pl-9 bg-background border-border focus:border-crimson h-11" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm text-muted-foreground">LinkedIn</Label>
                    <div className="relative">
                      <FiLinkedin className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} />
                      <Input placeholder="https://linkedin.com/in/you" value={form.linkedin} onChange={e => set("linkedin", e.target.value)}
                        className="pl-9 bg-background border-border focus:border-crimson h-11" />
                    </div>
                  </div>
                </div>
                {error && (
                  <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2 mt-4">{error}</p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Nav buttons */}
        <div className="flex justify-between mt-4">
          <Button variant="ghost" onClick={back} disabled={step === 0} className="gap-2 text-muted-foreground">
            <FiArrowLeft size={14} /> Back
          </Button>
          {step < 2 ? (
            <Button onClick={next}
              disabled={(step === 0 && (!form.name || !form.mobile)) || (step === 1 && !form.user_type)}
              className="gap-2 bg-crimson hover:bg-crimson-dark text-white">
              Continue <FiArrowRight size={14} />
            </Button>
          ) : (
            <Button onClick={submit} disabled={loading} className="gap-2 bg-crimson hover:bg-crimson-dark text-white glow-crimson">
              {loading ? "Saving..." : <><FiCheck size={14} /> Complete Setup</>}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
