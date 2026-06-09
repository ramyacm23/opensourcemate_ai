"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  FiArrowRight, FiCheckCircle, FiMail,
  FiMapPin, FiSend, FiAlertCircle,
} from "react-icons/fi";
import { api } from "@/lib/api";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";

const HQ_LINES = [
  "VIT University",
  "Chennai, Tamil Nadu",
  "India",
];
const HQ_QUERY = encodeURIComponent(
  "VIT University, Chennai, Tamil Nadu, India",
);
const HQ_MAP_URL = `https://www.google.com/maps/search/?api=1&query=${HQ_QUERY}`;

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !email.trim() || message.trim().length < 10) {
      setError("Please fill in your name, email, and a message of at least 10 characters.");
      return;
    }
    setLoading(true);
    try {
      await api.submitContact({
        name: name.trim(),
        email: email.trim(),
        subject: subject.trim(),
        message: message.trim(),
        website: website.trim() || undefined,
      });
      setSent(true);
      setName("");
      setEmail("");
      setSubject("");
      setMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send your message. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col relative">
      {/* Background layers */}
      <div className="fixed inset-0 grid-bg opacity-70 pointer-events-none" />
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-crimson/10 rounded-full blur-[120px] pointer-events-none" />

      <SiteHeader />

      <main className="flex-1 relative z-10">
        {/* Hero */}
        <section className="px-6 pt-16 pb-8 md:pt-20 md:pb-10 max-w-6xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
          >
            <div className="inline-flex items-center gap-2 text-xs bg-crimson-muted text-crimson border border-crimson/25 rounded-full px-4 py-1.5 mb-7 font-mono backdrop-blur-sm">
              <FiMail size={12} /> Get in touch
            </div>
            <h1 className="text-4xl md:text-6xl font-semibold tracking-tight mb-5 leading-[1.05]">
              We&apos;d love to <span className="text-crimson text-glow">hear from you</span>
            </h1>
            <p className="text-muted-foreground text-base md:text-lg max-w-xl mx-auto leading-relaxed">
              Questions, partnerships, press, or feedback — drop us a line and a real human will reply.
            </p>
          </motion.div>
        </section>

        {/* Two-column: form + info */}
        <section className="px-6 pb-20 max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-8">
            {/* FORM (3/5) */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.05 }}
              className="lg:col-span-3"
            >
              <div className="relative rounded-2xl border border-border bg-surface/40 backdrop-blur-sm p-6 md:p-8 overflow-hidden">
                <div className="absolute -top-24 -right-24 w-72 h-72 bg-crimson/15 rounded-full blur-3xl pointer-events-none" />

                {sent ? (
                  <div className="relative text-center py-10">
                    <div className="w-14 h-14 rounded-full bg-crimson/15 border border-crimson/30 mx-auto flex items-center justify-center text-crimson mb-5">
                      <FiCheckCircle size={26} />
                    </div>
                    <h2 className="text-2xl font-semibold tracking-tight text-white mb-2">
                      Message received.
                    </h2>
                    <p className="text-muted-foreground text-sm max-w-md mx-auto leading-relaxed">
                      Thanks for reaching out. We&apos;ll get back to you within one business day at the email
                      you provided. A confirmation is on its way to your inbox.
                    </p>
                    <button
                      onClick={() => setSent(false)}
                      className="mt-6 text-sm text-crimson hover:text-crimson-light transition-colors font-medium"
                    >
                      Send another message →
                    </button>
                  </div>
                ) : (
                  <form onSubmit={onSubmit} className="relative space-y-4">
                    <div>
                      <h2 className="text-xl font-semibold tracking-tight text-white mb-1">
                        Send us a message
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        Fill in the form and we&apos;ll be in touch.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="name" className="block text-[13px] font-medium text-white/85 mb-1.5">
                          Your name
                        </label>
                        <input
                          id="name"
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Ada Lovelace"
                          required
                          className="w-full bg-background/60 border border-border focus:border-crimson/50 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-crimson/20 transition-all"
                        />
                      </div>
                      <div>
                        <label htmlFor="email" className="block text-[13px] font-medium text-white/85 mb-1.5">
                          Email
                        </label>
                        <input
                          id="email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@example.com"
                          required
                          className="w-full bg-background/60 border border-border focus:border-crimson/50 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-crimson/20 transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="subject" className="block text-[13px] font-medium text-white/85 mb-1.5">
                        Subject <span className="text-muted-foreground/60 font-normal">(optional)</span>
                      </label>
                      <input
                        id="subject"
                        type="text"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder="What's this about?"
                        className="w-full bg-background/60 border border-border focus:border-crimson/50 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-crimson/20 transition-all"
                      />
                    </div>

                    <div>
                      <label htmlFor="message" className="block text-[13px] font-medium text-white/85 mb-1.5">
                        Message
                      </label>
                      <textarea
                        id="message"
                        rows={6}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Tell us what's on your mind…"
                        required
                        className="w-full bg-background/60 border border-border focus:border-crimson/50 rounded-lg px-3.5 py-3 text-sm text-white placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-crimson/20 transition-all resize-y min-h-[120px]"
                      />
                      <p className="mt-1.5 text-[11px] text-muted-foreground/70">
                        Min 10 characters · we never share your email.
                      </p>
                    </div>

                    {/* Honeypot — hidden from real users */}
                    <div className="hidden" aria-hidden="true">
                      <label>
                        Website
                        <input
                          type="text"
                          tabIndex={-1}
                          autoComplete="off"
                          value={website}
                          onChange={(e) => setWebsite(e.target.value)}
                        />
                      </label>
                    </div>

                    {error && (
                      <div className="flex items-start gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5">
                        <FiAlertCircle size={16} className="shrink-0 mt-0.5" />
                        <span>{error}</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={loading}
                      className="inline-flex items-center justify-center gap-2 w-full sm:w-auto bg-crimson hover:bg-crimson-dark disabled:opacity-60 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-medium transition-all glow-crimson hover:-translate-y-0.5 disabled:hover:translate-y-0"
                    >
                      {loading ? (
                        <span className="inline-flex items-center gap-2">
                          <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                          Sending…
                        </span>
                      ) : (
                        <>
                          Send message <FiSend size={15} />
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>
            </motion.div>

            {/* INFO (2/5) */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.12 }}
              className="lg:col-span-2 space-y-4"
            >
              {/* Email card */}
              <a
                href="mailto:info@opensourcemate.in"
                className="group block rounded-2xl border border-border hover:border-crimson/40 bg-surface/40 backdrop-blur-sm p-6 transition-all hover:-translate-y-0.5"
              >
                <div className="flex items-start gap-4">
                  <span className="w-10 h-10 shrink-0 rounded-lg bg-crimson/15 border border-crimson/30 flex items-center justify-center text-crimson">
                    <FiMail size={18} />
                  </span>
                  <div className="min-w-0">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/80 mb-1">
                      Email us
                    </div>
                    <div className="text-white font-medium tracking-tight break-all">
                      info@opensourcemate.in
                    </div>
                    <div className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                      Best for general questions, partnerships, and feedback.
                    </div>
                    <div className="mt-3 inline-flex items-center gap-1.5 text-xs text-crimson group-hover:text-crimson-light transition-colors">
                      Send email <FiArrowRight size={12} />
                    </div>
                  </div>
                </div>
              </a>

              {/* HQ card */}
              <div className="rounded-2xl border border-border bg-surface/40 backdrop-blur-sm p-6">
                <div className="flex items-start gap-4">
                  <span className="w-10 h-10 shrink-0 rounded-lg bg-crimson/15 border border-crimson/30 flex items-center justify-center text-crimson">
                    <FiMapPin size={18} />
                  </span>
                  <div className="min-w-0">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/80 mb-1">
                      Headquarters
                    </div>
                    <div className="text-white font-medium tracking-tight">
                      Chennai, India
                    </div>
                    <address className="not-italic text-xs text-muted-foreground mt-1.5 leading-relaxed">
                      {HQ_LINES.map((l) => (
                        <div key={l}>{l}</div>
                      ))}
                    </address>
                    <a
                      href={HQ_MAP_URL}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex items-center gap-1.5 text-xs text-crimson hover:text-crimson-light transition-colors"
                    >
                      Open in Google Maps <FiArrowRight size={12} />
                    </a>
                  </div>
                </div>
              </div>

              {/* Hours / response card */}
              <div className="rounded-2xl border border-border bg-surface/40 backdrop-blur-sm p-6">
                <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/80 mb-3">
                  Response time
                </div>
                <div className="text-sm text-white/90 leading-relaxed">
                  We reply to every message — usually within{" "}
                  <span className="text-crimson font-medium">one business day</span>{" "}
                  (Mon–Fri, 09:00–18:00 IST).
                </div>
              </div>
            </motion.div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
