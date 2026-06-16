import Link from "next/link";
import Image from "next/image";


function BrandLogo({ isMobile = false }) {
  return (
    <Link href="/" className="flex items-center gap-3.5 group cursor-pointer">
      <div className={`relative flex items-center justify-center rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 overflow-hidden transition-all duration-500 group-hover:scale-105 shadow-md group-hover:shadow-emerald-500/20
        ${isMobile ? "h-11 w-11" : "h-12 w-12 sm:h-14 sm:w-14"}`}
      >
       
      </div>

      <div className="flex flex-col">
        <span className={`font-extrabold tracking-tight text-slate-900 dark:text-white leading-none transition-colors duration-300 group-hover:text-emerald-600 dark:group-hover:text-emerald-400
          ${isMobile ? "text-lg" : "text-xl sm:text-2xl"}`}
        >
          Govinda AI
        </span>
        <span className={`font-semibold tracking-widest text-emerald-600 dark:text-emerald-400 uppercase mt-1
          ${isMobile ? "text-[9px]" : "text-[10px] sm:text-[11px]"}`}
        >
          By Xpertnote Analytics
        </span>
      </div>
    </Link>
  );
}

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
    <div className="relative min-h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 selection:bg-emerald-500 selection:text-white overflow-x-hidden overflow-y-auto">
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeInRight {
          from { opacity: 0; transform: translateX(-30px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes subtleGlow {
          0%, 100% { transform: scale(1) translate(0px, 0px); opacity: 0.15; }
          50% { transform: scale(1.06) translate(8px, -8px); opacity: 0.22; }
        }
        .anim-fade-up { animation: fadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .anim-fade-right { animation: fadeInRight 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .anim-glow { animation: subtleGlow 12s ease-in-out infinite; }
        .delay-75 { animation-delay: 75ms; }
        .delay-150 { animation-delay: 150ms; }
        .delay-300 { animation-delay: 300ms; }

        .auth-form-container label, 
        .auth-form-container .text-ink,
        .auth-form-container [class*="text-ink"] {
          color: #475569 !important;
          font-weight: 600 !important;
        }
        .dark .auth-form-container label,
        .dark .auth-form-container .text-ink,
        .dark .auth-form-container [class*="text-ink"] {
          color: #94a3b8 !important;
        }

        .auth-form-container input {
          background-color: #ffffff !important;
          color: #0f172a !important;
          border: 1px solid #cbd5e1 !important;
          border-radius: 0.75rem !important;
          transition: all 0.2s ease-in-out !important;
        }
        .dark .auth-form-container input {
          background-color: #0f172a !important;
          color: #ffffff !important;
          border: 1px solid #334155 !important;
        }
        .auth-form-container input:focus {
          border-color: #059669 !important;
          box-shadow: 0 0 0 4px rgba(5, 150, 105, 0.1) !important;
          outline: none !important;
        }
        .dark .auth-form-container input:focus {
          border-color: #10b981 !important;
          box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.15) !important;
          outline: none !important;
        }
        .auth-form-container input::placeholder {
          color: #94a3b8 !important;
        }
        .dark .auth-form-container input::placeholder {
          color: #475569 !important;
        }
      `}</style>

      <div className="absolute top-0 left-1/2 -z-10 h-[600px] w-full max-w-7xl -translate-x-1/2 blur-[140px] pointer-events-none">
        <div className="absolute top-[-10%] left-[15%] h-[450px] w-[450px] rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 anim-glow" />
      </div>
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#80808004_1px,transparent_1px),linear-gradient(to_bottom,#80808004_1px,transparent_1px)] bg-[size:20px_20px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />

      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col lg:flex-row">
        <aside className="hidden flex-1 flex-col justify-between p-12 lg:flex border-r border-slate-200/50 dark:border-slate-800/50 bg-white/40 dark:bg-slate-900/10 backdrop-blur-sm opacity-0 anim-fade-right">
          <BrandLogo />
          
          <div className="max-w-md space-y-4">
            <h2 className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight opacity-0 anim-fade-up delay-75">
              Healthcare operations, <br />
              <span className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 bg-clip-text text-transparent dark:from-emerald-400 dark:to-teal-400">
                one calm workspace
              </span>
            </h2>
            <p className="text-base leading-relaxed text-slate-600 dark:text-slate-400 opacity-0 anim-fade-up delay-150">
              Streamline outreach, automate appointment coordination, and convert unstructured conversations into actionable operational data.
            </p>
          </div>

          <p className="text-xs font-semibold text-slate-400 opacity-0 anim-fade-up delay-300">
            &copy; {new Date().getFullYear()} Govinda AI. Powered by Xpertnote Analytics.
          </p>
        </aside>

        <main className="flex-1 flex flex-col justify-center items-center px-4 py-8 sm:px-6 lg:px-8 w-full min-h-screen lg:min-h-0">
          <div className="w-full max-w-md mx-auto flex flex-col justify-center">
            <div className="mb-8 lg:hidden opacity-0 anim-fade-up">
              <BrandLogo isMobile={true} />
            </div>

            <div className="mb-6 opacity-0 anim-fade-up delay-75">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                {title}
              </h1>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                {subtitle}
              </p>
            </div>

            <div className="opacity-0 anim-fade-up delay-150 w-full rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-8 shadow-xl shadow-slate-200/30 dark:border-slate-800/80 dark:bg-slate-900/40 dark:shadow-none backdrop-blur-md transition-all duration-500 hover:border-slate-300 dark:hover:border-slate-700">
              <div className="auth-form-container w-full overflow-visible">
                {children}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}