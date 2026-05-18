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
import { Building2, Mail, User } from "lucide-react";

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
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-ink-muted">
        Loading profile…
      </div>
    );
  }

  return (
    <FadeIn className="space-y-6">
      <AnimatedCard>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-2xl font-bold text-white shadow-elevated"
          >
            {user.firstName[0]}
            {user.lastName[0]}
          </motion.div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-ink">
              {user.firstName} {user.lastName}
            </h2>
            <p className="text-sm text-ink-muted">{user.email}</p>
            <div className="mt-2">
              <RoleBadge role={user.role} />
            </div>
          </div>
        </div>
      </AnimatedCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <AnimatedCard index={1}>
          <CardHeader className="p-0">
            <CardTitle>Edit profile</CardTitle>
            <CardDescription>Update your personal information</CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-clinical-danger">
                {error}
              </div>
            )}
            {message && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-clinical-success">
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

            <Button type="submit" isLoading={isLoading}>
              Save changes
            </Button>
          </form>
        </AnimatedCard>

        <AnimatedCard index={2}>
          <CardHeader className="p-0">
            <CardTitle>Account details</CardTitle>
            <CardDescription>Organization and access information</CardDescription>
          </CardHeader>

          <dl className="mt-6 space-y-4">
            <div className="flex items-start gap-3">
              <Mail className="mt-0.5 h-4 w-4 text-ink-subtle" aria-hidden />
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-ink-subtle">
                  Email
                </dt>
                <dd className="text-sm font-medium text-ink">{user.email}</dd>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Building2 className="mt-0.5 h-4 w-4 text-ink-subtle" aria-hidden />
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-ink-subtle">
                  Organization
                </dt>
                <dd className="text-sm font-medium text-ink">{user.tenant.name}</dd>
                <dd className="text-xs text-ink-muted">{user.tenant.slug}</dd>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <User className="mt-0.5 h-4 w-4 text-ink-subtle" aria-hidden />
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-ink-subtle">
                  Plan
                </dt>
                <dd className="text-sm font-medium capitalize text-ink">
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
