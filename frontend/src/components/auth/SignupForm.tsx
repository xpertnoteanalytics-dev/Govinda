"use client";

import { FormEvent, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Upload, X } from "lucide-react";
import { FadeIn } from "@/components/ui/motion";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { signup } from "@/lib/auth-api";

export function SignupForm() {
  const router = useRouter();

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    organizationName: "",
    email: "",
    password: "",
  });

  // ── Organization logo state ──────────────────────────────────────────────
  const [orgLogo, setOrgLogo] = useState<string | null>(null);
  const [logoError, setLogoError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  function updateField(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  // Reads a File into base64 data-URL and validates type/size
  function handleLogoFile(file: File) {
    setLogoError("");
    if (!file.type.startsWith("image/")) {
      setLogoError("Please upload an image file (PNG, JPG, SVG)");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setLogoError("Image must be under 2 MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => setOrgLogo(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  function handleRemoveLogo() {
    setOrgLogo(null);
    setLogoError("");
    // Reset the hidden file input so the same file can be re-selected
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      // Pass orgLogo (base64 string or null) alongside the rest of the form
      await signup({ ...form, organizationLogo: orgLogo ?? undefined });
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <FadeIn>
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-clinical-danger"
          >
            {error}
          </div>
        )}

        {/* ── Name fields ──────────────────────────────────────────────────── */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="First name"
            name="firstName"
            required
            value={form.firstName}
            onChange={(e) => updateField("firstName", e.target.value)}
          />
          <Input
            label="Last name"
            name="lastName"
            required
            value={form.lastName}
            onChange={(e) => updateField("lastName", e.target.value)}
          />
        </div>

        {/* ── Organization name ─────────────────────────────────────────────── */}
        <Input
          label="Organization name"
          name="organizationName"
          required
          value={form.organizationName}
          onChange={(e) => updateField("organizationName", e.target.value)}
          placeholder="RKG Labs"
          hint="Creates your organization workspace"
        />

        {/* ── Organization logo (optional) ──────────────────────────────────── */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Organization logo{" "}
            <span className="text-slate-400 font-normal">(optional)</span>
          </label>

          <div className="flex items-start gap-4">
            {/* Preview / click-to-upload area */}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="h-16 w-16 shrink-0 rounded-xl border-2 border-dashed border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 flex items-center justify-center overflow-hidden hover:border-brand-400/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              aria-label="Upload organization logo"
            >
              {orgLogo ? (
                <img
                  src={orgLogo}
                  alt="Logo preview"
                  className="h-full w-full object-contain rounded-xl p-1"
                />
              ) : (
                <Building2 className="h-6 w-6 text-slate-300 dark:text-slate-600" />
              )}
            </button>

            {/* Controls */}
            <div className="flex-1 min-w-0 space-y-2">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                PNG, JPG, or SVG · Max 2 MB. Shown in the sidebar next to your
                organization name.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/10 transition-colors"
                >
                  <Upload className="h-3.5 w-3.5" />
                  {orgLogo ? "Replace" : "Choose image"}
                </button>

                {orgLogo && (
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-900/20 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                    Remove
                  </button>
                )}
              </div>

              {logoError && (
                <p className="text-xs text-red-600 dark:text-red-400">
                  {logoError}
                </p>
              )}
            </div>
          </div>

          {/* Hidden file input */}
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

        {/* ── Credentials ───────────────────────────────────────────────────── */}
        <Input
          label="Work email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={form.email}
          onChange={(e) => updateField("email", e.target.value)}
          placeholder="admin@clinic.com"
        />

        <Input
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={form.password}
          onChange={(e) => updateField("password", e.target.value)}
          placeholder="Min. 8 characters"
        />

        <Button type="submit" className="w-full" isLoading={isLoading}>
          Create organization
        </Button>

        <p className="text-center text-sm text-ink-muted">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-brand-700 hover:text-brand-800"
          >
            Sign in
          </Link>
        </p>
      </form>
    </FadeIn>
  );
}