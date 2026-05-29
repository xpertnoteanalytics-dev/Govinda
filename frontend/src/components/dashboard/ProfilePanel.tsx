"use client";

import { FormEvent, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/components/auth/AuthProvider";
import { RoleBadge } from "@/components/auth/RoleBadge";
import { AnimatedCard, FadeIn } from "@/components/ui/motion";
import { CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import type { AuthUser } from "@/lib/auth";
import { Building2, Mail, User, CheckCircle2, AlertCircle } from "lucide-react";

export function ProfilePanel({ initialUser }: { initialUser: AuthUser | null }) {
  const { user: contextUser, refreshUser } = useAuth();
  const user = contextUser ?? initialUser;

  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setFirstName(user.firstName);
      setLastName(user.lastName);
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

      {/* ── Avatar hero card ── */}
      <AnimatedCard>
        <div className="relative overflow-hidden">
          {/* Ambient glow */}
          <div className="pointer-events-none absolute -right-8 -top-8 h-36 w-36 rounded-full bg-teal-400/10 dark:bg-teal-400/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-6 -left-6 h-28 w-28 rounded-full bg-emerald-400/10 blur-2xl" />

          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
            {/* Avatar */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="relative flex-shrink-0"
            >
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-2xl font-bold text-white shadow-elevated ring-4 ring-white/10 dark:ring-white/5">
                {initials}
              </div>
              {/* Online dot */}
              <span className="absolute bottom-0.5 right-0.5 h-4 w-4 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900 shadow-sm" />
            </motion.div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-ink dark:text-white truncate">
                {user.firstName} {user.lastName}
              </h2>
              <p className="text-sm text-ink-muted dark:text-slate-400 mt-0.5">{user.email}</p>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <RoleBadge role={user.role} />
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 dark:bg-white/10 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                  <Building2 className="h-3 w-3" />
                  {user.tenant.name}
                </span>
              </div>
            </div>
          </div>
        </div>
      </AnimatedCard>

      {/* ── Two-column grid ── */}
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
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                {error}
              </div>
            )}
            {message && (
              <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
                {message}
              </div>
            )}

            <Input
              label="First name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
            />
            <Input
              label="Last name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
            />

            <div className="pt-1">
              <Button type="submit" isLoading={isLoading}>
                Save changes
              </Button>
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
            {/* Email row */}
            <div className="flex items-center gap-3 rounded-xl p-3 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400">
                <Mail className="h-4 w-4" aria-hidden />
              </div>
              <div className="min-w-0">
                <dt className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                  Email
                </dt>
                <dd className="text-sm font-medium text-ink dark:text-slate-200 truncate">{user.email}</dd>
              </div>
            </div>

            {/* Organization row */}
            <div className="flex items-center gap-3 rounded-xl p-3 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400">
                <Building2 className="h-4 w-4" aria-hidden />
              </div>
              <div className="min-w-0">
                <dt className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                  Organization
                </dt>
                <dd className="text-sm font-medium text-ink dark:text-white">{user.tenant.name}</dd>
              </div>
            </div>

            {/* Plan row */}
            <div className="flex items-center gap-3 rounded-xl p-3 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400">
                <User className="h-4 w-4" aria-hidden />
              </div>
              <div className="min-w-0">
                <dt className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                  Plan
                </dt>
                <dd className="text-sm font-medium capitalize text-ink dark:text-slate-200">
                  {user.tenant.plan}
                </dd>
              </div>
            </div>
          </dl>
        </AnimatedCard>

      </div>
    </FadeIn>
  );
}