"use client";

import { useState, useEffect } from "react";
import { Phone, FileText } from "lucide-react";
import {
  generateCallScript,
  initiateCall,
  type CallScriptType,
} from "@/lib/calls-api";
import type { PlaceResult } from "@/lib/places-types";
import { cn } from "@/lib/utils";
import { ModalShell } from "@/components/ui/ModalShell";
import { StatusBanner } from "@/components/ui/StatusBanner";
import { LanguageToggle } from "@/components/ui/LanguageToggle";
import { ActionButton } from "@/components/ui/ActionButton";

const SCRIPT_OPTIONS: { id: CallScriptType; label: string; hint: string }[] = [
  { id: "pharmacy_inquiry", label: "Pharmacy", hint: "Stock & delivery" },
  { id: "appointment_scheduling", label: "Appointment", hint: "Scheduling" },
  { id: "healthcare_coordination", label: "Coordination", hint: "Follow-up" },
];

interface CallScriptModalProps {
  place: PlaceResult;
  open: boolean;
  onClose: () => void;
}

export function CallScriptModal({ place, open, onClose }: CallScriptModalProps) {
  const [script, setScript] = useState("");
  const [scriptType, setScriptType] = useState<CallScriptType>("pharmacy_inquiry");
  const [toNumber, setToNumber] = useState(place.phone ?? "");
  const [agentPhone, setAgentPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [calling, setCalling] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [language, setLanguage] = useState<"english" | "hindi">("english");

  useEffect(() => {
    if (open) {
      setToNumber(place.phone ?? "");
      setError("");
      setSuccess("");
    }
  }, [open, place.phone, place.placeId]);

  async function handleGenerate() {
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const text = await generateCallScript({
        placeName: place.name,
        category: place.category,
        scriptType,
        purpose:
          language === "hindi"
            ? "Write the script in Hindi (simple, respectful, patient-friendly)"
            : "Write the script in English (simple, respectful, patient-friendly)",
      });
      setScript(text);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate script");
    } finally {
      setLoading(false);
    }
  }

  async function handleCall() {
    const dest = toNumber.replace(/\s/g, "");
    if (!dest) {
      setError("Enter the facility phone number");
      return;
    }
    setError("");
    setSuccess("");
    setCalling(true);
    try {
      const call = await initiateCall({
        placeName: place.name,
        phoneNumber: dest,
        placeId: place.placeId,
        category: place.category,
        script: script || undefined,
        scriptType,
        agentPhone: agentPhone.trim() || undefined,
      });
      if (call.status === "failed") {
        setError(call.notes || "Call could not be placed. Try again shortly.");
      } else {
        setSuccess("Call connected — coordinate with the facility now.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Call failed");
    } finally {
      setCalling(false);
    }
  }

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Call coordination"
      subtitle={place.name}
      icon={Phone}
      iconClassName="bg-emerald-500/15 text-emerald-300"
    >
      <div className="space-y-4">
        <StatusBanner variant="info">
          Your phone rings first, then the facility is connected for coordination.
        </StatusBanner>

        {error && <StatusBanner variant="error">{error}</StatusBanner>}
        {success && <StatusBanner variant="success">{success}</StatusBanner>}

        <div>
          <p className="ops-label mb-2">Purpose</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {SCRIPT_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setScriptType(opt.id)}
                className={cn(
                  "ops-chip",
                  scriptType === opt.id ? "ops-chip-active" : "ops-chip-inactive"
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
          <LanguageToggle value={language} onChange={setLanguage} accent="brand" />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="ops-label">Facility number</span>
            <input
              value={toNumber}
              onChange={(e) => setToNumber(e.target.value)}
              className="ops-input"
              placeholder="+91..."
              autoComplete="tel"
            />
          </label>
          <label className="block">
            <span className="ops-label">Your phone</span>
            <input
              value={agentPhone}
              onChange={(e) => setAgentPhone(e.target.value)}
              className="ops-input"
              placeholder="Staff mobile"
              autoComplete="tel"
            />
          </label>
        </div>

        <textarea
          value={script}
          onChange={(e) => setScript(e.target.value)}
          placeholder="Generate a script or write your own talking points…"
          rows={8}
          className="ops-textarea"
        />

        <div className="flex flex-wrap gap-2">
          <ActionButton
            variant="generate"
            onClick={handleGenerate}
            isLoading={loading}
          >
            <FileText className="h-4 w-4" />
            Generate
          </ActionButton>
          <ActionButton
            variant="call"
            onClick={handleCall}
            isLoading={calling}
            disabled={!toNumber.trim()}
          >
            <Phone className="h-4 w-4" />
            Start call
          </ActionButton>
        </div>
      </div>
    </ModalShell>
  );
}
