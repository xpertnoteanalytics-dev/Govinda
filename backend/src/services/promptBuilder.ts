// src/services/promptBuilder.ts
//
// Single responsibility: convert a ResolvedCallContext into the `instructions`
// string sent to OpenAI Realtime via session.update.
//
// Design principles:
//   • Govinda is always the AI identity. Never overridden.
//   • The prompt gives the model reasoning knowledge, not a script.
//   • Predefined objectives use curated profiles (objectiveProfiles.ts).
//   • Custom objectives use the user's 1–2 sentence description directly.
//   • Enabled tools are surfaced automatically — never hardcoded per objective.
//   • Target: 500–700 tokens. Every line earns its place; nothing already
//     implied by the objective or by general model competence is restated.
//
// DO NOT add business logic, database access, or guide generation here.
// This file only transforms a ResolvedCallContext into a string.

import type { ResolvedCallContext } from "../types/callRequest";
import { getObjectiveProfile, objectiveLabel } from "../config/objectiveProfiles";
import { getToolInstructions } from "../config/toolInstructions";

// ---------------------------------------------------------------------------
// Shared fragments
// ---------------------------------------------------------------------------
//
// Identical across both builders below. Kept as single constants instead of
// being written twice — duplication was the single largest source of wasted
// tokens in the previous version (the same six speaking rules were spelled
// out in full in both buildProfiledPrompt and buildCustomPrompt).

function identityBlock(ctx: ResolvedCallContext): string {
  return `You are Govinda, calling on behalf of ${ctx.organizationName}. You are warm, professional, and completely human in manner — never say you are an AI, never read from a script.`;
}

// FIX (2026-06-30, v3): "track turn by turn" + "just speaking it is enough"
// was over-sensitive on GPT-4o Realtime — a single English word or name
// inside an otherwise-Hindi reply could flip the whole conversation.
// Tightened the trigger to require a COMPLETE response in another language
// (not isolated words), making the switch condition more deterministic and
// less prone to false positives. Still preserves: explicit-request switch,
// implicit (no-announcement) switch, no restart, no re-introduction, no
// repeating the last question, and stickiness until the recipient clearly
// changes language again (with foreign words/names/greetings explicitly
// excluded from counting as a change).
const HOW_TO_SPEAK = `HOW TO SPEAK
• One thought, one question at a time — then stop and wait for the full reply.
• Stop instantly if the recipient starts talking; listen, then respond to what they said before continuing.
• Don't re-ask anything already answered or implied.
• Start in whatever language the recipient is apparently speaking (English, Hindi, or Hinglish), and mirror it.
• Match the language the recipient is currently using.
• If the recipient explicitly asks to change languages, switch immediately.
• If the recipient naturally continues the conversation in another language for a complete response (not just a few isolated words), switch to that language on your very next reply.
• Treat the language change as a continuation of the same conversation, never as a restart.
• A switch is a continuation, never a reset: do not restart the conversation, do not re-introduce yourself, and do not repeat the question you just asked — pick up the same point you were on, now in the new language.
• After switching, continue using that language until the recipient clearly changes languages again. Ignore isolated foreign words, names, greetings, or technical terms.
• Keep turns to 1–3 sentences unless more detail is clearly needed.
• Never invent facts, pricing, or policy. If unsure: "I'll have someone follow up on that."`;

function contextBlock(ctx: ResolvedCallContext): string {
  const lines = [
    ctx.businessContext ? `Background: ${ctx.businessContext}` : "",
    ctx.notes ? `Notes: ${ctx.notes}` : "",
    ctx.recipientCategory ? `Recipient type: ${ctx.recipientCategory}` : "",
  ].filter(Boolean);
  return lines.length ? `CONTEXT (know this; never recite it)\n${lines.join("\n")}\n\n` : "";
}

function toolsBlock(ctx: ResolvedCallContext): string {
  const tools = getToolInstructions(ctx.enabledTools);
  if (tools.length === 0) return "";
  const lines = tools.map((t) => `• ${t.label}: ${t.instruction}`).join("\n");
  return `TOOLS AVAILABLE\n${lines}\n\n`;
}

function bulleted(items: string[]): string {
  return items.map((item) => `• ${item}`).join("\n");
}

// ---------------------------------------------------------------------------
// Main prompt builder — predefined objective
// ---------------------------------------------------------------------------

function buildProfiledPrompt(ctx: ResolvedCallContext): string {
  const profile = getObjectiveProfile(ctx.objectiveType)!;
  const label = objectiveLabel(ctx.objectiveType);

  const collectBlock = profile.informationToCollect
    .map((c) => `${c.required ? "[required]" : "[optional]"} ${c.field} — ${c.hint}`)
    .join("\n");

  const qaBlock = profile.likelyQuestions
    .map((q) => `Q: ${q.question}\nA: ${q.answerGuidance}`)
    .join("\n");

  const objectionBlock = profile.likelyObjections
    .map((o) => `"${o.objection}" → ${o.approach}`)
    .join("\n");

  return `
${identityBlock(ctx)}

CALL TYPE: ${label} | RECIPIENT: ${ctx.recipientName}

OBJECTIVE
${profile.successCriteria}

STRATEGY
${profile.conversationStrategy}

${contextBlock(ctx)}${toolsBlock(ctx)}COLLECT BEFORE CLOSING
${collectBlock}

LIKELY QUESTIONS
${qaBlock}

LIKELY OBJECTIONS
${objectionBlock}

CLOSING
${profile.closingGuidance}

${HOW_TO_SPEAK}
${profile.callRules.length ? `\nCALL-SPECIFIC RULES\n${bulleted(profile.callRules)}` : ""}
`.trim();
}

// ---------------------------------------------------------------------------
// Custom objective prompt builder
// ---------------------------------------------------------------------------

function buildCustomPrompt(ctx: ResolvedCallContext): string {
  const objective =
    ctx.customObjectiveText ??
    "Conduct a professional outreach call and achieve the best possible outcome for the caller.";

  return `
${identityBlock(ctx)}

RECIPIENT: ${ctx.recipientName}

OBJECTIVE
${objective}

${contextBlock(ctx)}${toolsBlock(ctx)}APPROACH
Reason from the objective above — decide the path through the conversation as it unfolds. Open by introducing yourself, then state your reason for calling in one clear sentence. Track what's covered. Close gracefully once the objective is met, summarising what was agreed. If the conversation drifts, use a short bridge back to the objective.

${HOW_TO_SPEAK}
`.trim();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build the OpenAI Realtime `instructions` string from a resolved call context.
 *
 * For predefined objectives: uses the curated ObjectiveProfile.
 * For custom objectives: uses the user's description as the reasoning anchor.
 */
export function buildRealtimePrompt(ctx: ResolvedCallContext): string {
  if (ctx.objectiveType === "custom") {
    return buildCustomPrompt(ctx);
  }
  return buildProfiledPrompt(ctx);
}

// ---------------------------------------------------------------------------
// Fallback prompt — used only when context resolution fails entirely
// ---------------------------------------------------------------------------

/**
 * Absolute minimum fallback used when even the call context cannot be resolved.
 * Should never occur in normal operation.
 */
export function buildFallbackPrompt(organizationName?: string): string {
  const org = organizationName ?? "our organization";
  return `
You are Govinda, calling on behalf of ${org}. Warm, direct, human.
State your reason for calling in the first sentence. Ask one question at a time, stop and listen after each.
Stop speaking immediately if the recipient starts talking. Start in the recipient's apparent language (English, Hindi, or Hinglish), and switch immediately — without restarting or repeating the last question — the moment they either ask to switch or simply continue in another language themselves; stay in the new language until their own speech clearly changes again.
Keep responses to 1–3 sentences. Never invent facts, pricing, or policy.
`.trim();
}
