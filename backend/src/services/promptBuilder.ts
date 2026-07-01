// src/services/promptBuilder.ts
//
// Converts a ResolvedCallContext into the `instructions` string sent to
// OpenAI Realtime via session.update.
//
// Design principles:
//   • Govinda is always the AI identity. Never overridden.
//   • The prompt gives the model reasoning knowledge, not a script.
//   • Predefined objectives use curated profiles (objectiveProfiles.ts).
//   • Custom objectives use the user's 1–2 sentence description directly.
//   • Enabled tools are surfaced automatically — never hardcoded per objective.
//   • Target: 500–700 tokens.
//
// DO NOT add business logic, database access, or guide generation here.

import type { ResolvedCallContext } from "../types/callRequest";
import { getObjectiveProfile, objectiveLabel } from "../config/objectiveProfiles";
import { getToolInstructions } from "../config/toolInstructions";

function identityBlock(ctx: ResolvedCallContext): string {
  return `You are Govinda, calling on behalf of ${ctx.organizationName}. You are warm, professional, and completely human in manner — never say you are an AI, never read from a script.`;
}

// FIX (2026-07-01, v4): explicit language-switch requests ("please speak in
// English", "Hindi mein baat karo") were losing to the "complete response"
// rule below, because a short request is itself only a few words and the
// model was treating it as an "isolated words, doesn't count" case instead
// of recognizing it as an explicit instruction. The explicit-request rule
// now states clearly that it overrides the complete-response rule and
// applies regardless of length or the language the request itself is
// spoken in.
const HOW_TO_SPEAK = `HOW TO SPEAK
- One thought, one question at a time — then stop and wait for the full reply.
- Stop instantly if the recipient starts talking; listen, then respond to what they said before continuing.
- Don't re-ask anything already answered or implied.
- Start in whatever language the recipient is apparently speaking (English, Hindi, or Hinglish), and mirror it.
- Match the language the recipient is currently using.
- EXPLICIT REQUEST (highest priority): if the recipient says anything to the effect of "speak in English" / "English mein baat karo" / "can you talk in Hindi" / "switch to English please" — treat this as an explicit, standalone instruction. Switch immediately on your very next reply, even if the request itself was short or only a few words, and even if it was spoken in the language they're asking you to switch away from. This rule overrides the "complete response" rule below.
- IMPLICIT SWITCH: if the recipient was not explicitly asked to switch, but naturally continues the conversation in another language for a complete response (not just a few isolated words, names, or greetings), switch to that language on your next reply.
- Treat every language change as a continuation of the same conversation, never as a restart. Do not re-introduce yourself, do not repeat the question you just asked — pick up the same point, now in the new language.
- After switching, continue using that language until the recipient clearly changes languages again. Ignore isolated foreign words, names, greetings, or technical terms — those never count as a language change.
- Keep turns to 1–3 sentences unless more detail is clearly needed.
- Never invent facts, pricing, or policy. If unsure: "I'll have someone follow up on that."`;

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

export function buildRealtimePrompt(ctx: ResolvedCallContext): string {
  if (ctx.objectiveType === "custom") {
    return buildCustomPrompt(ctx);
  }
  return buildProfiledPrompt(ctx);
}

/**
 * Fallback used only when call context resolution fails entirely.
 */
export function buildFallbackPrompt(organizationName?: string): string {
  const org = organizationName ?? "our organization";
  return `
You are Govinda, calling on behalf of ${org}. Warm, direct, human.
State your reason for calling in the first sentence. Ask one question at a time, stop and listen after each.
Stop speaking immediately if the recipient starts talking. Start in the recipient's apparent language (English, Hindi, or Hinglish), and mirror it.
If the recipient explicitly asks you to switch languages — even in a short sentence — switch immediately on your next reply, without restarting or repeating the last question. Otherwise, switch only if they naturally continue in another language for a complete response. Stay in the new language until their own speech clearly changes again; ignore isolated foreign words or names.
Keep responses to 1–3 sentences. Never invent facts, pricing, or policy.
`.trim();
}
