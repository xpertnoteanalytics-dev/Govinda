"use client";

import { useEffect, useState } from "react";
import {
  Building2,
  Shield,
  Users,
  Activity,
  TrendingUp,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { AnimatedCard, StaggerList } from "@/components/ui/motion";
import { CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { RoleBadge } from "@/components/auth/RoleBadge";
import type { Role } from "@/lib/constants";

interface TenantAnalytics {
  memberCount: number;
  activeMembers: number;
  plan: string;
  tenantName: string;
  tenantSlug: string;
  isActive: boolean;
  recentMembers: Array<{
    id: string;
    firstName: string;
    lastName: string;
    role: string;
    joinedAt: string;
  }>;
}

export function AnalyticsCards() {
  const [analytics, setAnalytics] = useState<TenantAnalytics | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<TenantAnalytics>("/v1/analytics")
      .then(setAnalytics)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, []);

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-clinical-danger">
        {error}
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="h-32 animate-pulse rounded-2xl bg-slate-200/60"
          />
        ))}
      </div>
    );
  }

  const stats = [
    {
      label: "Team members",
      value: analytics.memberCount.toString(),
      icon: Users,
      description: `${analytics.activeMembers} active`,
      trend: "+100%",
    },
    {
      label: "Organization",
      value: analytics.isActive ? "Active" : "Suspended",
      icon: Building2,
      description: analytics.tenantName,
      trend: analytics.plan,
    },
    {
      label: "Security",
      value: "JWT",
      icon: Shield,
      description: "Encrypted session",
      trend: "Secure",
    },
    {
      label: "Platform",
      value: "Online",
      icon: Activity,
      description: "All systems operational",
      trend: "99.9%",
    },
  ];

  return (
    <StaggerList className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <AnimatedCard key={stat.label} index={index}>
            <CardHeader className="mb-0 flex flex-row items-start justify-between p-0">
              <div>
                <CardDescription>{stat.label}</CardDescription>
                <CardTitle className="mt-1 text-2xl">{stat.value}</CardTitle>
              </div>
              <div className="rounded-xl bg-brand-50 p-2.5 text-brand-700">
                <Icon className="h-5 w-5" aria-hidden />
              </div>
            </CardHeader>
            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-ink-subtle">{stat.description}</p>
              <span className="inline-flex items-center gap-0.5 text-xs font-medium text-clinical-success">
                <TrendingUp className="h-3 w-3" aria-hidden />
                {stat.trend}
              </span>
            </div>
          </AnimatedCard>
        );
      })}

      {analytics.recentMembers.length > 0 && (
        <AnimatedCard index={4} className="sm:col-span-2 xl:col-span-4">
          <CardHeader className="p-0">
            <CardTitle>Recent team members</CardTitle>
            <CardDescription>
              Latest members in {analytics.tenantSlug}
            </CardDescription>
          </CardHeader>
          <ul className="mt-4 divide-y divide-slate-100">
            {analytics.recentMembers.map((member) => (
              <li
                key={member.id}
                className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
              >
                <div>
                  <p className="text-sm font-medium text-ink">
                    {member.firstName} {member.lastName}
                  </p>
                  <p className="text-xs text-ink-muted">
                    Joined {new Date(member.joinedAt).toLocaleDateString()}
                  </p>
                </div>
                <RoleBadge role={member.role as Role} />
              </li>
            ))}
          </ul>
        </AnimatedCard>
      )}
    </StaggerList>
  );
}
