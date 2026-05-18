import Link from "next/link";
import { Activity, ArrowRight, Shield } from "lucide-react";
import { APP_NAME } from "@/lib/constants";

export default function HomePage() {
  return (
    <div className="min-h-screen healthcare-gradient">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6 sm:px-6">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white shadow-elevated">
            <Activity className="h-5 w-5" aria-hidden />
          </div>
          <span className="text-lg font-semibold text-ink">{APP_NAME}</span>
        </div>
        <nav className="flex items-center gap-3">
          <Link
            href="/login"
            className="rounded-lg px-4 py-2 text-sm font-medium text-ink-muted hover:text-ink"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700"
          >
            Get started
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-20 pt-12 sm:px-6 sm:pt-20">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-1.5 text-sm font-medium text-brand-800">
            <Shield className="h-4 w-4" aria-hidden />
            HIPAA-ready foundation
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-ink sm:text-5xl">
            Healthcare operations,{" "}
            <span className="text-brand-700">built for scale</span>
          </h1>
          <p className="mt-6 text-lg text-ink-muted">
            Govinda AI is a multi-tenant platform foundation for clinics and health
            systems — secure authentication, organization isolation, and role-based
            access out of the box.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/signup"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-base font-semibold text-white shadow-elevated hover:bg-brand-700 sm:w-auto"
            >
              Create your organization
              <ArrowRight className="h-5 w-5" aria-hidden />
            </Link>
            <Link
              href="/login"
              className="inline-flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-3 text-base font-semibold text-ink shadow-card hover:bg-slate-50 sm:w-auto"
            >
              Sign in to dashboard
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
