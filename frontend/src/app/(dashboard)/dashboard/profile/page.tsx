import { cookies } from "next/headers";
import { PageTransition } from "@/components/ui/motion";
import { ProfilePanel } from "@/components/dashboard/ProfilePanel";
import { parseUserCookie } from "@/lib/session/server";

export const metadata = {
  title: "Profile",
};

export default async function ProfilePage() {
  const cookieStore = await cookies();
  const user = parseUserCookie(cookieStore.get("govinda_user")?.value);

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* ── Page header ── */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-slate-800/50 px-6 py-5 shadow-sm">
          {/* Subtle ambient glow matching your teal/green brand */}
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-emerald-400/10 dark:bg-teal-400/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-6 -left-6 h-28 w-28 rounded-full bg-teal-400/10 dark:bg-emerald-500/10 blur-2xl" />

          <div className="relative flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                Profile
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Manage your account and organization membership
              </p>
            </div>

            {/* Status badge */}
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-teal-900/50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-teal-300 ring-1 ring-emerald-200 dark:ring-teal-700/40 shrink-0 mt-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-teal-400 animate-pulse" />
              Active
            </span>
          </div>
        </div>

        {/* ── Profile panel ── */}
        <ProfilePanel initialUser={user} />
      </div>
    </PageTransition>
  );
}