"use client";

import { useState, useEffect } from "react";
import { Phone } from "lucide-react";
import {
  initiateCall,
  type ObjectiveType,
  type EnabledTool,
} from "@/lib/calls-api";
import { cn } from "@/lib/utils";
import { ModalShell } from "@/components/ui/ModalShell";
import { StatusBanner } from "@/components/ui/StatusBanner";
import { ActionButton } from "@/components/ui/ActionButton";

const OBJECTIVE_OPTIONS: { id: ObjectiveType; label: string; hint: string }[] = [
  { id: "appointment_booking",    label: "Appointment",     hint: "Book a slot"         },
  { id: "feedback_collection",    label: "Feedback",        hint: "Collect responses"   },
  { id: "pharmacy_inquiry",       label: "Pharmacy",        hint: "Stock & delivery"    },
  { id: "doctor_verification",    label: "Doctor Verify",   hint: "Credential check"    },
  { id: "hospital_onboarding",    label: "Onboarding",      hint: "New facility"        },
  { id: "sales_outreach",         label: "Sales",           hint: "Outreach call"       },
  { id: "insurance_verification", label: "Insurance",       hint: "Verify coverage"     },
  { id: "lab_result_followup",    label: "Lab Follow-up",   hint: "Result discussion"   },
  { id: "patient_reminder",       label: "Reminder",        hint: "Patient nudge"       },
  { id: "custom",                 label: "Custom",          hint: "Define below"        },
];

const TOOL_OPTIONS: { id: EnabledTool; label: string }[] = [
  { id: "appointment_booking",   label: "Appointment Booking"  },
  { id: "crm_update",            label: "CRM Update"           },
  { id: "human_transfer",        label: "Human Transfer"       },
  { id: "whatsapp_followup",     label: "WhatsApp Follow-up"   },
  { id: "callback_schedule",     label: "Callback Schedule"    },
  { id: "post_call_extraction",  label: "Post-Call Extraction" },
];

interface CallScriptModalProps {
  open: boolean;
  onClose: () => void;
}

export function CallScriptModal({ open, onClose }: CallScriptModalProps) {
  const [recipientName,      setRecipientName]      = useState("");
  const [phoneNumber,        setPhoneNumber]        = useState("");
  const [recipientCategory,  setRecipientCategory]  = useState("");
  const [objectiveType,      setObjectiveType]      = useState<ObjectiveType>("appointment_booking");
  const [customObjectiveText, setCustomObjectiveText] = useState("");
  const [businessContext,    setBusinessContext]    = useState("");
  const [notes,              setNotes]              = useState("");
  const [enabledTools,       setEnabledTools]       = useState<EnabledTool[]>([]);
  const [calling,            setCalling]            = useState(false);
  const [error,              setError]              = useState("");
  const [success,            setSuccess]            = useState("");

  useEffect(() => {
    if (open) {
      setRecipientName("");
      setPhoneNumber("");
      setRecipientCategory("");
      setObjectiveType("appointment_booking");
      setCustomObjectiveText("");
      setBusinessContext("");
      setNotes("");
      setEnabledTools([]);
      setError("");
      setSuccess("");
    }
  }, [open]);

  function toggleTool(tool: EnabledTool) {
    setEnabledTools((prev) =>
      prev.includes(tool) ? prev.filter((t) => t !== tool) : [...prev, tool]
    );
  }

  async function handleCall() {
    const dest = phoneNumber.replace(/\s/g, "");
    if (!recipientName.trim()) {
      setError("Enter the recipient name");
      return;
    }
    if (!dest) {
      setError("Enter the phone number");
      return;
    }
    setError("");
    setSuccess("");
    setCalling(true);
    try {
      const call = await initiateCall({
        recipientName:       recipientName.trim(),
        phoneNumber:         dest,
        recipientCategory:   recipientCategory.trim() || undefined,
        objectiveType,
        customObjectiveText: objectiveType === "custom" ? customObjectiveText.trim() || undefined : undefined,
        businessContext:     businessContext.trim() || undefined,
        notes:               notes.trim() || undefined,
        enabledTools:        enabledTools.length > 0 ? enabledTools : undefined,
      });
      if (call.status === "failed") {
        setError(call.notes || "Call could not be placed. Try again shortly.");
      } else {
        setSuccess("Call placed — the recipient is being contacted now.");
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
      title="Create AI Call"
      icon={Phone}
      iconClassName="bg-emerald-500/15 text-emerald-300"
    >
      <div className="space-y-5">
        {error   && <StatusBanner variant="error">{error}</StatusBanner>}
        {success && <StatusBanner variant="success">{success}</StatusBanner>}

        {/* Recipient */}
        <label className="block">
          <span className="ops-label">Recipient name</span>
          <input
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
            className="ops-input"
            placeholder="e.g. Dr. Sharma / Apollo Pharmacy"
          />
        </label>

        <label className="block">
          <span className="ops-label">Phone number</span>
          <input
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            className="ops-input"
            placeholder="+91..."
            autoComplete="tel"
          />
        </label>

        <label className="block">
          <span className="ops-label">Recipient category <span className="opacity-50">(optional)</span></span>
          <input
            value={recipientCategory}
            onChange={(e) => setRecipientCategory(e.target.value)}
            className="ops-input"
            placeholder="e.g. pharmacy, hospital, clinic"
          />
        </label>

        {/* Objective */}
        <div>
          <p className="ops-label mb-2">Objective</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {OBJECTIVE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setObjectiveType(opt.id)}
                className={cn(
                  "ops-chip",
                  objectiveType === opt.id ? "ops-chip-active" : "ops-chip-inactive"
                )}
              >
                <span className="font-semibold">{opt.label}</span>
                <span className="mt-0.5 block text-[10px] opacity-70">{opt.hint}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Custom objective text — only shown when "custom" is selected */}
        {objectiveType === "custom" && (
          <label className="block">
            <span className="ops-label">Custom objective</span>
            <input
              value={customObjectiveText}
              onChange={(e) => setCustomObjectiveText(e.target.value)}
              className="ops-input"
              placeholder="Describe the call objective…"
            />
          </label>
        )}

        {/* Business context */}
        <label className="block">
          <span className="ops-label">Business context <span className="opacity-50">(optional)</span></span>
          <textarea
            value={businessContext}
            onChange={(e) => setBusinessContext(e.target.value)}
            className="ops-textarea"
            rows={3}
            placeholder="Background the AI should know before the call…"
          />
        </label>

        {/* Notes */}
        <label className="block">
          <span className="ops-label">Notes <span className="opacity-50">(optional)</span></span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="ops-textarea"
            rows={2}
            placeholder="Any extra instructions or reminders…"
          />
        </label>

        {/* Enabled tools */}
        <div>
          <p className="ops-label mb-2">Enabled tools <span className="opacity-50">(optional)</span></p>
          <div className="flex flex-wrap gap-2">
            {TOOL_OPTIONS.map((tool) => (
              <button
                key={tool.id}
                type="button"
                onClick={() => toggleTool(tool.id)}
                className={cn(
                  "ops-chip px-3 py-1.5",
                  enabledTools.includes(tool.id) ? "ops-chip-active" : "ops-chip-inactive"
                )}
              >
                {tool.label}
              </button>
            ))}
          </div>
        </div>

        <ActionButton
          variant="call"
          onClick={handleCall}
          isLoading={calling}
          disabled={!recipientName.trim() || !phoneNumber.trim()}
        >
          <Phone className="h-4 w-4" />
          Start call
        </ActionButton>
      </div>
    </ModalShell>
  );
}
