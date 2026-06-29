// src/services/extractionTrigger.ts
//
// This is the ONLY place in the codebase that calls runExtraction() and
// dispatchExtraction() together. Every conversation channel — AI Phone
// Call, AI Chat, and future WhatsApp — calls into this file, never into
// extractionService.ts or extractionDispatcher.ts directly. That's what
// makes this "exactly one extraction pipeline" rather than three call
// sites independently wiring the same two functions together.
//
// Why this file exists instead of inlining the two calls at each trigger
// point: every caller needs the same safety guarantees —
//   1. Never throw back into the conversation flow. A failed extraction
//      must never break a phone call hangup or a chat response.
//   2. Run asynchronously — callers fire-and-forget; they do not await
//      completion before moving on.
//   3. Log clearly enough to debug, without being relied upon as the
//      result path (nothing reads this function's return value for
//      anything user-facing).
// Without this file, each of the three trigger points would need to
// reimplement all three guarantees independently — exactly the kind of
// duplicated logic this integration is meant to eliminate.

import { runExtraction } from "./extractionService";
import { dispatchExtraction, type DispatchContext } from "./extractionDispatcher";
import type { CallObjectiveType, CallTool } from "../types/callRequest";

// ---------------------------------------------------------------------------
// Phone call trigger
// ---------------------------------------------------------------------------

export interface RunForCallParams {
  tenantId: string;
  callId: string;
  /** Joined transcript text accumulated by realtimeBridge.ts during the call. */
  transcript: string;
  conversationSummary?: string;
  objectiveType: CallObjectiveType;
  enabledTools?: CallTool[];
  /** Recipient phone number, used as a fallback if a section omits its own. */
  recipientPhone?: string;
}

/**
 * Fire-and-forget entrypoint for a finished AI Phone Call. Intended to be
 * called without awaiting — callers should call this and move on (e.g.
 * after closing the Exotel/OpenAI sockets), not block call teardown on it.
 */
export function runForCall(params: RunForCallParams): void {
  void executeAndReport({
    tenantId: params.tenantId,
    conversationTranscript: params.transcript,
    conversationSummary: params.conversationSummary,
    objectiveType: params.objectiveType,
    enabledTools: params.enabledTools,
    dispatchContext: {
      tenantId: params.tenantId,
      callId: params.callId,
      fallbackPhone: params.recipientPhone,
      source: "ai_phone_call",
    },
    logLabel: `call ${params.callId}`,
  });
}

// ---------------------------------------------------------------------------
// Chat trigger
// ---------------------------------------------------------------------------

export interface RunForChatParams {
  tenantId: string;
  userMessage: string;
  aiResponse: string;
  /** Recipient phone number, if known from the chat session — optional. */
  patientPhone?: string;
}

/**
 * Fire-and-forget entrypoint for a finished AI Chat turn. Replaces the
 * three legacy calls (extractAppointmentAndSave, extractFeedbackAndSave,
 * extractOperationalIntent) at the chat call site with this one function,
 * preserving the same (userMessage, aiResponse, tenantId) inputs the
 * legacy functions used — so swapping the call site is a drop-in change.
 *
 * Chat has no objective-type concept today (that's a phone-call-specific
 * field on ResolvedCallContext). "custom" is used here deliberately: it's
 * the one CallObjectiveType that doesn't try to pattern-match a curated
 * objective profile, which is correct for a channel that doesn't have one.
 */
export function runForChat(params: RunForChatParams): void {
  const conversationTranscript = `User: ${params.userMessage}\nAI: ${params.aiResponse}`;

  void executeAndReport({
    tenantId: params.tenantId,
    conversationTranscript,
    objectiveType: "custom",
    dispatchContext: {
      tenantId: params.tenantId,
      fallbackPhone: params.patientPhone,
      source: "ai_chat",
    },
    logLabel: "chat turn",
  });
}

// ---------------------------------------------------------------------------
// Shared execution path
// ---------------------------------------------------------------------------

interface ExecuteParams {
  tenantId: string;
  conversationTranscript: string;
  conversationSummary?: string;
  objectiveType: CallObjectiveType;
  enabledTools?: CallTool[];
  dispatchContext: DispatchContext;
  logLabel: string;
}

async function executeAndReport(params: ExecuteParams): Promise<void> {
  try {
    const result = await runExtraction({
      tenantId: params.tenantId,
      conversationTranscript: params.conversationTranscript,
      conversationSummary: params.conversationSummary,
      objectiveType: params.objectiveType,
      enabledTools: params.enabledTools,
    });

    const report = await dispatchExtraction(result, params.dispatchContext);

    const dispatchedSections = report.outcomes.filter((o) => o.dispatched).map((o) => o.section);
    console.log(
      `[extractionTrigger] extraction complete for ${params.logLabel} | dispatched: [${dispatchedSections.join(", ") || "none"}]`
    );
  } catch (err) {
    // Extraction is best-effort. A failure here must never propagate back
    // into the conversation flow that triggered it — the call has already
    // ended, or the chat reply has already been sent.
    console.error(
      `[extractionTrigger] extraction failed for ${params.logLabel}:`,
      err instanceof Error ? err.message : err
    );
  }
}
