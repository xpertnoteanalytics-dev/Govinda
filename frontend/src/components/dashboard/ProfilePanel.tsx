// src/components/dashboard/ProfilePanel.tsx
"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/components/auth/AuthProvider";
import { RoleBadge } from "@/components/auth/RoleBadge";
import { AnimatedCard, FadeIn } from "@/components/ui/motion";
import { CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import type { AuthUser } from "@/lib/auth";
import { Building2, Mail, User, CheckCircle2, AlertCircle, Upload, X } from "lucide-react";

export function ProfilePanel({ initialUser }: { initialUser: AuthUser | null }) {
  const { user: contextUser, refreshUser } = useAuth();
  const user = contextUser ?? initialUser;

  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [logoPreview, setLogoPreview] = useState<string | null>(user?.tenant.logo ?? null);
  const [logoLoading, setLogoLoading] = useState(false);
  const [logoMessage, setLogoMessage] = useState("");
  const [logoError, setLogoError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      setFirstName(user.firstName);
      setLastName(user.lastName);
      setLogoPreview(user.tenant.logo ?? null);
    }
  }, [user]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    setIsLoading(true);
    try {
      await apiFetch<{ user: AuthUser }>("/v1/profile", {
        method: "PATCH",
        body: JSON.stringify({ firstName, lastName }),
      });
      await refreshUser();
      setMessage("Profile updated successfully");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setIsLoading(false);
    }
  }

  function handleLogoFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setLogoError("Please upload an image file");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setLogoError("Image must be under 2MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      setLogoPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  }

  async function handleLogoUpload() {
    if (!logoPreview) return;
    setLogoLoading(true);
    setLogoError("");
    setLogoMessage("");
    try {
      await apiFetch("/v1/organization", {
        method: "PATCH",
        body: JSON.stringify({ logo: logoPreview }),
      });
      await refreshUser();
      setLogoMessage("Logo updated successfully");
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setLogoLoading(false);
    }
  }

  async function handleLogoRemove() {
    setLogoLoading(true);
    setLogoError("");
    try {
      await apiFetch("/v1/organization", {
        method: "PATCH",
        body: JSON.stringify({ logo: null }),
      });
      setLogoPreview(null);
      await refreshUser();
      setLogoMessage("Logo removed");
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : "Failed to remove");
    } finally {
      setLogoLoading(false);
    }
  }

  if (!user) {
    return (
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800/50 p-6 text-sm text-ink-muted animate-pulse">
        Loading profile…
      </div>
    );
  }

  const initials = `${user.firstName[0]}${user.lastName[0]}`;

  return (
    <FadeIn className="space-y-6">

      {/* Hero card */}
      <AnimatedCard>
        <div className="relative overflow-hidden">
          <div className="pointer-events-none absolute -right-8 -top-8 h-36 w-36 rounded-full bg-teal-400/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-6 -left-6 h-28 w-28 rounded-full bg-emerald-400/10 blur-2xl" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">

            {/* User initials avatar */}
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative flex-shrink-0">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-2xl font-bold text-white shadow-elevated ring-4 ring-white/10 dark:ring-white/5">
                {initials}
              </div>
              <span className="absolute bottom-0.5 right-0.5 h-4 w-4 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900 shadow-sm" />
            </motion.div>

            {/* User info */}
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-ink dark:text-white truncate">
                {user.firstName} {user.lastName}
              </h2>
              <p className="text-sm text-ink-muted dark:text-slate-400 mt-0.5">{user.email}</p>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <RoleBadge role={user.role} />
                {/* ✅ Org logo + name badge */}
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 dark:bg-white/10 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                  {user.tenant.logo ? (
                    <img src={user.tenant.logo} alt="" className="h-3.5 w-3.5 rounded object-cover" />
                  ) : (
                    <Building2 className="h-3 w-3" />
                  )}
                  {user.tenant.name}
                </span>
              </div>
            </div>
          </div>
        </div>
      </AnimatedCard>

      <div className="grid gap-6 lg:grid-cols-2">

        {/* Edit profile */}
        <AnimatedCard index={1}>
          <CardHeader className="p-0 pb-5 border-b border-slate-100 dark:border-white/10">
            <CardTitle className="text-base font-semibold text-ink dark:text-white">Edit profile</CardTitle>
            <CardDescription className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
              Update your personal information
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            {error && (
              <div className="flex items-start gap-2.5 rounded-xl border border-red-200 dark:border-red-800/60 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-600 dark:text-red-400">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />{error}
              </div>
            )}
            {message && (
              <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />{message}
              </div>
            )}
            <Input label="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
            <Input label="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
            <div className="pt-1">
              <Button type="submit" isLoading={isLoading}>Save changes</Button>
            </div>
          </form>
        </AnimatedCard>

        {/* Account details */}
        <AnimatedCard index={2}>
          <CardHeader className="p-0 pb-5 border-b border-slate-100 dark:border-white/10">
            <CardTitle className="text-base font-semibold text-ink dark:text-white">Account details</CardTitle>
            <CardDescription className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
              Organization and access information
            </CardDescription>
          </CardHeader>
          <dl className="mt-5 space-y-1">
            <div className="flex items-center gap-3 rounded-xl p-3 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400">
                <Mail className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <dt className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">Email</dt>
                <dd className="text-sm font-medium text-ink dark:text-slate-200 truncate">{user.email}</dd>
              </div>
            </div>

            {/* ✅ Org with logo */}
            <div className="flex items-center gap-3 rounded-xl p-3 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-white/10 overflow-hidden">
                {user.tenant.logo ? (
                  <img src={user.tenant.logo} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Building2 className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                )}
              </div>
              <div className="min-w-0">
                <dt className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">Organization</dt>
                <dd className="text-sm font-medium text-ink dark:text-white">{user.tenant.name}</dd>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl p-3 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400">
                <User className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <dt className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">Plan</dt>
                <dd className="text-sm font-medium capitalize text-ink dark:text-slate-200">{user.tenant.plan}</dd>
              </div>
            </div>
          </dl>
        </AnimatedCard>

        {/* ✅ Organization Logo Upload */}
        <AnimatedCard index={3} className="lg:col-span-2">
          <CardHeader className="p-0 pb-5 border-b border-slate-100 dark:border-white/10">
            <CardTitle className="text-base font-semibold text-ink dark:text-white">Organization Logo</CardTitle>
            <CardDescription className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
              Upload your organization logo. Shown in sidebar and profile.
            </CardDescription>
          </CardHeader>

          <div className="mt-5 flex flex-col sm:flex-row items-start gap-6">
            {/* Preview */}
            <div
              className="h-24 w-24 rounded-2xl border-2 border-dashed border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 flex items-center justify-center overflow-hidden cursor-pointer hover:border-brand-400/50 transition-colors shrink-0"
              onClick={() => fileRef.current?.click()}
            >
              {logoPreview ? (
                <img src={logoPreview} alt="Logo preview" className="h-full w-full object-cover rounded-2xl" />
              ) : (
                <div className="text-center">
                  <Building2 className="h-8 w-8 text-slate-300 dark:text-slate-600 mx-auto" />
                  <p className="text-xs text-slate-400 mt-1">Logo</p>
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="flex-1 space-y-3">
              {logoError && (
                <div className="flex items-center gap-2 rounded-xl border border-red-200 dark:border-red-800/60 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-xs text-red-600 dark:text-red-400">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />{logoError}
                </div>
              )}
              {logoMessage && (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />{logoMessage}
                </div>
              )}
              <p className="text-xs text-slate-500 dark:text-slate-400">
                PNG, JPG, or SVG. Max 2MB. Click logo or button to upload.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-2 text-sm font-medium text-ink dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/10 transition-colors"
                >
                  <Upload className="h-4 w-4" /> Choose Image
                </button>
                {logoPreview && logoPreview !== user.tenant.logo && (
                  <button
                    type="button"
                    onClick={handleLogoUpload}
                    disabled={logoLoading}
                    className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50 transition-colors"
                  >
                    {logoLoading ? "Saving..." : "Save Logo"}
                  </button>
                )}
                {user.tenant.logo && (
                  <button
                    type="button"
                    onClick={handleLogoRemove}
                    disabled={logoLoading}
                    className="inline-flex items-center gap-2 rounded-xl border border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-900/20 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 disabled:opacity-50 transition-colors"
                  >
                    <X className="h-4 w-4" /> Remove
                  </button>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleLogoFile(file);
                }}
              />
            </div>
          </div>
        </AnimatedCard>

      </div>
    </FadeIn>
  );
}