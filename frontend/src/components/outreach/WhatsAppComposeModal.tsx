"use client";

import { useState, useEffect } from "react";
import { MessageCircle, Sparkles, Send, Copy } from "lucide-react";
import { generateWhatsAppDraft, sendWhatsAppMessage } from "@/lib/whatsapp-api";
import { getCompanyOutreachConfig } from "@/lib/outreach-config-api";
import { OUTREACH_OPTIONS, type OutreachType } from "@/lib/outreach-types";
import type { PlaceResult } from "@/lib/places-types";
import { cn } from "@/lib/utils";
import { ModalShell } from "@/components/ui/ModalShell";
import { StatusBanner } from "@/components/ui/StatusBanner";
import { LanguageToggle } from "@/components/ui/LanguageToggle";
import { ActionButton } from "@/components/ui/ActionButton";

interface WhatsAppComposeModalProps {
  place: PlaceResult;
  open: boolean;
  onClose: () => void;
}

export function WhatsAppComposeModal({ place, open, onClose }: WhatsAppComposeModalProps) {
  const [message, setMessage] = useState("");
  const [facilityPhone, setFacilityPhone] = useState(place.phone ?? "");
  const [companyFrom, setCompanyFrom] = useState<string | null>(null);
  const [companySendAvailable, setCompanySendAvailable] = useState(true);
  const [outreachType, setOutreachType] = useState<OutreachType>("pharmacy_inquiry");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [language, setLanguage] = useState<"english" | "hindi">("english");

  useEffect(() => {
    if (open) {
      setFacilityPhone(place.phone ?? "");
      setMessage("");
      setError("");
      setSuccess("");
      getCompanyOutreachConfig()
        .then((c) => {
          setCompanyFrom(c.companyWhatsAppNumber ?? c.whatsapp.from);
          setCompanySendAvailable(c.whatsapp.companySendAvailable);
        })
        .catch(() => {
          setCompanyFrom(null);
          setCompanySendAvailable(false);
        });
    }
  }, [open, place.phone, place.placeId]);

  const hasFacilityPhone = Boolean(facilityPhone.replace(/\s/g, ""));

  async function handleGenerate() {
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const text = await generateWhatsAppDraft({
        placeName: place.name,
        category: place.category,
        outreachType,
        purpose:
          language === "hindi"
            ? "Write in Hindi, simple and patient-friendly language"
            : "Write in English, simple and patient-friendly language",
      });
      setMessage(text);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate message");
    } finally {
      setLoading(false);
    }
  }

  async function handleSend() {
    const phone = facilityPhone.replace(/\s/g, "");
    if (!phone) {
      setError("Facility phone number is required");
      return;
    }
    if (!message.trim()) {
      setError("Message is required");
      return;
    }
    setError("");
    setSuccess("");
    setSending(true);
    try {
      const result = await sendWhatsAppMessage({
        placeName: place.name,
        phoneNumber: phone,
        message,
        placeId: place.placeId,
        category: place.category,
        outreachType,
        openChatOnly: false,
      });
      if (result.status === "failed") {
        setError(result.notes || "Message could not be sent. Try again shortly.");
      } else {
        setSuccess("WhatsApp message sent successfully.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSending(false);
    }
  }

  function handleCopy() {
    if (!message.trim()) return;
    void navigator.clipboard.writeText(message);
    setSuccess("Message copied to clipboard");
  }

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="WhatsApp outreach"
      subtitle={place.name}
      icon={MessageCircle}
      iconClassName="bg-emerald-500/15 text-emerald-300"
    >
      <div className="space-y-4">
        <StatusBanner variant="info">
          Sent from your organization WhatsApp line to the facility contact.
        </StatusBanner>

        {error && <StatusBanner variant="error">{error}</StatusBanner>}
        {success && <StatusBanner variant="success">{success}</StatusBanner>}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="ops-label">From</span>
            <input
              readOnly
              value={companyFrom ?? "Organization WhatsApp"}
              className="ops-input cursor-not-allowed opacity-80"
            />
          </label>
          <label className="block">
            <span className="ops-label">To</span>
            <input
              readOnly={Boolean(place.phone)}
              value={facilityPhone}
              onChange={(e) => setFacilityPhone(e.target.value)}
              className={cn("ops-input", place.phone && "cursor-not-allowed opacity-90")}
              placeholder="Facility number"
            />
          </label>
        </div>

        {!hasFacilityPhone && (
          <p className="text-xs text-amber-200/90">
            No phone listed for this facility. Try another search result.
          </p>
        )}

        <div>
          <p className="ops-label mb-2">Purpose</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {OUTREACH_OPTIONS.slice(0, 4).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setOutreachType(opt.id)}
                className={cn(
                  "ops-chip",
                  outreachType === opt.id
                    ? "border-emerald-400/40 bg-emerald-500/15 text-white"
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
          <LanguageToggle value={language} onChange={setLanguage} accent="emerald" />
        </div>

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Generate a message or write your own…"
          rows={8}
          className="ops-textarea"
        />

        <div className="flex flex-wrap gap-2">
          <ActionButton variant="generate" onClick={handleGenerate} isLoading={loading}>
            <Sparkles className="h-4 w-4" />
            Generate
          </ActionButton>
          <ActionButton
            variant="whatsapp"
            onClick={handleSend}
            isLoading={sending}
            disabled={!hasFacilityPhone || !companySendAvailable}
          >
            <Send className="h-4 w-4" />
            Send
          </ActionButton>
          <ActionButton variant="ghost" onClick={handleCopy} disabled={!message.trim()}>
            <Copy className="h-4 w-4" />
            Copy
          </ActionButton>
        </div>
      </div>
    </ModalShell>
  );
}
