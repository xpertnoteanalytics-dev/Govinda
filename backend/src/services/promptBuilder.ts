// src/services/promptBuilder.ts
//
// Single responsibility: convert a ConversationGuide into the `instructions`
// string sent to OpenAI Realtime via session.update.
//
// Design target: 700–1000 tokens in the rendered output.
// Every sentence either (a) gives the model call-specific knowledge it cannot
// infer, or (b) corrects a failure mode observed in live calls.
// Nothing else belongs here.

import type { ConversationGuide } from "../types/conversationGuide";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function numbered(items: string[]): string {
  return items.map((item, i) => `${i + 1}. ${item}`).join("\n");
}

function bulleted(items: string[]): string {
  return items.map((item) => `• ${item}`).join("\n");
}

// ---------------------------------------------------------------------------
// Main builder
// ---------------------------------------------------------------------------

export function buildRealtimePrompt(guide: ConversationGuide): string {
  const lang = guide.defaultLanguage ?? "English";

  // Background: only render non-empty fields, inline, no section headers.
  const backgroundParts: string[] = [];
  if (guide.businessContext)    backgroundParts.push(guide.businessContext);
  if (guide.knownInformation)   backgroundParts.push(`Already known: ${guide.knownInformation}`);
  if (guide.recipientProfile)   backgroundParts.push(`Recipient: ${guide.recipientProfile}`);
  if (guide.conversationStrategy) backgroundParts.push(`Approach: ${guide.conversationStrategy}`);
  const backgroundBlock = backgroundParts.join(" ");

  // Talking points: compact numbered list.
  const talkingPointsBlock = numbered(guide.talkingPoints);

  // Collect: required first, then optional. One line each.
  const collectBlock = guide.informationToCollect
    .sort((a, b) => (b.required ? 1 : 0) - (a.required ? 1 : 0))
    .map((c) => {
      const tag = c.required ? "[required]" : "[optional]";
      const hint = c.collectionHint ? ` (${c.collectionHint})` : "";
      return `${tag} ${c.field}${hint}`;
    })
    .join("\n");

  // Q&A: compact, one pair per block.
  const qaBlock = guide.anticipatedQuestions
    .map((q) => `Q: ${q.question}\nA: ${q.answerGuidance}`)
    .join("\n\n");

  // Objections: acknowledge → strategy, no scripted wording.
  const objectionBlock = guide.objectionHandlers
    .map((o) => `"${o.objection}" → ${o.approach}`)
    .join("\n");

  // Call-specific rules: only if present.
  const rulesBlock = guide.callSpecificRules?.length
    ? `\nCALL RULES\n${bulleted(guide.callSpecificRules)}`
    : "";

  const closing = guide.closingStrategy
    ? guide.closingStrategy
    : "Summarise what was agreed, confirm next step, thank them by name, end the call.";

  return `
You are ${guide.callerIdentity} calling ${guide.recipientName}.
You are a senior healthcare executive — human, warm, direct.

OBJECTIVE
${guide.callObjective}

BACKGROUND (know this; never say it)
${backgroundBlock}

TOPICS TO COVER — weave in naturally; skip what is already answered
${talkingPointsBlock}

COLLECT BEFORE CLOSING
${collectBlock}

IF CUSTOMER ASKS
${qaBlock}

IF CUSTOMER OBJECTS
${objectionBlock}

CLOSING
${closing}
${guide.nextAction ? `After call: ${guide.nextAction}` : ""}
${rulesBlock}

HOW TO SPEAK
- One thought. One question. Then stop. Wait for the full reply before speaking again.
- Never ask about something the customer already answered or implied.
- When the objective is achieved and all required fields are collected: close the call. Do not keep talking.
- If the customer starts speaking while you are: stop immediately. Respond to what they said. Do not resume your previous sentence.
- Answer the customer's question first. Then return to the objective with a short natural bridge.
- Default language: ${lang}. Mirror the customer — English, Hindi, or Hinglish. Never switch to any other language.
- Never invent medical facts, pricing, or policies. If you don't know: "I'll have someone from our team follow up on that."
`.trim();
}

// ---------------------------------------------------------------------------
// Fallback prompt — used only when no guide is available
// ---------------------------------------------------------------------------

export function buildFallbackPrompt(): string {
  return `
You are a professional healthcare executive from Govinda AI making a phone call.
Be warm, direct, and brief. Keep every response to 1–2 sentences.
Ask one question at a time. Stop speaking immediately after asking.
If the customer starts talking while you are: stop and listen.
Mirror the customer's language — English, Hindi, or Hinglish.
Never invent medical information, pricing, or policies.
`.trim();
}
