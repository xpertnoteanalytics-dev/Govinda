// src/types/extraction.ts
//
// Strong typing contract between ExtractionService and ExtractionDispatcher.
//
// ExtractionService produces an ExtractionResult. ExtractionDispatcher
// consumes one. Neither side needs to know anything about the other's
// internals — this file is the only thing they share.
//
// Every section is optional: Gemini returns a section only when the
// conversation actually contained that kind of content. An absent section
// means "nothing to dispatch," not "extraction failed."

import type { CallObjectiveType, CallTool } from "./callRequest";

// ---------------------------------------------------------------------------
// Input — exactly the fields the brief specifies, nothing more
// ---------------------------------------------------------------------------

export interface ExtractionInput {
  tenantId: string;
  conversationTranscript: string;
  conversationSummary?: string;
  objectiveType: CallObjectiveType;
  enabledTools?: CallTool[];
}

// ---------------------------------------------------------------------------
// Output sections
// ---------------------------------------------------------------------------
//
// Field names below intentionally match the existing Appointment/Feedback
// Mongoose schemas so the Dispatcher can pass them through with minimal
// remapping. This is the contract Gemini is prompted to fill in — see
// extractionService.ts's EXTRACTION_SCHEMA_DESCRIPTION.

export interface AppointmentExtraction {
  patientName?: string;
  phone?: string;
  service?: string;
  appointmentDate?: string;
  appointmentTime?: string;
  notes?: string;
}

export interface FeedbackExtraction {
  patientName?: string;
  feedback?: string;
  sentiment?: "positive" | "neutral" | "negative";
}

/**
 * CRM, WhatsApp, and Callback sections are intentionally loose
 * (Record<string, unknown>) rather than fully typed today. Their target
 * dispatchers don't exist yet as production modules — typing them
 * precisely now would mean guessing a contract no real consumer has
 * confirmed. Each can be narrowed to a real interface the moment its
 * dispatcher is built, without touching ExtractionService.
 */
export type CrmExtraction = Record<string, unknown>;
export type WhatsAppExtraction = Record<string, unknown>;
export type CallbackExtraction = Record<string, unknown>;

export interface ExtractionResult {
  summary?: string;
  sentiment?: "positive" | "neutral" | "negative";
  appointment?: AppointmentExtraction;
  feedback?: FeedbackExtraction;
  crm?: CrmExtraction;
  whatsapp?: WhatsAppExtraction;
  callback?: CallbackExtraction;
  /** Generic catch-all for anything that doesn't fit a named section yet. */
  extractedData?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Dispatch outcome — what the Dispatcher reports back per section
// ---------------------------------------------------------------------------

export type DispatchSection =
  | "summary"
  | "sentiment"
  | "appointment"
  | "feedback"
  | "crm"
  | "whatsapp"
  | "callback"
  | "extractedData";

export interface DispatchOutcome {
  section: DispatchSection;
  dispatched: boolean;
  /** Present when dispatched is true and the target created/updated a record. */
  recordId?: string;
  /** Present when dispatched is false — either skipped (no data) or errored. */
  reason?: string;
}

export interface DispatchReport {
  callId?: string;
  outcomes: DispatchOutcome[];
}
