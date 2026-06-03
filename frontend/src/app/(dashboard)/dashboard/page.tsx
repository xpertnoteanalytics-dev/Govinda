import Link from "next/link";
import Image from "next/image";
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
  Building2
} from "lucide-react";

// Directly importing the image from the path shown in image_a54b21.png




      <div className="flex flex-col">
        <span className={`font-extrabold tracking-tight text-slate-900 dark:text-white leading-none tracking-wide
          ${isFooter ? 'text-lg' : 'text-xl sm:text-2xl'}`}
        >
          Govinda AI
        </span>
        <span className={`font-semibold tracking-widest text-emerald-600 dark:text-emerald-400 uppercase mt-1
          ${isFooter ? 'text-[9px]' : 'text-[10px] sm:text-[11px]'}`}
        >
          By RKJ Labs
        </span>
      </div>
    </Link>
  );
}

export default function HomePage() {
  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 selection:bg-emerald-500 selection:text-white">
      
      {/* Dynamic Background Radial Glows */}
      <div className="absolute top-0 left-1/2 -z-10 h-[600px] w-full max-w-7xl -translate-x-1/2 opacity-25 dark:opacity-15 blur-[140px] pointer-events-none">
        <div className="absolute top-[-10%] left-[15%] h-[450px] w-[450px] rounded-full bg-gradient-to-br from-emerald-400 to-teal-600" />
        <div className="absolute top-[5%] right-[15%] h-[400px] w-[400px] rounded-full bg-gradient-to-br from-cyan-400 to-indigo-500" />
      </div>

      {/* Decorative Geometric Grid Pattern */}
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:20px_20px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />

      {/* Navigation Header */}
      <header className="sticky top-0 z-50 mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 lg:px-8 backdrop-blur-md bg-slate-50/70 dark:bg-slate-950/70 border-b border-slate-200/50 dark:border-slate-800/50">
        <div className="flex items-center justify-between">
          <BrandLogo />
          
          <nav className="flex items-center gap-4">
            <Link
              href="/login"
              className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-500/10 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.98] transition-all"
            >
              Get started
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero & Content Container */}
      <main className="flex-grow mx-auto max-w-7xl px-4 pb-24 pt-16 sm:px-6 lg:px-8 lg:pt-24">
        <div className="mx-auto max-w-4xl text-center flex flex-col items-center">
          
          {/* Top Shield Badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-200/60 bg-emerald-50/50 px-4 py-1.5 text-xs sm:text-sm font-medium text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300 shadow-sm backdrop-blur-sm">
            <Shield className="h-4 w-4 text-emerald-500" aria-hidden />
            <span>Operational Intelligence Platform</span>
          </div>

          {/* Typography Header */}
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl max-w-4xl leading-[1.15]">
            Govinda AI –{" "}
            <span className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 bg-clip-text text-transparent dark:from-emerald-400 dark:via-teal-400 dark:to-cyan-400">
              Healthcare Operations Assistant
            </span>
          </h1>

          <p className="mt-6 max-w-3xl text-lg sm:text-xl text-slate-600 dark:text-slate-400 leading-relaxed">
            An AI-powered healthcare operations platform designed to streamline outreach, 
            appointment coordination, stakeholder engagement, and feedback management. 
            Reduce manual effort by converting conversations into actionable operational data.
          </p>

          {/* CTAs */}
          <div className="mt-10 flex w-full flex-col items-center justify-center gap-4 sm:flex-row sm:w-auto">
            <Link
              href="/signup"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-7 py-4 text-base font-semibold text-white shadow-lg shadow-slate-950/25 hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100 sm:w-auto active:scale-[0.98] transition-all"
            >
              Create your organization
              <ArrowRight className="h-5 w-5" aria-hidden />
            </Link>
            <Link
              href="/login"
              className="inline-flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white/80 px-7 py-4 text-base font-semibold text-slate-700 shadow-sm backdrop-blur-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:bg-slate-800 sm:w-auto active:scale-[0.98] transition-all"
            >
              Sign in to dashboard
            </Link>
          </div>
        </div>

        {/* Use Cases Section */}
        <div className="mt-28">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-slate-900 dark:text-white">
              Key Use Cases
            </h2>
            <p className="mt-3 text-slate-500 dark:text-slate-400">
              Automate communication workflows and convert raw conversations into operational metrics.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            
            {/* Use Case 1 */}
            <div className="relative group rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/50 backdrop-blur-sm hover:shadow-md transition-all">
              <div className="p-3 inline-flex rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mb-5">
                <Building2 className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold mb-2">1. Healthcare Outreach</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
                Discover and connect with Pharmacies, Hospitals, Polyclinics, NGOs, Corporates, and Government organizations.
              </p>
              <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"><Phone className="h-3 w-3"/> Phone</span>
                <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"><MessageSquare className="h-3 w-3"/> WhatsApp</span>
                <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"><Mail className="h-3 w-3"/> Email</span>
              </div>
            </div>

            {/* Use Case 2 */}
            <div className="relative group rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/50 backdrop-blur-sm hover:shadow-md transition-all">
              <div className="p-3 inline-flex rounded-xl bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400 mb-5">
                <CalendarRange className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold mb-2">2. Appointment Coordination</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
                AI parses unstructured text to extract patient name, requested service, date, and time variables instantaneously.
              </p>
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 text-[11px] font-mono border border-slate-100 dark:border-slate-800 text-slate-500">
                <span className="text-emerald-500">"Blood test tomorrow 5 PM"</span>
                <div className="mt-1 grid grid-cols-2 gap-x-2 text-[10px]">
                  <div>• Service: Blood Test</div>
                  <div>• Time: 5:00 PM</div>
                </div>
              </div>
            </div>

            {/* Use Case 3 */}
            <div className="relative group rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/50 backdrop-blur-sm hover:shadow-md transition-all">
              <div className="p-3 inline-flex rounded-xl bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 mb-5">
                <HeartHandshake className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold mb-2">3. Feedback Collection</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
                Gather feedback from patients, sponsors, and camp teams. AI classifies sentiment and maps key operational bottlenecks.
              </p>
              <div className="flex gap-1.5 pt-2">
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">Positive</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">Neutral</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400">Negative</span>
              </div>
            </div>

            {/* Use Case 4 */}
            <div className="relative group rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/50 backdrop-blur-sm hover:shadow-md transition-all">
              <div className="p-3 inline-flex rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 mb-5">
                <Languages className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold mb-2">4. Multilingual Communication</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                Break operational boundaries across broad user ecosystems. Full processing and text localization supported in both **English** and **Hindi**.
              </p>
            </div>

            {/* Use Case 5 */}
            <div className="relative group rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/50 backdrop-blur-sm hover:shadow-md transition-all">
              <div className="p-3 inline-flex rounded-xl bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 mb-5">
                <LayoutDashboard className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold mb-2">5. Centralized Dashboard</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                A structured master workspace tracking incoming/outgoing logs, unified engagement counts, appointments, and overall feedback performance.
              </p>
            </div>

            {/* Use Case 6 */}
            <div className="relative group rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/50 backdrop-blur-sm hover:shadow-md transition-all">
              <div className="p-3 inline-flex rounded-xl bg-pink-50 dark:bg-pink-500/10 text-pink-600 dark:text-pink-400 mb-5">
                <BrainCircuit className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold mb-2">6. Operational Intelligence</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                Convert noisy message segments into tidy operational parameters that can be monitored, filtered, and systematically audited.
              </p>
            </div>

          </div>
        </div>

        {/* Business Value Metric Layout */}
        <div className="mt-28 rounded-3xl border border-slate-200/80 bg-gradient-to-b from-slate-50 to-white p-8 sm:p-12 shadow-xl dark:border-slate-800/80 dark:from-slate-900/50 dark:to-slate-950/20 backdrop-blur-md max-w-5xl mx-auto ring-1 ring-slate-950/5">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7">
              <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                Unlocking Real Business Value
              </h3>
              <p className="mt-4 text-base text-slate-600 dark:text-slate-400 leading-relaxed">
                Govinda AI reduces administrative workload by automating communication workflows and operational tracking. 
                It enables healthcare organizations to improve stakeholder engagement, streamline appointment coordination, 
                monitor feedback, and maintain a centralized operational record system through a single AI-powered platform.
              </p>
            </div>
            <div className="lg:col-span-5 space-y-3 bg-slate-100/60 dark:bg-slate-950/40 p-5 rounded-2xl border border-slate-200/40 dark:border-slate-900">
              <div className="flex items-start gap-2.5 text-sm">
                <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                <span>Reduced administrative workloads</span>
              </div>
              <div className="flex items-start gap-2.5 text-sm">
                <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                <span>Automated appointment extraction pipelines</span>
              </div>
              <div className="flex items-start gap-2.5 text-sm">
                <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                <span>Centralized, structured activity logs</span>
              </div>
            </div>
          </div>
        </div>

      </main>

      {/* Integrated Branded Footer */}
      <footer className="w-full bg-white dark:bg-slate-950 border-t border-slate-200/60 dark:border-slate-800/60 transition-colors">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 border-b border-slate-100 dark:border-slate-900 pb-8">
            
            {/* Branding Block */}
            <div className="flex flex-col items-center md:items-start text-center md:text-left">
              <BrandLogo isFooter={true} />
              
            </div>

            {/* Quick Links */}
           
          </div>

          {/* Copyright Metadata */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
            <div>
              &copy; {new Date().getFullYear()} Govinda AI. All rights reserved.
            </div>
            <div className="flex items-center gap-1">
              <span>Engineered & Powered by</span>
              <span className="font-bold text-slate-700 dark:text-slate-300 tracking-tight">RKJ Labs</span>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}