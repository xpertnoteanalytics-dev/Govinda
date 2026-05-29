import Link from "next/link";
import { Activity } from "lucide-react";
import { APP_NAME } from "@/lib/constants";

export function AuthLayout({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="min-h-screen healthcare-gradient">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col lg:flex-row">
        <aside className="hidden flex-1 flex-col justify-between p-10 lg:flex">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white">
              <Activity className="h-5 w-5" aria-hidden />
            </div>
            <span className="text-lg font-semibold text-ink">{APP_NAME}</span>
          </Link>
          <div className="max-w-md">
            <h2 className="text-3xl font-bold tracking-tight text-ink dark:text-white">
              Healthcare operations, one workspace
            </h2>
            <p className="mt-4 text-ink-muted dark:text-slate-400">
              Find care, call and message facilities, coordinate appointments, and
              support patients — with secure sign-in for your organization.
            </p>
          </div>
          <p className="text-sm text-ink-subtle">
            © {new Date().getFullYear()} {APP_NAME}. All rights reserved.
          </p>
        </aside>

        <main className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6">
          <div className="w-full max-w-md">
            <div className="mb-8 lg:hidden">
              <Link href="/" className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white">
                  <Activity className="h-4 w-4" aria-hidden />
                </div>
                <span className="font-semibold text-ink">{APP_NAME}</span>
              </Link>
            </div>
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-ink">{title}</h1>
              <p className="mt-2 text-sm text-ink-muted">{subtitle}</p>
            </div>
            <div className="glass-panel rounded-2xl p-6 sm:p-8">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}
