"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import {
  FiArrowRight, FiCompass, FiHeart, FiLinkedin, FiMapPin,
  FiTarget, FiUsers, FiZap, FiGitBranch, FiStar, FiAward,
} from "react-icons/fi";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";

type Member = {
  name: string;
  role: string;
  initials: string;
  /** Optional headshot. Drop a square image into /public/team/<file>.jpg
   *  and set `photo: "/team/<file>.jpg"`. If omitted, a gradient + initials
   *  fallback is rendered automatically. */
  photo?: string;
  bio?: string;        // 1-line — shows on hover overlay
  tags?: string[];     // chips at the bottom
  linkedin?: string;
};

// Founder + 7 teammates. Photos & LinkedIn URLs to be filled in by the team.
const TEAM: Member[] = [
  {
    name: "Ramya CM",
    role: "Founder & CEO",
    initials: "RC",
    bio: "Building the platform she wished existed in college.",
    tags: ["Founder", "Product", "Open source"],
    linkedin: "https://www.linkedin.com/in/ramya-cm",
  },
  {
    name: "Co-founder",
    role: "Engineering",
    initials: "CO",
    bio: "Architecting the AI flow end-to-end.",
    tags: ["Architecture", "Backend"],
  },
  {
    name: "Teammate",
    role: "Product Design",
    initials: "PD",
    bio: "Turning AI complexity into a calm interface.",
    tags: ["UX", "Design systems"],
  },
  {
    name: "Teammate",
    role: "AI / ML",
    initials: "AI",
    bio: "Tunes the models that read your codebase.",
    tags: ["LLMs", "Embeddings"],
  },
  {
    name: "Teammate",
    role: "Frontend",
    initials: "FE",
    bio: "Crafts the experience pixel by pixel.",
    tags: ["Next.js", "Motion"],
  },
  {
    name: "Teammate",
    role: "Backend",
    initials: "BE",
    bio: "Keeps the API fast, safe, and boring.",
    tags: ["FastAPI", "Postgres"],
  },
  {
    name: "Teammate",
    role: "DevRel",
    initials: "DR",
    bio: "Talks to maintainers and contributors all day.",
    tags: ["Community", "Docs"],
  },
  {
    name: "Teammate",
    role: "Growth",
    initials: "GR",
    bio: "Helps the next 10,000 students find us.",
    tags: ["Marketing", "Partnerships"],
  },
];

const VALUES = [
  { icon: <FiTarget size={18} />, title: "Lower the barrier",        desc: "Open source should welcome everyone — not just those who already know the conventions." },
  { icon: <FiZap size={18} />,    title: "AI as a guide, not a crutch", desc: "We use AI to teach, explain, and unblock — so contributors actually learn the craft." },
  { icon: <FiUsers size={18} />,  title: "Built with students",       desc: "Born inside VIT Chennai. Every feature is shaped by feedback from real student contributors." },
  { icon: <FiHeart size={18} />,  title: "Ship something real",       desc: "We measure success in merged PRs, not tutorials watched. Your name on a real project, every time." },
];

const STATS = [
  { value: "VIT", label: "Chennai",      icon: <FiMapPin size={14} /> },
  { value: "8",   label: "Builders",     icon: <FiUsers size={14} /> },
  { value: "AI",  label: "First-class",  icon: <FiZap size={14} /> },
  { value: "OSS", label: "By default",   icon: <FiGitBranch size={14} /> },
];

const TIMELINE = [
  { year: "2025", title: "The dorm-room idea",          desc: "Ramya & friends start sketching what an AI contribution coach would feel like." },
  { year: "2025", title: "First fork → first merged PR", desc: "Internal prototype guides a classmate through their very first open source contribution." },
  { year: "2026", title: "OpenSourceMate goes live",     desc: "Public launch with AI analysis, automated PR flow, and the contributor Arena." },
  { year: "Now",  title: "Building with the community",  desc: "Onboarding more students, listening hard, shipping every week." },
];

function TeamCard({ m, idx }: { m: Member; idx: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.45, delay: Math.min(idx * 0.05, 0.4) }}
      className="group relative rounded-2xl border border-border bg-surface/40 backdrop-blur-sm overflow-hidden hover:border-crimson/40 transition-all hover:-translate-y-1"
    >
      {/* PHOTO AREA — square portrait, photo or gradient+initials fallback */}
      <div className="relative aspect-square w-full overflow-hidden bg-gradient-to-br from-crimson/30 via-crimson/10 to-background">
        {m.photo ? (
          <Image
            src={m.photo}
            alt={m.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <>
            {/* Animated mesh background */}
            <div className="absolute inset-0 opacity-90">
              <div className="absolute -top-1/4 -left-1/4 w-2/3 h-2/3 bg-crimson/30 rounded-full blur-3xl" />
              <div className="absolute -bottom-1/4 -right-1/4 w-2/3 h-2/3 bg-crimson/15 rounded-full blur-3xl" />
            </div>
            <div className="absolute inset-0 grid-bg opacity-40" />
            <div className="relative w-full h-full flex items-center justify-center">
              <span className="text-white/95 font-semibold tracking-tight text-5xl drop-shadow-lg">
                {m.initials}
              </span>
            </div>
          </>
        )}

        {/* Top-left number tag */}
        <div className="absolute top-3 left-3 text-[10px] font-mono tracking-[0.2em] text-white/85 bg-black/40 backdrop-blur-md border border-white/15 rounded-md px-2 py-1">
          {String(idx + 1).padStart(2, "0")}
        </div>

        {/* LinkedIn pin — top-right */}
        {m.linkedin ? (
          <a
            href={m.linkedin}
            target="_blank"
            rel="noreferrer"
            aria-label={`${m.name} on LinkedIn`}
            className="absolute top-3 right-3 w-9 h-9 rounded-lg bg-black/45 backdrop-blur-md border border-white/15 hover:bg-crimson hover:border-crimson text-white flex items-center justify-center transition-all"
          >
            <FiLinkedin size={15} />
          </a>
        ) : (
          <span
            aria-label="LinkedIn — coming soon"
            className="absolute top-3 right-3 w-9 h-9 rounded-lg bg-black/30 backdrop-blur-md border border-white/10 text-white/40 flex items-center justify-center cursor-not-allowed"
          >
            <FiLinkedin size={15} />
          </span>
        )}

        {/* Bio overlay — slides up on hover */}
        {m.bio && (
          <div className="absolute inset-x-0 bottom-0 translate-y-full group-hover:translate-y-0 transition-transform duration-300 bg-gradient-to-t from-black/85 via-black/70 to-transparent p-4">
            <p className="text-[12.5px] text-white/95 leading-relaxed">{m.bio}</p>
          </div>
        )}
      </div>

      {/* TEXT BLOCK */}
      <div className="p-5">
        <div className="flex items-baseline justify-between gap-3 mb-1">
          <div className="text-white font-semibold text-[15px] tracking-tight truncate">
            {m.name}
          </div>
          {idx === 0 && (
            <span className="text-[10px] uppercase tracking-[0.16em] text-crimson font-mono shrink-0">
              Founder
            </span>
          )}
        </div>
        <div className="text-muted-foreground text-xs">{m.role}</div>

        {m.tags && m.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {m.tags.map((t) => (
              <span
                key={t}
                className="text-[10.5px] tracking-wide px-2 py-0.5 rounded-full border border-border/80 text-muted-foreground/90 bg-background/40"
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col relative">
      {/* Background layers */}
      <div className="fixed inset-0 grid-bg opacity-70 pointer-events-none" />
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-crimson/10 rounded-full blur-[120px] pointer-events-none" />

      <SiteHeader />

      <main className="flex-1 relative z-10">
        {/* HERO */}
        <section className="px-6 pt-16 pb-10 md:pt-20 md:pb-14 max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
            className="text-center"
          >
            <div className="inline-flex items-center gap-2 text-xs bg-crimson-muted text-crimson border border-crimson/25 rounded-full px-4 py-1.5 mb-7 font-mono backdrop-blur-sm">
              <FiCompass size={12} /> About OpenSourceMate
            </div>
            <h1 className="text-4xl md:text-6xl font-semibold tracking-tight mb-5 leading-[1.05]">
              We&apos;re making open source <br className="hidden md:block" />
              <span className="text-crimson text-glow">work for everyone.</span>
            </h1>
            <p className="text-muted-foreground text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
              An AI-guided contribution platform — built so students and developers
              can ship meaningful open source work without getting stuck on setup,
              conventions, or context.
            </p>
          </motion.div>

          {/* STATS STRIP */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.15 }}
            className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-3"
          >
            {STATS.map((s) => (
              <div
                key={s.label}
                className="rounded-xl border border-border bg-surface/40 backdrop-blur-sm px-5 py-4 flex items-center gap-3"
              >
                <span className="w-9 h-9 rounded-lg bg-crimson/15 border border-crimson/30 text-crimson flex items-center justify-center shrink-0">
                  {s.icon}
                </span>
                <div className="min-w-0">
                  <div className="text-white font-semibold text-lg leading-none tracking-tight">
                    {s.value}
                  </div>
                  <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground/80 mt-1.5">
                    {s.label}
                  </div>
                </div>
              </div>
            ))}
          </motion.div>
        </section>

        {/* MISSION QUOTE */}
        <section className="px-6 pb-14 max-w-5xl mx-auto">
          <motion.figure
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5 }}
            className="relative rounded-2xl border border-border bg-surface/40 backdrop-blur-sm p-8 md:p-12 overflow-hidden text-center"
          >
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[420px] h-[420px] bg-crimson/15 rounded-full blur-3xl pointer-events-none" />
            <span className="relative inline-block text-7xl md:text-8xl text-crimson/35 leading-none font-serif select-none">
              &ldquo;
            </span>
            <blockquote className="relative -mt-4 text-xl md:text-2xl font-medium tracking-tight text-white leading-snug max-w-3xl mx-auto">
              We want every student, anywhere in the world, to ship their{" "}
              <span className="text-crimson">first real pull request</span> — and
              keep shipping after that.
            </blockquote>
            <figcaption className="relative mt-6 text-sm text-muted-foreground">
              <span className="text-white/85 font-medium">Ramya CM</span> · Founder, OpenSourceMate
            </figcaption>
          </motion.figure>
        </section>

        {/* STORY */}
        <section className="px-6 pb-14 max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5 }}
            className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start"
          >
            <div className="md:col-span-4">
              <div className="text-[11px] uppercase tracking-[0.2em] text-crimson font-mono mb-3">
                Our story
              </div>
              <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-white leading-tight mb-4">
                Born inside a VIT Chennai dorm room.
              </h2>
              <div className="inline-flex items-center gap-2 text-xs text-muted-foreground border border-border rounded-full px-3 py-1.5 bg-background/40">
                <FiMapPin size={12} className="text-crimson" />
                VIT University, Chennai · India
              </div>
            </div>

            <div className="md:col-span-8 space-y-4 text-muted-foreground text-[15px] leading-relaxed">
              <p>
                OpenSourceMate was founded by{" "}
                <span className="text-white font-medium">Ramya CM</span> and her
                friends at VIT College, Chennai — after watching brilliant
                classmates abandon open source contributions because the first 10%
                (forking, branching, understanding the codebase, writing the right
                kind of PR) felt impossibly steep.
              </p>
              <p>
                We&apos;re building the platform we wish we had on day one: paste
                any issue, error, or merge conflict — and get an AI guide that
                explains the codebase, drafts a clean fix, opens the pull request,
                and keeps tracking it until it gets merged.
              </p>
              <p className="text-white/85">
                Our ambition is simple — make open source contribution{" "}
                <span className="text-crimson">seamless</span> for every student
                and every developer, anywhere in the world.
              </p>
            </div>
          </motion.div>
        </section>

        {/* TIMELINE */}
        <section className="px-6 pb-16 max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <div className="text-[11px] uppercase tracking-[0.2em] text-crimson font-mono mb-2">
              The journey
            </div>
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-white">
              From idea to platform
            </h2>
          </div>

          <ol className="relative">
            {/* vertical rail */}
            <span className="absolute left-[15px] md:left-1/2 md:-translate-x-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-crimson/50 via-border to-transparent pointer-events-none" />

            {TIMELINE.map((t, i) => (
              <motion.li
                key={t.title}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.45, delay: i * 0.08 }}
                className="relative pl-12 md:pl-0 md:grid md:grid-cols-2 md:gap-10 mb-8 last:mb-0"
              >
                {/* dot */}
                <span className="absolute left-[8px] md:left-1/2 md:-translate-x-1/2 top-1.5 w-4 h-4 rounded-full bg-crimson ring-4 ring-background shadow-[0_0_0_2px_rgba(217,119,87,0.4)]" />

                <div className={`md:px-1 ${i % 2 === 0 ? "md:text-right md:pr-10" : "md:order-2 md:pl-10"}`}>
                  <div className="text-[11px] font-mono tracking-[0.2em] text-crimson mb-1">
                    {t.year}
                  </div>
                  <div className="text-white font-semibold text-[16px] tracking-tight">
                    {t.title}
                  </div>
                </div>
                <div className={`md:px-1 mt-1 md:mt-0 ${i % 2 === 0 ? "md:pl-10" : "md:order-1 md:text-right md:pr-10"}`}>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {t.desc}
                  </p>
                </div>
              </motion.li>
            ))}
          </ol>
        </section>

        {/* VALUES */}
        <section className="px-6 pb-14 max-w-6xl mx-auto">
          <div className="text-center mb-9">
            <div className="text-[11px] uppercase tracking-[0.2em] text-crimson font-mono mb-2">
              What we believe
            </div>
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-white">
              Principles that shape every feature
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {VALUES.map((v, i) => (
              <motion.div
                key={v.title}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.45, delay: i * 0.05 }}
                className="rounded-2xl border border-border bg-surface/40 backdrop-blur-sm p-5 hover:border-crimson/40 transition-all"
              >
                <span className="inline-flex w-9 h-9 rounded-lg bg-crimson/15 border border-crimson/30 items-center justify-center text-crimson mb-3">
                  {v.icon}
                </span>
                <div className="text-white font-medium text-[14px] tracking-tight mb-1.5">
                  {v.title}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {v.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* TEAM */}
        <section className="px-6 pb-16 max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10">
            <div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-crimson font-mono mb-2">
                The team
              </div>
              <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-white">
                Builders, students, contributors.
              </h2>
              <p className="text-muted-foreground text-sm max-w-xl leading-relaxed mt-2">
                A small, focused team shipping fast — with deep roots in the
                student developer community.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 text-xs text-muted-foreground border border-border rounded-full px-3 py-1.5 bg-background/40 self-start md:self-auto">
              <FiAward size={12} className="text-crimson" />
              {TEAM.length} people on a mission
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {TEAM.map((m, i) => (
              <TeamCard key={`${m.name}-${i}`} m={m} idx={i} />
            ))}
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground/80">
            Hover any card to read what they do · LinkedIn opens in a new tab.
          </p>
        </section>

        {/* CTA */}
        <section className="px-6 pb-20 max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5 }}
            className="relative rounded-2xl border border-crimson/25 bg-gradient-to-br from-crimson/10 via-surface/40 to-surface/40 backdrop-blur-sm p-8 md:p-10 text-center overflow-hidden"
          >
            <div className="absolute -top-20 -right-20 w-64 h-64 bg-crimson/20 rounded-full blur-3xl pointer-events-none" />
            <FiStar className="relative mx-auto mb-4 text-crimson" size={22} />
            <h2 className="relative text-2xl md:text-3xl font-semibold tracking-tight text-white mb-3">
              Want to build the future of open source with us?
            </h2>
            <p className="relative text-muted-foreground max-w-md mx-auto mb-7 leading-relaxed">
              Get in touch — we&apos;re always happy to hear from contributors,
              maintainers, students, and partners.
            </p>
            <a
              href="/contact"
              className="relative inline-flex items-center gap-2 bg-crimson hover:bg-crimson-dark text-white px-6 py-3 rounded-lg font-medium transition-all glow-crimson hover:-translate-y-0.5"
            >
              Get in touch <FiArrowRight />
            </a>
          </motion.div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
