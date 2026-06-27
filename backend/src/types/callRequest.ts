// src/types/callRequest.ts
//
// The ONLY input surface the frontend needs to initiate a call.
//
// Govinda is the permanent AI identity and never changes.
// The organization name comes from the tenant record (logged-in user's company).
// The user never writes a script. They describe an objective.
//
// Future capabilities (appointment booking, CRM updates, WhatsApp, human
// transfer, post-call extraction) are modelled as optional tool declarations
// that the engine can receive without any change to its core reasoning loop.

// ---------------------------------------------------------------------------
// Predefined objectives
// ---------------------------------------------------------------------------

/**
 * Every predefined objective maps to a curated reasoning profile:
 * tone, strategy, success criteria, and typical information to collect.
 *
 * "custom" allows the user to write 1–2 sentences describing the goal.
 * The engine reasons from those sentences exactly as it would from a
 * predefined objective — no script is ever produced or stored.
 */
export type CallObjectiveType =
  | "appointment_booking"
  | "feedback_collection"
  | "pharmacy_inquiry"
  | "doctor_verification"
  | "hospital_onboarding"
  | "sales_outreach"
  | "insurance_verification"
  | "lab_result_followup"
  | "patient_reminder"
  | "custom";

// ---------------------------------------------------------------------------
// Future-ready tool declarations
// ---------------------------------------------------------------------------

/**
 * Optional capabilities that may be activated for a call.
 * Declaring a tool here does NOT change the conversation engine — it
 * signals to the tool dispatcher (not yet built) that these actions
 * are permitted during this call.
 *
 * Add new tool types here freely. The engine is unaffected.
 */
export type CallTool =
  | "appointment_booking"   // write a confirmed slot to the calendar system
  | "crm_update"            // push collected data to the CRM after the call
  | "human_transfer"        // hand the call to a human agent on request
  | "whatsapp_followup"     // send a WhatsApp summary after the call ends
  | "callback_schedule"     // schedule an automatic callback if call is missed
  | "post_call_extraction"; // extract structured data from the transcript

// ---------------------------------------------------------------------------
// The complete call request
// ---------------------------------------------------------------------------

/**
 * CallRequest — the single input contract for initiating any outbound call.
 *
 * The frontend sends this. The backend resolves the organization name from
 * the tenant record (never trusted from the frontend). Govinda is hardcoded
 * as the AI identity.
 *
 * No script field. No scriptType field. No guide field.
 */
export interface CallRequest {
  // ── Who is being called ──────────────────────────────────────────────────

  /** Display name of the person or business being called. */
  recipientName: string;

  /** Phone number in E.164 or local format. Backend normalises. */
  phoneNumber: string;

  /**
   * Optional internal reference ID for the place/contact.
   * Stored for CRM linkage; never used in the conversation.
   */
  placeId?: string;

  /**
   * Category of the recipient, e.g. "Retail Pharmacy", "Specialist Clinic".
   * Used to calibrate tone and anticipate domain-specific responses.
   */
  recipientCategory?: string;

  // ── What the call is about ───────────────────────────────────────────────

  /** Which predefined objective governs this call, or "custom". */
  objectiveType: CallObjectiveType;

  /**
   * Required when objectiveType is "custom".
   * 1–2 sentences describing the goal in plain language.
   * e.g. "Check whether this hospital accepts third-party lab reports
   *       for ICU admissions and find out the right department to contact."
   *
   * Ignored (and need not be sent) for all predefined objectives.
   */
  customObjectiveText?: string;

  // ── Optional enrichment ──────────────────────────────────────────────────

  /**
   * Additional background the AI should know but not recite.
   * e.g. "Patient is 72 years old. Previous appointment was cancelled."
   * Max 500 characters. Free-form.
   */
  businessContext?: string;

  /**
   * Short operational notes the user wants to pass.
   * e.g. "Ask for Dr. Mehta specifically."
   * Max 200 characters.
   */
  notes?: string;

  // ── Future tool activations ──────────────────────────────────────────────

  /**
   * Optional list of tools the call is permitted to use.
   * Declaring tools here does NOT change the conversation engine.
   * The tool dispatcher (future) reads this list and activates accordingly.
   */
  enabledTools?: CallTool[];
}

// ---------------------------------------------------------------------------
// Stored call record enrichment (resolved at initiation time)
// ---------------------------------------------------------------------------

/**
 * The resolved, storage-ready version of a CallRequest.
 * Created by callService.initiateCall() after resolving the tenant.
 * This is what is written to MongoDB — never the raw CallRequest.
 */
export interface ResolvedCallContext {
  /** Always "Govinda" — never overridden. */
  aiIdentity: "Govinda";

  /** Resolved from the tenant record. Never trusted from the frontend. */
  organizationName: string;

  recipientName: string;
  recipientCategory?: string;
  objectiveType: CallObjectiveType;
  customObjectiveText?: string;
  businessContext?: string;
  notes?: string;
  enabledTools?: CallTool[];
}
