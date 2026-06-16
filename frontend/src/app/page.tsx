import Link from "next/link";
import {
  ArrowRight,
  Shield,
  Phone,
  MessageSquare,
  Mail,
  Languages,
  LayoutDashboard,
  BrainCircuit,
  CalendarRange,
  HeartHandshake,
  CheckCircle2,
  Building2,
} from "lucide-react";

function BrandLogo({ isFooter = false }: { isFooter?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-3 group cursor-pointer">
      {/* Dark-themed brand mark — matches navy UI */}
      <div
        className={`flex items-center justify-center rounded-2xl bg-[#1a1f2e] border border-slate-700/60 text-emerald-400 font-extrabold shadow-inner group-hover:border-emerald-500/40 transition-all duration-300
          ${isFooter ? "h-9 w-9 text-base" : "h-12 w-12 sm:h-14 sm:w-14 text-xl sm:text-2xl"}`}
      >
        G
      </div>

      <div className="flex flex-col">
        <span
          className={`font-extrabold tracking-tight text-white leading-none
            ${isFooter ? "text-lg" : "text-xl sm:text-2xl"}`}
        >
          Govinda AI
        </span>
        <span
          className={`font-bold tracking-widest text-emerald-400 uppercase mt-0.5
            ${isFooter ? "text-[9px]" : "text-[10px] sm:text-[11px]"}`}
        >
          By Xpertnote Analytics
        </span>
      </div>
    </Link>
  );
}

export default function HomePage() {
  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden bg-[#0d1117] text-slate-50 selection:bg-emerald-500 selection:text-white">

      {/* Subtle background glow */}
      <div className="absolute top-0 left-1/2 -z-10 h-[500px] w-full max-w-5xl -translate-x-1/2 opacity-10 blur-[160px] pointer-events-none">
        <div className="absolute top-[-10%] left-[20%] h-[400px] w-[400px] rounded-full bg-emerald-500" />
        <div className="absolute top-[5%] right-[20%] h-[350px] w-[350px] rounded-full bg-teal-500" />
      </div>

      {/* Dot grid pattern */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(#ffffff06_1px,transparent_1px)] bg-[size:24px_24px]" />

      {/* Navigation */}
      <header className="sticky top-0 z-50 w-full backdrop-blur-md bg-[#0d1117]/80 border-b border-slate-800/60">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <BrandLogo />
          <nav className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-400 hover:text-emerald-400 transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all"
            >
              Get started
              <ArrowRight className="h-4 w-4" />
            </Link>
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-grow mx-auto max-w-7xl px-4 pb-24 pt-20 sm:px-6 lg:px-8 lg:pt-28">
        <div className="mx-auto max-w-4xl text-center flex flex-col items-center">

          {/* Headline */}
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl leading-[1.12] text-white">
            Healthcare operations,{" "}
            <span className="text-emerald-400">
              one calm workspace
            </span>
          </h1>

          <p className="mt-6 max-w-2xl text-base sm:text-lg text-slate-400 leading-relaxed">
            Streamline outreach, automate appointment coordination,
            and convert unstructured conversations into actionable operational data.
          </p>

          {/* CTAs */}
          <div className="mt-10 flex w-full flex-col items-center justify-center gap-3 sm:flex-row sm:w-auto">
            <Link
              href="/signup"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-7 py-4 text-sm font-semibold text-slate-900 shadow-lg hover:bg-slate-100 sm:w-auto active:scale-[0.98] transition-all"
            >
              Create your organization
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex w-full items-center justify-center rounded-xl border border-slate-700 bg-slate-800/60 px-7 py-4 text-sm font-semibold text-slate-300 hover:bg-slate-800 hover:border-slate-600 sm:w-auto active:scale-[0.98] transition-all"
            >
              Sign in to dashboard
            </Link>
          </div>
        </div>

        {/* Use Cases */}
        <div className="mt-28">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-3xl font-bold tracking-tight text-white">
              Key Use Cases
            </h2>
            <p className="mt-3 text-slate-400 text-sm">
              Automate communication workflows and convert raw conversations into operational metrics.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">

            {[
              {
                icon: <Building2 className="h-5 w-5" />,
                color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/10",
                title: "1. Healthcare Outreach",
                desc: "Discover and connect with Pharmacies, Hospitals, Polyclinics, NGOs, Corporates, and Government organizations.",
                extra: (
                  <div className="flex flex-wrap gap-2 pt-3 mt-3 border-t border-slate-800">
                    {[
                      { icon: <Phone className="h-3 w-3" />, label: "Phone" },
                      { icon: <MessageSquare className="h-3 w-3" />, label: "WhatsApp" },
                      { icon: <Mail className="h-3 w-3" />, label: "Email" },
                    ].map((t) => (
                      <span key={t.label} className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 border border-slate-700/50">
                        {t.icon} {t.label}
                      </span>
                    ))}
                  </div>
                ),
              },
              {
                icon: <CalendarRange className="h-5 w-5" />,
                color: "text-teal-400 bg-teal-500/10 border-teal-500/10",
                title: "2. Appointment Coordination",
                desc: "AI parses unstructured text to extract patient name, requested service, date, and time variables.",
                extra: (
                  <div className="mt-3 p-3 rounded-lg bg-slate-900 border border-slate-800 font-mono text-[11px] text-slate-400">
                   <span className="text-emerald-400">
                      &quot;Blood test tomorrow 5 PM&quot;
                    </span>
                    <div className="mt-1.5 grid grid-cols-2 gap-x-2 text-[10px] text-slate-500">
                      <div>• Service: Blood Test</div>
                      <div>• Time: 5:00 PM</div>
                    </div>
                  </div>
                ),
              },
              {
                icon: <HeartHandshake className="h-5 w-5" />,
                color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/10",
                title: "3. Feedback Collection",
                desc: "Gather feedback from patients, sponsors, and camp teams. AI classifies sentiment and maps bottlenecks.",
                extra: (
                  <div className="flex gap-2 mt-3">
                    <span className="text-[10px] font-semibold px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/10">Positive</span>
                    <span className="text-[10px] font-semibold px-2.5 py-1 rounded-md bg-slate-800 text-slate-400 border border-slate-700/50">Neutral</span>
                    <span className="text-[10px] font-semibold px-2.5 py-1 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/10">Negative</span>
                  </div>
                ),
              },
              {
                icon: <Languages className="h-5 w-5" />,
                color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/10",
                title: "4. Multilingual Communication",
                desc: "Full processing and localization in both English and Hindi, breaking operational language barriers.",
              },
              {
                icon: <LayoutDashboard className="h-5 w-5" />,
                color: "text-purple-400 bg-purple-500/10 border-purple-500/10",
                title: "5. Centralized Dashboard",
                desc: "Track incoming/outgoing logs, unified engagement counts, appointments, and overall feedback performance.",
              },
              {
                icon: <BrainCircuit className="h-5 w-5" />,
                color: "text-pink-400 bg-pink-500/10 border-pink-500/10",
                title: "6. Operational Intelligence",
                desc: "Convert noisy message segments into tidy operational parameters that can be monitored, filtered, and audited.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-sm hover:border-slate-700 transition-all"
              >
                <div className={`p-2.5 inline-flex rounded-xl border mb-4 ${item.color}`}>
                  {item.icon}
                </div>
                <h3 className="text-base font-bold mb-2 text-white">{item.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{item.desc}</p>
                {item.extra}
              </div>
            ))}

          </div>
        </div>

        {/* Business Value */}
        <div className="mt-24 rounded-2xl border border-slate-800 bg-slate-900/40 p-8 sm:p-12 max-w-5xl mx-auto backdrop-blur-sm">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7">
              <h3 className="text-2xl sm:text-3xl font-bold text-white">
                Unlocking Real Business Value
              </h3>
              <p className="mt-4 text-sm text-slate-400 leading-relaxed">
                Govinda AI reduces administrative workload by automating communication workflows
                and operational tracking. Improve stakeholder engagement, streamline appointment
                coordination, and maintain a centralized operational record system — all from one
                AI-powered platform.
              </p>
            </div>
            <div className="lg:col-span-5 space-y-3 bg-slate-950/60 p-5 rounded-xl border border-slate-800">
              {[
                "Reduced administrative workloads",
                "Automated appointment extraction pipelines",
                "Centralized, structured activity logs",
              ].map((item) => (
                <div key={item} className="flex items-start gap-2.5 text-sm text-slate-300">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="w-full bg-[#0d1117] border-t border-slate-800/60">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-8 border-b border-slate-800/60">
            <BrandLogo isFooter />
          </div>
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <span>&copy; {new Date().getFullYear()} Govinda AI. All rights reserved.</span>
            <span>
              Engineered & Powered by{" "}
              <span className="font-bold text-slate-300">Xpertnote Analytics</span>
            </span>
          </div>
        </div>
      </footer>

    </div>
  );
}