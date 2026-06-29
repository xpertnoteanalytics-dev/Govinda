// src/config/toolCompatibility.ts
//
// Tool compatibility is deliberately NOT keyed by objective. An objective is
// a starting intent, not a ceiling on how the call can evolve — a feedback
// call can end in a booked appointment, a sales call can end in a human
// transfer, a reminder call can trigger a callback. Blocking a tool because
// it's "unusual" for the stated objective blocks exactly the kind of natural
// conversational drift this system is designed to allow.
//
// What CAN legitimately be rejected:
//   1. Unknown tool values (not in the CallTool union at all).
//   2. Duplicate entries in the same request (data hygiene, not semantics).
//   3. Genuinely conflicting tool PAIRS — two tools that cannot both be true
//      for the same call because they describe mutually exclusive outcomes
//      or mechanisms. This is checked independently of objective.
//
// As of this writing, none of the six existing tools conflict with each
// other — appointment_booking, crm_update, human_transfer,
// whatsapp_followup, callback_schedule, and post_call_extraction are all
// orthogonal capabilities that can coexist on the same call. CONFLICT_PAIRS
// below is therefore empty, on purpose, not as a placeholder oversight. It
// exists so that if a future tool is added that genuinely cannot coexist
// with another (e.g. a hypothetical "auto_disconnect" tool that would
// conflict with "human_transfer"), there's a single place to declare that —
// without resurrecting an objective-keyed allowlist.

import type { CallTool } from "../types/callRequest";

const ALL_TOOLS: readonly CallTool[] = [
  "appointment_booking",
  "crm_update",
  "human_transfer",
  "whatsapp_followup",
  "callback_schedule",
  "post_call_extraction",
];

/**
 * Pairs of tools that cannot both be enabled on the same call, regardless
 * of objective. Each pair is unordered — declare it once per conflicting
 * pair. Empty today; see file header for why that's intentional.
 */
const CONFLICT_PAIRS: ReadonlyArray<readonly [CallTool, CallTool]> = [];

export interface ToolValidationResult {
  /** Tool values that aren't valid CallTool members at all. */
  unknown: string[];
  /** Tool values repeated more than once in the same request. */
  duplicates: CallTool[];
  /** Pairs of enabled tools that conflict with each other. */
  conflicts: Array<[CallTool, CallTool]>;
}

function isKnownTool(value: string): value is CallTool {
  return (ALL_TOOLS as readonly string[]).includes(value);
}

/**
 * Validates a requested tool list against the only things that are ever
 * actually invalid: unknown values, duplicates, and declared conflicts.
 * Never rejects a combination merely because it's atypical for an
 * objective — that judgment belongs to the conversation, not validation.
 */
export function validateTools(tools: string[] | undefined): ToolValidationResult {
  const result: ToolValidationResult = { unknown: [], duplicates: [], conflicts: [] };
  if (!tools || tools.length === 0) return result;

  const seen = new Set<CallTool>();
  for (const value of tools) {
    if (!isKnownTool(value)) {
      result.unknown.push(value);
      continue;
    }
    if (seen.has(value)) {
      result.duplicates.push(value);
      continue;
    }
    seen.add(value);
  }

  for (const [a, b] of CONFLICT_PAIRS) {
    if (seen.has(a) && seen.has(b)) {
      result.conflicts.push([a, b]);
    }
  }

  return result;
}

/** True if validateTools() found nothing wrong with the request. */
export function isValidToolCombination(tools: string[] | undefined): boolean {
  const { unknown, duplicates, conflicts } = validateTools(tools);
  return unknown.length === 0 && duplicates.length === 0 && conflicts.length === 0;
}

/**
 * Human-readable reasons for a failed validation, suitable for a 400
 * response or a validator error message. Empty array if valid.
 */
export function describeToolViolations(tools: string[] | undefined): string[] {
  const { unknown, duplicates, conflicts } = validateTools(tools);
  const messages: string[] = [];
  if (unknown.length > 0) {
    messages.push(`Unknown tool(s): ${unknown.join(", ")}`);
  }
  if (duplicates.length > 0) {
    messages.push(`Duplicate tool(s): ${duplicates.join(", ")}`);
  }
  for (const [a, b] of conflicts) {
    messages.push(`'${a}' and '${b}' cannot both be enabled on the same call`);
  }
  return messages;
}
