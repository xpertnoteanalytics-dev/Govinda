// src/services/extractionDispatcher.ts
//
// ExtractionDispatcher is the ONLY file in the extraction pipeline that
// knows where data goes. ExtractionService never imports this file or
// anything it depends on; this file is the sole consumer of
// ExtractionResult.
//
// Reuses production models directly — Appointment and Feedback are NOT
// reimplemented, wrapped, or duplicated here. There is currently no
// service layer above either model in this codebase (the legacy
// appointmentExtractor.ts / feedbackExtractor.ts called Appointment.create()
// and Feedback.create() directly), so this Dispatcher does the same: it is
// the direct replacement for that call site, not a new layer on top of one
// that didn't exist.
//
// CRM, WhatsApp, and Callback dispatch targets do not exist as production
// modules yet (no crmService.ts / whatsappService.ts / callbackService.ts
// was found in this codebase at the time this file was written). Their
// dispatch functions below are real, typed, and wired into the routing
// table — but their bodies log the intended action and return
// dispatched: false with a clear reason, rather than pretending to write
// somewhere that doesn't exist. The moment a real module is built, only
// that one function's body needs to change — the routing table, the
// public dispatch() entrypoint, and ExtractionService remain untouched.
//
// Adding a brand-new section in the future (e.g. "labOrder") means:
//   1. Add the field to ExtractionResult in types/extraction.ts.
//   2. Add one dispatchX() function here.
//   3. Add one line to the routing table in dispatchExtraction().
// ExtractionService and every existing dispatch function are unaffected.

import { Appointment } from "../models/Appointment";
import { Feedback } from "../models/Feedback";
import { Call } from "../models/Call";
import type {
  AppointmentExtraction,
  CallbackExtraction,
  CrmExtraction,
  DispatchOutcome,
  DispatchReport,
  ExtractionResult,
  FeedbackExtraction,
  WhatsAppExtraction,
} from "../types/extraction";

// ---------------------------------------------------------------------------
// Context every dispatch function needs
// ---------------------------------------------------------------------------

export interface DispatchContext {
  tenantId: string;
  /** The Call document this extraction came from, if the source was a phone call. Optional — chat/WhatsApp sources may not have one. */
  callId?: string;
  /** Recipient/patient phone number, if known from the source conversation — used as a fallback when a section doesn't carry its own phone field. */
  fallbackPhone?: string;
  source: "ai_phone_call" | "ai_chat" | "whatsapp";
}

// ---------------------------------------------------------------------------
// Appointment — reuses the existing Appointment model exactly as-is
// ---------------------------------------------------------------------------

async function dispatchAppointment(
  data: AppointmentExtraction,
  ctx: DispatchContext
): Promise<DispatchOutcome> {
  try {
    const doc = await Appointment.create({
      tenantId: ctx.tenantId,
      patientName: data.patientName,
      phone: data.phone ?? ctx.fallbackPhone,
      service: data.service,
      appointmentDate: data.appointmentDate,
      appointmentTime: data.appointmentTime,
      source: ctx.source,
      notes: data.notes,
    });
    return { section: "appointment", dispatched: true, recordId: doc._id.toString() };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "Unknown error";
    console.error("[extractionDispatcher] appointment dispatch failed:", reason);
    return { section: "appointment", dispatched: false, reason };
  }
}

// ---------------------------------------------------------------------------
// Feedback — reuses the existing Feedback model exactly as-is
// ---------------------------------------------------------------------------

async function dispatchFeedback(
  data: FeedbackExtraction,
  ctx: DispatchContext
): Promise<DispatchOutcome> {
  try {
    const doc = await Feedback.create({
      tenantId: ctx.tenantId,
      patientName: data.patientName,
      feedback: data.feedback,
      sentiment: data.sentiment,
      source: ctx.source,
    });
    return { section: "feedback", dispatched: true, recordId: doc._id.toString() };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "Unknown error";
    console.error("[extractionDispatcher] feedback dispatch failed:", reason);
    return { section: "feedback", dispatched: false, reason };
  }
}

// ---------------------------------------------------------------------------
// CRM — no production CRM module found in this codebase. Stubbed honestly:
// logs the intended push and reports dispatched: false until a real
// crmService.ts exists for this to call into.
// ---------------------------------------------------------------------------

async function dispatchCrm(data: CrmExtraction, ctx: DispatchContext): Promise<DispatchOutcome> {
  console.log("[extractionDispatcher] CRM section extracted but no CRM module is wired yet:", {
    tenantId: ctx.tenantId,
    data,
  });
  return { section: "crm", dispatched: false, reason: "CRM module not yet implemented" };
}

// ---------------------------------------------------------------------------
// WhatsApp — env.whatsapp config exists (provider: log/twilio/meta), but no
// whatsappService.ts send function was confirmed in this codebase. Stubbed
// the same way: logs intent, does not silently assume a sender exists.
// ---------------------------------------------------------------------------

async function dispatchWhatsApp(
  data: WhatsAppExtraction,
  ctx: DispatchContext
): Promise<DispatchOutcome> {
  console.log("[extractionDispatcher] WhatsApp section extracted but no sender is wired yet:", {
    tenantId: ctx.tenantId,
    data,
  });
  return { section: "whatsapp", dispatched: false, reason: "WhatsApp dispatcher not yet implemented" };
}

// ---------------------------------------------------------------------------
// Callback — no production callback-scheduling module found. Stubbed the
// same way.
// ---------------------------------------------------------------------------

async function dispatchCallback(
  data: CallbackExtraction,
  ctx: DispatchContext
): Promise<DispatchOutcome> {
  console.log("[extractionDispatcher] Callback section extracted but no scheduler is wired yet:", {
    tenantId: ctx.tenantId,
    data,
  });
  return { section: "callback", dispatched: false, reason: "Callback scheduler not yet implemented" };
}

// ---------------------------------------------------------------------------
// Generic Call fields — summary / sentiment / extractedData write back onto
// the Call document itself (the generic, schema-less fields added for
// exactly this purpose). Only applies when the source was a phone call and
// a callId is available.
// ---------------------------------------------------------------------------

async function dispatchCallFields(
  result: Pick<ExtractionResult, "summary" | "sentiment" | "extractedData">,
  ctx: DispatchContext
): Promise<DispatchOutcome[]> {
  const outcomes: DispatchOutcome[] = [];
  const updates: Record<string, unknown> = {};

  if (result.summary) updates.summary = result.summary;
  if (result.sentiment) updates.sentiment = result.sentiment;
  if (result.extractedData) updates.extractedData = result.extractedData;

  if (Object.keys(updates).length === 0) return outcomes;

  if (!ctx.callId) {
    for (const key of Object.keys(updates)) {
      outcomes.push({
        section: key as "summary" | "sentiment" | "extractedData",
        dispatched: false,
        reason: "No callId in dispatch context — nothing to attach this to",
      });
    }
    return outcomes;
  }

  try {
    await Call.findByIdAndUpdate(ctx.callId, { $set: updates });
    for (const key of Object.keys(updates)) {
      outcomes.push({ section: key as "summary" | "sentiment" | "extractedData", dispatched: true, recordId: ctx.callId });
    }
  } catch (err) {
    const reason = err instanceof Error ? err.message : "Unknown error";
    console.error("[extractionDispatcher] call field update failed:", reason);
    for (const key of Object.keys(updates)) {
      outcomes.push({ section: key as "summary" | "sentiment" | "extractedData", dispatched: false, reason });
    }
  }

  return outcomes;
}

// ---------------------------------------------------------------------------
// Public API — the routing table
// ---------------------------------------------------------------------------

/**
 * Routes each populated section of an ExtractionResult to its target
 * module. Sections absent from the result are skipped (not dispatched,
 * not errored — there was simply nothing to do).
 *
 * This is the single place that decides "where" data goes. Nothing about
 * how Appointment or Feedback are stored leaks back into ExtractionService
 * — this function is the boundary.
 */
export async function dispatchExtraction(
  result: ExtractionResult,
  ctx: DispatchContext
): Promise<DispatchReport> {
  const outcomes: DispatchOutcome[] = [];

  if (result.appointment) {
    outcomes.push(await dispatchAppointment(result.appointment, ctx));
  }
  if (result.feedback) {
    outcomes.push(await dispatchFeedback(result.feedback, ctx));
  }
  if (result.crm) {
    outcomes.push(await dispatchCrm(result.crm, ctx));
  }
  if (result.whatsapp) {
    outcomes.push(await dispatchWhatsApp(result.whatsapp, ctx));
  }
  if (result.callback) {
    outcomes.push(await dispatchCallback(result.callback, ctx));
  }

  outcomes.push(...(await dispatchCallFields(result, ctx)));

  return { callId: ctx.callId, outcomes };
}
