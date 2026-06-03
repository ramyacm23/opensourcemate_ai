"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  FiUser, FiMail, FiPhone, FiGlobe, FiLinkedin, FiGithub,
  FiMapPin, FiEdit2, FiCheck, FiX, FiUpload, FiTrash2,
  FiCamera, FiLoader,
} from "react-icons/fi";
import { api, resolveAvatar } from "@/lib/api";
import { Badge } from "@/components/ui/badge";

interface User {
  id: number;
  email: string;
  name?: string;
  mobile?: string;
  user_type?: "Freelancer" | "Student" | "Enterprise";
  website?: string;
  linkedin?: string;
  bio?: string;
  location?: string;
  avatar_url?: string;
  github_username?: string;
  github_avatar_url?: string;
  onboarding_completed: boolean;
}

const typeColor: Record<string, string> = {
  Freelancer: "bg-crimson/15 text-crimson border-crimson/30",
  Student: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  Enterprise: "bg-purple-500/15 text-purple-400 border-purple-500/30",
};

export default function ProfilePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "", mobile: "", user_type: "Freelancer" as User["user_type"],
    website: "", linkedin: "", bio: "", location: "",
  });

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { router.push("/login"); return; }
    api.getProfile(token)
      .then((u: User) => {
        setUser(u);
        setForm({
          name: u.name || "",
          mobile: u.mobile || "",
          user_type: u.user_type || "Freelancer",
          website: u.website || "",
          linkedin: u.linkedin || "",
          bio: u.bio || "",
          location: u.location || "",
        });
      })
      .catch(() => router.push("/login"))
      .finally(() => setLoading(false));
  }, [router]);

  function flash(setter: (s: string | null) => void, msg: string) {
    setter(msg);
    setTimeout(() => setter(null), 3000);
  }

  async function handleSave() {
    const token = localStorage.getItem("token");
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      const updated: User = await api.updateProfile(form, token);
      setUser(updated);
      setEditing(false);
      flash(setSuccess, "Profile saved");
    } catch (e) {
      flash(setError, e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    if (!user) return;
    setForm({
      name: user.name || "",
      mobile: user.mobile || "",
      user_type: user.user_type || "Freelancer",
      website: user.website || "",
      linkedin: user.linkedin || "",
      bio: user.bio || "",
      location: user.location || "",
    });
    setEditing(false);
    setError(null);
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const token = localStorage.getItem("token");
    if (!token) return;

    if (file.size > 5 * 1024 * 1024) {
      flash(setError, "File too large (max 5MB)");
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const updated: User = await api.uploadAvatar(file, token);
      setUser(updated);
      flash(setSuccess, "Avatar updated");
    } catch (err) {
      flash(setError, err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleAvatarDelete() {
    const token = localStorage.getItem("token");
    if (!token) return;
    setUploading(true);
    try {
      const updated: User = await api.deleteAvatar(token);
      setUser(updated);
      flash(setSuccess, "Avatar removed");
    } catch (err) {
      flash(setError, err instanceof Error ? err.message : "Delete failed");
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <FiLoader className="animate-spin text-crimson" size={28} />
      </div>
    );
  }

  if (!user) return null;

  const initial = (user.name || user.email).charAt(0).toUpperCase();
  // Prefer uploaded avatar, fall back to GitHub avatar.
  const avatarSrc = resolveAvatar(user.avatar_url) || user.github_avatar_url || null;

  return (
    <div className="max-w-5xl mx-auto px-3 md:px-6">

        {(error || success) && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className={`mb-6 px-4 py-3 rounded-lg border text-sm flex items-center gap-2 ${
              error
                ? "bg-red-500/10 border-red-500/30 text-red-300"
                : "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
            }`}
          >
            {error ? <FiX size={14} /> : <FiCheck size={14} />}
            {error || success}
          </motion.div>
        )}

        {/* Avatar + identity card */}
        <motion.section
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          className="bg-surface border border-border rounded-2xl p-6 md:p-8 mb-5"
        >
          <div className="flex flex-col md:flex-row md:items-start gap-6">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="w-28 h-28 rounded-2xl overflow-hidden border-2 border-border bg-crimson/10 flex items-center justify-center text-crimson text-4xl font-semibold relative">
                {avatarSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarSrc} alt={user.name || user.email} className="w-full h-full object-cover" />
                ) : (
                  initial
                )}
                {uploading && (
                  <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                    <FiLoader className="animate-spin text-crimson" size={20} />
                  </div>
                )}
              </div>

              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                title="Upload new avatar"
                className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-crimson hover:bg-crimson-dark text-white border-2 border-background flex items-center justify-center transition-all disabled:opacity-50 glow-crimson"
              >
                <FiCamera size={14} />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={handleAvatarUpload}
                className="hidden"
              />
            </div>

            {/* Identity */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
                    {user.name || "Unnamed contributor"}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
                    <FiMail size={12} /> {user.email}
                  </p>
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    {user.user_type && (
                      <Badge className={`text-[11px] border ${typeColor[user.user_type]}`}>
                        {user.user_type}
                      </Badge>
                    )}
                    {user.location && (
                      <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                        <FiMapPin size={11} /> {user.location}
                      </span>
                    )}
                    {user.github_username && (
                      <a
                        href={`https://github.com/${user.github_username}`}
                        target="_blank" rel="noreferrer"
                        className="text-xs text-muted-foreground hover:text-crimson transition-colors inline-flex items-center gap-1"
                      >
                        <FiGithub size={11} /> @{user.github_username}
                      </a>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 flex-wrap">
                  {user.avatar_url && (
                    <button
                      onClick={handleAvatarDelete}
                      disabled={uploading}
                      className="text-xs px-3 h-8 rounded-md border border-border hover:border-red-400/40 hover:text-red-400 transition-all inline-flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <FiTrash2 size={11} /> Remove photo
                    </button>
                  )}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="text-xs px-3 h-8 rounded-md border border-border hover:border-crimson/40 hover:text-crimson transition-all inline-flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <FiUpload size={11} /> {user.avatar_url ? "Change photo" : "Upload photo"}
                  </button>
                </div>
              </div>

              {user.bio && !editing && (
                <p className="text-sm text-muted-foreground mt-4 leading-relaxed">{user.bio}</p>
              )}
            </div>
          </div>
        </motion.section>

        {/* Details card */}
        <motion.section
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-surface border border-border rounded-2xl overflow-hidden"
        >
          <header className="flex items-center justify-between px-6 py-4 border-b border-border">
            <div>
              <h2 className="text-sm font-semibold">Profile details</h2>
              <p className="text-[11.5px] text-muted-foreground">Public-facing info shown on your contributor card</p>
            </div>
            {!editing ? (
              <button
                onClick={() => setEditing(true)}
                className="text-xs px-3 h-8 rounded-md bg-crimson hover:bg-crimson-dark text-white inline-flex items-center gap-1.5 transition-all"
              >
                <FiEdit2 size={11} /> Edit
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={handleCancel}
                  disabled={saving}
                  className="text-xs px-3 h-8 rounded-md border border-border hover:border-red-400/40 hover:text-red-400 transition-all inline-flex items-center gap-1.5 disabled:opacity-50"
                >
                  <FiX size={11} /> Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="text-xs px-3 h-8 rounded-md bg-crimson hover:bg-crimson-dark text-white inline-flex items-center gap-1.5 transition-all disabled:opacity-50"
                >
                  {saving ? <FiLoader className="animate-spin" size={11} /> : <FiCheck size={11} />}
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </div>
            )}
          </header>

          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
            <Field
              label="Full name" icon={<FiUser size={12} />}
              editing={editing} value={form.name}
              display={user.name}
              onChange={v => setForm(f => ({ ...f, name: v }))}
              placeholder="Your full name"
            />

            <Field
              label="Mobile" icon={<FiPhone size={12} />}
              editing={editing} value={form.mobile}
              display={user.mobile}
              onChange={v => setForm(f => ({ ...f, mobile: v }))}
              placeholder="+91 9XXXXXXXXX"
            />

            <div>
              <label className="text-[11.5px] uppercase tracking-wider text-muted-foreground font-mono flex items-center gap-1.5 mb-1.5">
                <FiUser size={12} /> Account type
              </label>
              {editing ? (
                <select
                  value={form.user_type}
                  onChange={e => setForm(f => ({ ...f, user_type: e.target.value as User["user_type"] }))}
                  className="w-full bg-background border border-border rounded-lg px-3 h-10 text-sm focus:outline-none focus:border-crimson/50 focus:ring-2 focus:ring-crimson/15 transition-all"
                >
                  <option value="Freelancer">Freelancer</option>
                  <option value="Student">Student</option>
                  <option value="Enterprise">Enterprise</option>
                </select>
              ) : (
                <p className="text-sm text-white">{user.user_type || <span className="text-muted-foreground">—</span>}</p>
              )}
            </div>

            <Field
              label="Location" icon={<FiMapPin size={12} />}
              editing={editing} value={form.location}
              display={user.location}
              onChange={v => setForm(f => ({ ...f, location: v }))}
              placeholder="City, Country"
            />

            <Field
              label="Website" icon={<FiGlobe size={12} />}
              editing={editing} value={form.website}
              display={user.website}
              onChange={v => setForm(f => ({ ...f, website: v }))}
              placeholder="https://yoursite.com"
              isLink
            />

            <Field
              label="LinkedIn" icon={<FiLinkedin size={12} />}
              editing={editing} value={form.linkedin}
              display={user.linkedin}
              onChange={v => setForm(f => ({ ...f, linkedin: v }))}
              placeholder="https://linkedin.com/in/you"
              isLink
            />

            <div className="md:col-span-2">
              <label className="text-[11.5px] uppercase tracking-wider text-muted-foreground font-mono flex items-center gap-1.5 mb-1.5">
                <FiEdit2 size={12} /> Bio
              </label>
              {editing ? (
                <textarea
                  value={form.bio}
                  onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
                  placeholder="Tell the community about yourself, your stack, what you love to ship…"
                  maxLength={500}
                  rows={4}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-crimson/50 focus:ring-2 focus:ring-crimson/15 transition-all resize-none"
                />
              ) : (
                <p className="text-sm text-white leading-relaxed whitespace-pre-wrap">
                  {user.bio || <span className="text-muted-foreground">No bio yet — click Edit to add one.</span>}
                </p>
              )}
              {editing && (
                <p className="text-[10.5px] text-muted-foreground mt-1 text-right font-mono">
                  {form.bio.length}/500
                </p>
              )}
            </div>
          </div>
        </motion.section>
    </div>
  );
}

function Field({
  label, icon, editing, value, display, onChange, placeholder, isLink,
}: {
  label: string;
  icon: React.ReactNode;
  editing: boolean;
  value: string;
  display?: string;
  onChange: (v: string) => void;
  placeholder?: string;
  isLink?: boolean;
}) {
  return (
    <div>
      <label className="text-[11.5px] uppercase tracking-wider text-muted-foreground font-mono flex items-center gap-1.5 mb-1.5">
        {icon} {label}
      </label>
      {editing ? (
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-background border border-border rounded-lg px-3 h-10 text-sm focus:outline-none focus:border-crimson/50 focus:ring-2 focus:ring-crimson/15 transition-all"
        />
      ) : display ? (
        isLink ? (
          <a href={display} target="_blank" rel="noreferrer" className="text-sm text-crimson hover:underline truncate block">
            {display}
          </a>
        ) : (
          <p className="text-sm text-white">{display}</p>
        )
      ) : (
        <p className="text-sm text-muted-foreground">—</p>
      )}
    </div>
  );
}
