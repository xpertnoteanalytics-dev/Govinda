"use client";

import { useState, useEffect } from "react";
import { Mail, Sparkles, Send } from "lucide-react";
import { generateEmailDraft, sendOutreachEmail } from "@/lib/emails-api";
import { getCompanyOutreachConfig } from "@/lib/outreach-config-api";
import { OUTREACH_OPTIONS, type OutreachType } from "@/lib/outreach-types";
import type { PlaceResult } from "@/lib/places-types";
import { cn } from "@/lib/utils";
import { ModalShell } from "@/components/ui/ModalShell";
import { StatusBanner } from "@/components/ui/StatusBanner";
import { LanguageToggle } from "@/components/ui/LanguageToggle";
import { ActionButton } from "@/components/ui/ActionButton";

interface EmailComposeModalProps {
  place: PlaceResult;
  open: boolean;
  onClose: () => void;
}

export function EmailComposeModal({ place, open, onClose }: EmailComposeModalProps) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [toEmail, setToEmail] = useState("");
  const [companyFrom, setCompanyFrom] = useState<string | null>(null);
  const [outreachType, setOutreachType] = useState<OutreachType>("pharmacy_inquiry");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [language, setLanguage] = useState<"english" | "hindi">("english");

  useEffect(() => {
    if (open) {
      setToEmail(place.email ?? "");
      setSubject("");
      setBody("");
      setError("");
      setSuccess("");
      getCompanyOutreachConfig()
        .then((c) => setCompanyFrom(c.companySupportEmail ?? c.email.from))
        .catch(() => setCompanyFrom(null));
    }
  }, [open, place.placeId]);

  async function handleGenerate() {
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const draft = await generateEmailDraft({
        placeName: place.name,
        category: place.category,
        outreachType,
        purpose:
          language === "hindi"
            ? "Write in Hindi, simple and patient-friendly language"
            : "Write in English, simple and patient-friendly language",
      });
      setSubject(draft.subject);
      setBody(draft.body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate draft");
    } finally {
      setLoading(false);
    }
  }

  async function handleSend() {
    const email = toEmail.trim();
    if (!email) {
      setError("Enter the facility email address");
      return;
    }
    if (!subject.trim() || !body.trim()) {
      setError("Subject and message are required");
      return;
    }
    setError("");
    setSuccess("");
    setSending(true);
    try {
      const record = await sendOutreachEmail({
        placeName: place.name,
        toEmail: email,
        subject,
        body,
        placeId: place.placeId,
        category: place.category,
        outreachType,
      });
      if (record.status === "failed") {
        setError(record.notes || "Email could not be sent. Try again shortly.");
      } else {
        setSuccess("Email sent successfully.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Email outreach"
      subtitle={place.name}
      icon={Mail}
      iconClassName="bg-sky-500/15 text-sky-300"
      size="lg"
    >
      <div className="space-y-4">
        <StatusBanner variant="info">
          Sent from your organization support inbox to the facility contact.
        </StatusBanner>

        {error && <StatusBanner variant="error">{error}</StatusBanner>}
        {success && <StatusBanner variant="success">{success}</StatusBanner>}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="ops-label">From</span>
            <input
              readOnly
              value={companyFrom ?? "Organization email"}
              className="ops-input cursor-not-allowed opacity-80"
            />
          </label>
          <label className="block">
            <span className="ops-label">To</span>
            <input
              type="email"
              value={toEmail}
              onChange={(e) => setToEmail(e.target.value)}
              className="ops-input"
              placeholder="contact@facility.com"
              autoComplete="off"
            />
          </label>
        </div>

        <div>
          <p className="ops-label mb-2">Purpose</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {OUTREACH_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setOutreachType(opt.id)}
                className={cn(
                  "ops-chip",
                  outreachType === opt.id
                    ? "border-sky-400/40 bg-sky-500/15 text-white"
                    : "ops-chip-inactive"
                )}
              >
                <span className="font-semibold">{opt.label}</span>
                <span className="mt-0.5 block text-[10px] opacity-70">{opt.hint}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="ops-label mb-2">Language</p>
          <LanguageToggle value={language} onChange={setLanguage} accent="sky" />
        </div>

        <label className="block">
          <span className="ops-label">Subject</span>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="ops-input"
            placeholder="Professional outreach subject"
          />
        </label>

        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Generate a draft or write your message…"
          rows={8}
          className="ops-textarea"
        />

        <div className="flex flex-wrap gap-2">
          <ActionButton variant="generate" onClick={handleGenerate} isLoading={loading}>
            <Sparkles className="h-4 w-4" />
            Generate
          </ActionButton>
          <ActionButton
            variant="email"
            onClick={handleSend}
            isLoading={sending}
            disabled={!toEmail.trim()}
          >
            <Send className="h-4 w-4" />
            Send
          </ActionButton>
        </div>
      </div>
    </ModalShell>
  );
}
