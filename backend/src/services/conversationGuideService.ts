// src/services/conversationGuideService.ts
//
// Responsible for producing a ConversationGuide from two possible sources:
//
//   1. generateGuide()        — AI-first path. User clicks "Generate AI Script".
//                               Gemini receives a structured knowledge-generation
//                               prompt and returns a ConversationGuide as JSON.
//
//   2. convertScriptToGuide() — User-written script path. User types their own
//                               script (dialogue-style or freeform).
//                               Gemini extracts business intent and converts it
//                               into the SAME ConversationGuide format.
//                               The original wording is discarded entirely.
//
// Both paths return an identical ConversationGuide structure.
// Downstream code (promptBuilder, realtimeBridge) never knows which path was
// used — there is exactly ONE conversation engine.
//
// This service is completely independent of OpenAI. It has no knowledge of
// Realtime, WebSockets, or audio. It is purely a knowledge-structuring layer.

import { GoogleGenerativeAI } from "@google/generative-ai";
import Bottleneck from "bottleneck";
import { env } from "../config/env";
import type {
  ConversationGuide,
  ObjectionHandler,
  AnticipatedQuestion,
  CollectionField,
  ConversationBranch,
} from "../types/conversationGuide";

// ---------------------------------------------------------------------------
// Rate limiter — same pattern as the original callScriptGeneration.ts
// ---------------------------------------------------------------------------

const limiter = new Bottleneck({
  maxConcurrent: 1,
  minTime: 2000,
});

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export type CallType =
  | "pharmacy_inquiry"
  | "appointment_scheduling"
  | "healthcare_coordination"
  | "general_outreach";

export interface GenerateGuideParams {
  /** Name of the business or person being called */
  recipientName: string;
  /** Category/type of recipient, e.g. "Retail Pharmacy", "Specialist Clinic" */
  recipientCategory: string;
  /** Type of call — governs tone and strategy */
  callType: CallType;
  /** Why this call is being made — freeform, from the user */
  purpose?: string;
  /** Name of the calling organisation */
  organizationName?: string;
  /** Any extra context the user provided */
  additionalContext?: string;
}

export interface ConvertScriptParams {
  /** The raw script or notes the user typed */
  userScript: string;
  /** Name of the business or person being called */
  recipientName: string;
  /** Category/type of recipient */
  recipientCategory: string;
  /** Type of call */
  callType: CallType;
  /** Name of the calling organisation */
  organizationName?: string;
}

// ---------------------------------------------------------------------------
// Gemini client
// ---------------------------------------------------------------------------

function getGeminiModel() {
  if (!env.gemini.apiKey) return null;
  const genAI = new GoogleGenerativeAI(env.gemini.apiKey);
  return genAI.getGenerativeModel({ model: env.gemini.model });
}

async function callGemini(prompt: string): Promise<string | null> {
  const model = getGeminiModel();
  if (!model) {
    console.warn("[guide-service] Gemini API key not set — using fallback guide");
    return null;
  }

  try {
    const result = await limiter.schedule(() => model.generateContent(prompt));
    const text = result.response.text()?.trim();
    return text ?? null;
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string };
    console.warn("[guide-service] Gemini call failed:", err?.message);
    if (err?.status === 429) {
      console.log("[guide-service] Rate limited — waiting 10s then retrying");
      await new Promise((r) => setTimeout(r, 10_000));
      try {
        const model2 = getGeminiModel();
        if (!model2) return null;
        const retry = await limiter.schedule(() => model2.generateContent(prompt));
        return retry.response.text()?.trim() ?? null;
      } catch (retryErr) {
        console.warn("[guide-service] Gemini retry also failed:", retryErr);
        return null;
      }
    }
    return null;
  }
}

// ---------------------------------------------------------------------------
// JSON extraction helper
// ---------------------------------------------------------------------------

/**
 * Strips Markdown fences and extracts the first valid JSON object from
 * a Gemini response. Returns null if no valid JSON is found.
 */
function extractJson(raw: string): Record<string, unknown> | null {
  const stripped = raw
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;

  try {
    return JSON.parse(stripped.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Prompt: Generate guide from scratch (AI-first path)
// ---------------------------------------------------------------------------

function buildGenerateGuidePrompt(params: GenerateGuideParams): string {
  const org = params.organizationName ?? "Govinda AI";

  // Provide call-type-specific intelligence hints so Gemini generates
  // richer, more realistic healthcare knowledge for each scenario.
  const callTypeHints: Record<CallType, string> = {
    pharmacy_inquiry: `
- Pharmacists are busy and detail-oriented. They need precise medication names, formulations, and quantities.
- Key concerns: stock availability, cold chain for sensitive medications, substitution options, insurance billing codes.
- Real-world complications: partial stock, brand vs generic, expiry date on remaining stock, delivery lead time.
- Urgency often matters — patient may need medication same-day or within hours.
- Decision branches should cover: in stock / partially in stock / out of stock / substitution available.
- Information to collect: exact medication name, formulation (tablet/syrup/injection), quantity, patient urgency level, preferred pickup or delivery, delivery address if applicable.
- Objections to anticipate: can't share stock info over phone, too busy, wrong department, system is down.`,

    appointment_scheduling: `
- Clinic staff manage high call volumes. They value callers who are prepared and specific.
- Key concerns: correct department, doctor availability, urgency of patient condition, insurance coverage, referral letters.
- Real-world complications: fully booked, waitlists, long wait times, specific doctor unavailable, telemedicine not supported for the condition.
- Decision branches: slot available / waitlist / patient needs different specialty / telemedicine offered.
- Information to collect: patient name, condition or specialty required, preferred date/time range, insurance provider, referral letter status, contact number for reminders.
- Objections to anticipate: no slots available for weeks, patient needs referral first, different number to call, must book online.`,

    healthcare_coordination: `
- Coordination calls often involve sensitive patient information. Be HIPAA-aware: share only what is necessary.
- Key concerns: care continuity, urgent referral vs routine, clear handoff of responsibility, shared documentation.
- Real-world complications: recipient facility not accepting new referrals, specialty mismatch, patient transport challenges, records not transferred.
- Decision branches: referral accepted / waitlisted / redirected to different facility / additional patient info required.
- Information to collect: accepting clinician name, referral acceptance confirmation, expected appointment window, documentation requirements, emergency contact at receiving facility.
- Objections to anticipate: patient records not received yet, at capacity, contact their admin team instead, need doctor-to-doctor call first.`,

    general_outreach: `
- The recipient may not be expecting this call. First 20 seconds are critical for establishing legitimacy.
- Key concerns: who is calling, why, and what is being asked of them.
- Real-world complications: gatekeeper blocking the call, wrong contact, call at a bad time.
- Decision branches: recipient is the right person / gatekeeper / wrong number / interested / not interested.
- Information to collect: confirmation of correct contact person, best time to talk, key decision or information needed.
- Objections to anticipate: not interested, who gave you this number, send information by email, call back tomorrow.`,
  };

  return `
You are a senior healthcare call strategy expert building a structured AI Conversation Guide.

An AI voice agent will use this guide to conduct a real phone call.
The agent will REASON over this guide as background knowledge.
The agent will NEVER read it aloud, quote from it, or follow it as a script.

Your job: produce rich, realistic, situation-specific knowledge — not generic templates.
Every field must reflect how real healthcare calls actually go in India.

════════════════════════════════════════
CALL DETAILS
════════════════════════════════════════
Calling organisation : ${org}
Recipient name       : ${params.recipientName}
Recipient category   : ${params.recipientCategory}
Call type            : ${params.callType.replace(/_/g, " ")}
Purpose              : ${params.purpose ?? "Standard outreach"}
Additional context   : ${params.additionalContext ?? "None"}

════════════════════════════════════════
CALL-TYPE INTELLIGENCE (apply these insights)
════════════════════════════════════════
${callTypeHints[params.callType]}

════════════════════════════════════════
OUTPUT FORMAT — Return ONLY valid raw JSON. No markdown, no preamble.
════════════════════════════════════════

{
  "callerIdentity": "string — e.g. 'Healthcare coordinator at ${org}, calling on behalf of a patient'",
  "recipientName": "${params.recipientName}",
  "callObjective": "string — one precise sentence. What must be confirmed or achieved by the end of this call?",
  "callType": "${params.callType}",
  "businessContext": "string — 2–4 sentences of background the AI must understand. Why does this call matter? What is at stake for the patient? What happened before this call?",
  "knownInformation": "string — specific facts already known about this recipient. What should the AI NOT ask about?",
  "recipientProfile": "string — realistic description of who the AI is talking to. Their role, likely workload, preferred communication style, domain knowledge level.",
  "conversationStrategy": "string — 3–5 sentence strategic playbook. How should the AI open? What should it lead with? How should it sequence the topics? What tone shifts are needed? When should it push vs back off?",
  "successCriteria": "string — precise description of a fully successful call. What must the AI have confirmed before it can close? List the 2–3 things that must be true.",
  "closingStrategy": "string — how to close when objective is achieved. What to summarise. What to confirm. How to leave the door open.",
  "nextAction": "string — what should happen after the call ends. Internal team actions, patient notifications, system updates.",
  "talkingPoints": [
    "string — topic to cover. NOT a sentence to say. Write the topic and WHY it matters in 1 short phrase.",
    "4–7 items total"
  ],
  "informationToCollect": [
    {
      "field": "string — specific piece of data to capture",
      "required": true,
      "collectionHint": "string — when and how to bring this up naturally in conversation. Not a scripted question."
    }
  ],
  "anticipatedQuestions": [
    {
      "question": "string — a realistic question this specific recipient type is likely to ask",
      "answerGuidance": "string — key facts to convey, tone to use, and what NOT to say. Be specific to this call scenario."
    },
    "Generate 6–8 realistic questions, not generic ones"
  ],
  "objectionHandlers": [
    {
      "objection": "string — a specific objection realistic for this recipient type",
      "approach": "string — strategic response approach. Include: acknowledge → pivot → what to offer. Be situation-specific."
    },
    "Generate 6–8 objections. Include both early-call and mid-call objections."
  ],
  "decisionTree": [
    {
      "condition": "string — specific condition that may arise during this call",
      "nextFocus": "string — what the AI should prioritise next if this condition is true"
    },
    "Generate 5–7 branches covering the most important paths for this call type"
  ],
  "fallbackResponses": [
    "string — a specific unexpected situation and how to handle it gracefully",
    "3–5 items covering realistic edge cases for this call type"
  ],
  "callSpecificRules": [
    "string — a hard rule specific to this call. What must never be said or done?",
    "3–5 items"
  ],
  "defaultLanguage": "English"
}

Return only the JSON object. Nothing else.
`.trim();
}

// ---------------------------------------------------------------------------
// Prompt: Convert user script to guide (user-written path)
// ---------------------------------------------------------------------------

function buildConvertScriptPrompt(params: ConvertScriptParams): string {
  const org = params.organizationName ?? "Govinda AI";

  return `
You are a senior healthcare call strategy expert.

A user has written a phone call script. Your job is to extract the BUSINESS INTENT
and convert it into a structured AI Conversation Guide.

The guide will be used by an AI voice agent that reasons over knowledge — it does NOT
follow scripts. Discard all original wording completely. Extract only intent, goals,
and strategy. Then enrich the guide with realistic healthcare call knowledge.

════════════════════════════════════════
USER-WRITTEN SCRIPT
════════════════════════════════════════
${params.userScript}

════════════════════════════════════════
CALL CONTEXT
════════════════════════════════════════
Calling organisation : ${org}
Recipient name       : ${params.recipientName}
Recipient category   : ${params.recipientCategory}
Call type            : ${params.callType.replace(/_/g, " ")}

════════════════════════════════════════
YOUR TASK
════════════════════════════════════════
1. Identify the single main objective buried in the script.
2. Extract the business context — what situation prompted this call?
3. List what information the caller wants to collect (read between the lines).
4. Infer the recipient's likely role and how they would respond.
5. Generate objection handlers realistic to this scenario (not generic).
6. Generate anticipated questions this specific recipient would ask.
7. Build a decision tree covering the real paths this call could take.
8. Produce the complete ConversationGuide JSON below.

Rules:
- Do NOT include any of the user's original sentences or phrases.
- Do NOT write dialogue. Write only structured knowledge.
- Every field must be specific to this call — not a generic template.
- Enrich with realistic healthcare scenario knowledge even if the script was thin.

════════════════════════════════════════
OUTPUT FORMAT — Return ONLY valid raw JSON. No markdown, no preamble.
════════════════════════════════════════

{
  "callerIdentity": "string",
  "recipientName": "${params.recipientName}",
  "callObjective": "string — one precise sentence inferred from the script",
  "callType": "${params.callType}",
  "businessContext": "string — 2–4 sentences. Why is this call happening? What is the patient or business situation?",
  "knownInformation": "string — what the script reveals the caller already knows about the recipient",
  "recipientProfile": "string — who the recipient likely is, their role, workload, communication style",
  "conversationStrategy": "string — 3–5 sentence strategic playbook inferred from the script's intent",
  "successCriteria": "string — what a fully successful call looks like for this specific scenario",
  "closingStrategy": "string — how to close well given the objective",
  "nextAction": "string — what internal actions follow this call",
  "talkingPoints": ["string — topic, not sentence. 4–7 items."],
  "informationToCollect": [
    { "field": "string", "required": true, "collectionHint": "string — natural context for raising this" }
  ],
  "anticipatedQuestions": [
    { "question": "string — realistic for this recipient type", "answerGuidance": "string — specific guidance, not generic" }
  ],
  "objectionHandlers": [
    { "objection": "string — realistic for this scenario", "approach": "string — acknowledge, pivot, offer" }
  ],
  "decisionTree": [
    { "condition": "string — specific condition", "nextFocus": "string — what to prioritise" }
  ],
  "fallbackResponses": ["string — edge case and how to handle it"],
  "callSpecificRules": ["string — hard rules inferred from the script's intent"],
  "defaultLanguage": "English"
}

Return only the JSON object. Nothing else.
`.trim();
}

// ---------------------------------------------------------------------------
// Fallback guide builder (when Gemini is unavailable)
// ---------------------------------------------------------------------------

function buildFallbackGuide(
  params: GenerateGuideParams | ConvertScriptParams,
  isConversion: boolean
): ConversationGuide {
  const org = params.organizationName ?? "Govinda AI";
  const callTypeLabel = params.callType.replace(/_/g, " ");

  const purpose =
    "purpose" in params
      ? (params.purpose ?? "standard outreach")
      : "the topics outlined in the provided script";

  const talkingPoints: Record<CallType, string[]> = {
    pharmacy_inquiry: [
      "Medication availability — exact name, formulation, quantity in stock",
      "Partial stock or substitution options if primary medication unavailable",
      "Delivery or pickup logistics and timing",
      "Pricing, insurance billing support, or payment terms",
      "Reorder process and ongoing supply partnership",
    ],
    appointment_scheduling: [
      "Specialty and department needed for this patient's condition",
      "Available appointment slots in the required timeframe",
      "Required documentation — referral letters, test reports, ID",
      "Telemedicine availability vs in-person requirement",
      "Confirmation process and reminder preferences",
    ],
    healthcare_coordination: [
      "Referral details — specialty, urgency level, patient summary",
      "Accepting clinician name and their availability",
      "Documentation requirements for the handoff",
      "Patient consent and what can be shared under HIPAA guidelines",
      "Follow-up timeline and emergency contact at receiving facility",
    ],
    general_outreach: [
      "Purpose of the call and why it benefits the recipient",
      "Key information to share",
      "What decision or action is being requested",
      "Next steps and follow-up plan",
    ],
  };

  const defaultObjections: ObjectionHandler[] = [
    {
      objection: "Not interested",
      approach: "Acknowledge their stance. Briefly explain the direct patient benefit — not a sales pitch. If still not interested, respect it and ask if a callback at a different time might work.",
    },
    {
      objection: "Too busy right now",
      approach: "Respect their time immediately. Ask for a specific 5-minute window today or tomorrow. Offer to call back at their convenience rather than asking them to call you.",
    },
    {
      objection: "Already have a supplier or provider",
      approach: "Acknowledge that. Don't challenge it. Explore whether there are overflow situations, out-of-stock scenarios, or backup supply needs where a second option would be useful.",
    },
    {
      objection: "Wrong person — speak to someone else",
      approach: "Thank them for the redirect. Ask for the right contact's name and direct number. Ask if they can transfer or confirm when that person is available.",
    },
    {
      objection: "Call us later or tomorrow",
      approach: "Pin down a specific time right now so the callback is treated as an appointment, not a vague promise. Confirm the best number and who to ask for.",
    },
    {
      objection: "Send an email instead",
      approach: "Offer to send a brief written summary. Use it as a bridge, not a replacement — confirm a follow-up call after they review the email.",
    },
    {
      objection: "Need to check with my manager",
      approach: "Understand the approval timeline. Ask what information would help the manager decide. Offer to send a one-page summary and schedule a three-way call.",
    },
    {
      objection: "We don't have that in stock / We can't help",
      approach: "Thank them for confirming. Ask if they know when stock is expected, or if they can recommend a nearby alternative. Document the outcome and pivot to next steps.",
    },
  ];

  const defaultQuestions: AnticipatedQuestion[] = [
    {
      question: "Why are you calling?",
      answerGuidance: `State clearly: this is a ${callTypeLabel} call from ${org}. Explain the patient benefit or coordination need in one sentence. Don't over-explain.`,
    },
    {
      question: "Who are you exactly?",
      answerGuidance: `Introduce as a healthcare coordinator from ${org}. Mention the role briefly. Don't launch into a company pitch.`,
    },
    {
      question: "How did you get this number?",
      answerGuidance: "Be transparent: explain whether this came from a public directory, a referral, or a partnership database. Don't be defensive.",
    },
    {
      question: "Can you call back at a better time?",
      answerGuidance: "Absolutely — ask for a specific time right now and note it. Don't leave it vague.",
    },
    {
      question: "Can you send this in writing?",
      answerGuidance: "Offer to send a written summary. Confirm the email address. Then propose a brief follow-up call once they've reviewed it.",
    },
    {
      question: "Is this urgent?",
      answerGuidance: "Be honest about urgency level. If it is urgent, explain why briefly in terms of patient impact. If not urgent, say so.",
    },
  ];

  return {
    callerIdentity: `Healthcare coordinator at ${org}`,
    recipientName: params.recipientName,
    callObjective: `Conduct a ${callTypeLabel} call with ${params.recipientName} to accomplish: ${purpose}`,
    callType: params.callType,
    businessContext: isConversion
      ? `Call initiated based on user-provided script for ${callTypeLabel} with ${params.recipientName} (${params.recipientCategory}).`
      : `Standard ${callTypeLabel} outreach from ${org} to ${params.recipientName} (${params.recipientCategory}).`,
    knownInformation: `Recipient: ${params.recipientName}. Category: ${params.recipientCategory}. No additional pre-call information available.`,
    recipientProfile: `${params.recipientCategory} professional. Likely time-constrained with back-to-back responsibilities. Values directness and preparation. Does not appreciate long introductions or vague questions.`,
    conversationStrategy:
      "Open with a clear one-sentence purpose — don't build up to it. Ask one focused question at a time and wait for the full answer. Track what has been confirmed and don't re-ask. If the recipient raises an issue, address it first before returning to the objective. If the call goes off-track, use a brief bridge phrase to steer back. Close only when all required fields are confirmed.",
    successCriteria: `All required information has been collected. The recipient has confirmed the next step. The call ends on a positive note with a clear agreed action.`,
    closingStrategy:
      "Briefly summarise the 2–3 key points confirmed in the call. Confirm the agreed next step explicitly. Thank the recipient by name. Close warmly and briefly — do not drag out the goodbye.",
    nextAction: "Update the call record with outcome. If action required, assign and notify the relevant team within 30 minutes.",
    talkingPoints: talkingPoints[params.callType] ?? talkingPoints.general_outreach,
    informationToCollect: [
      {
        field: "Confirmation of correct contact person and their role",
        required: true,
        collectionHint: "Verify early — if wrong person, redirect before going further",
      },
      {
        field: "Primary outcome or decision from this call",
        required: true,
        collectionHint: "Confirm explicitly before closing — don't assume",
      },
      {
        field: "Best callback number and preferred time if call ends early",
        required: false,
        collectionHint: "Ask naturally if the call seems likely to be cut short",
      },
    ],
    anticipatedQuestions: defaultQuestions,
    objectionHandlers: defaultObjections,
    decisionTree: [
      {
        condition: "Recipient engages and answers the opening question",
        nextFocus: "Move to the first required talking point. Ask one question. Listen fully before continuing.",
      },
      {
        condition: "Recipient is hesitant or guarded",
        nextFocus: "Slow down. Acknowledge their hesitation. Ask one open question to understand their concern before proceeding.",
      },
      {
        condition: "Recipient confirms the primary objective early in the call",
        nextFocus: "Collect any remaining required information, then move to close. Don't repeat what has already been established.",
      },
      {
        condition: "Recipient cannot help and redirects to someone else",
        nextFocus: "Get the name and contact of the right person. Thank them and close this call.",
      },
      {
        condition: "Recipient wants to end the call",
        nextFocus: "Respect that. Confirm the key outcome so far, agree on next contact, and close gracefully.",
      },
    ],
    fallbackResponses: [
      "If no one answers: leave a brief voicemail with your name, organisation, and one clear reason to call back. Include a callback number.",
      "If the call drops unexpectedly: call back within 2 minutes. Open with an apology for the interruption.",
      "If there is significant background noise making communication difficult: offer to call back at a quieter moment for their sake.",
      "If the recipient becomes frustrated or hostile: stay calm, lower your tone, and acknowledge their frustration before saying anything else.",
    ],
    callSpecificRules: [
      "Never fabricate medical information, stock availability, pricing, or policies.",
      "Never pressure the recipient or create artificial urgency.",
      "Never re-ask for information the recipient has already provided in this call.",
      "Keep every spoken turn to 2–3 sentences. Ask one thing at a time.",
    ],
    defaultLanguage: "English",
  };
}

// ---------------------------------------------------------------------------
// Gemini response → ConversationGuide parser
// ---------------------------------------------------------------------------

function parseGuideFromGemini(
  raw: string,
  fallback: ConversationGuide
): ConversationGuide {
  const json = extractJson(raw);
  if (!json) {
    console.warn("[guide-service] Could not parse Gemini JSON — using fallback");
    return fallback;
  }

  const str = (key: string, def = ""): string =>
    typeof json[key] === "string" ? (json[key] as string) : def;

  const arr = (key: string): unknown[] =>
    Array.isArray(json[key]) ? (json[key] as unknown[]) : [];

  const talkingPoints = arr("talkingPoints")
    .filter((x): x is string => typeof x === "string")
    .filter(Boolean);

  const informationToCollect: CollectionField[] = arr("informationToCollect")
    .filter((x): x is Record<string, unknown> => typeof x === "object" && x !== null)
    .map((x) => ({
      field: typeof x["field"] === "string" ? x["field"] : "",
      required: x["required"] === true,
      collectionHint: typeof x["collectionHint"] === "string" ? x["collectionHint"] : undefined,
    }))
    .filter((x) => x.field.length > 0);

  const anticipatedQuestions: AnticipatedQuestion[] = arr("anticipatedQuestions")
    .filter((x): x is Record<string, unknown> => typeof x === "object" && x !== null)
    .map((x) => ({
      question: typeof x["question"] === "string" ? x["question"] : "",
      answerGuidance: typeof x["answerGuidance"] === "string" ? x["answerGuidance"] : "",
    }))
    .filter((x) => x.question.length > 0);

  const objectionHandlers: ObjectionHandler[] = arr("objectionHandlers")
    .filter((x): x is Record<string, unknown> => typeof x === "object" && x !== null)
    .map((x) => ({
      objection: typeof x["objection"] === "string" ? x["objection"] : "",
      approach: typeof x["approach"] === "string" ? x["approach"] : "",
    }))
    .filter((x) => x.objection.length > 0);

  const decisionTree: ConversationBranch[] = arr("decisionTree")
    .filter((x): x is Record<string, unknown> => typeof x === "object" && x !== null)
    .map((x) => ({
      condition: typeof x["condition"] === "string" ? x["condition"] : "",
      nextFocus: typeof x["nextFocus"] === "string" ? x["nextFocus"] : "",
    }))
    .filter((x) => x.condition.length > 0);

  const fallbackResponses = arr("fallbackResponses")
    .filter((x): x is string => typeof x === "string")
    .filter(Boolean);

  const callSpecificRules = arr("callSpecificRules")
    .filter((x): x is string => typeof x === "string")
    .filter(Boolean);

  // Merge with fallback so no required field is ever missing
  return {
    callerIdentity: str("callerIdentity", fallback.callerIdentity),
    recipientName: str("recipientName", fallback.recipientName),
    callObjective: str("callObjective", fallback.callObjective),
    callType: str("callType", fallback.callType),
    businessContext: str("businessContext", fallback.businessContext ?? ""),
    knownInformation: str("knownInformation", fallback.knownInformation ?? ""),
    recipientProfile: str("recipientProfile", fallback.recipientProfile ?? ""),
    conversationStrategy: str("conversationStrategy", fallback.conversationStrategy ?? ""),
    successCriteria: str("successCriteria", fallback.successCriteria ?? ""),
    closingStrategy: str("closingStrategy", fallback.closingStrategy ?? ""),
    nextAction: str("nextAction", fallback.nextAction ?? ""),
    talkingPoints: talkingPoints.length > 0 ? talkingPoints : fallback.talkingPoints,
    informationToCollect: informationToCollect.length > 0 ? informationToCollect : fallback.informationToCollect,
    anticipatedQuestions: anticipatedQuestions.length > 0 ? anticipatedQuestions : fallback.anticipatedQuestions,
    objectionHandlers: objectionHandlers.length > 0 ? objectionHandlers : fallback.objectionHandlers,
    decisionTree: decisionTree.length > 0 ? decisionTree : fallback.decisionTree,
    fallbackResponses: fallbackResponses.length > 0 ? fallbackResponses : fallback.fallbackResponses,
    callSpecificRules: callSpecificRules.length > 0 ? callSpecificRules : fallback.callSpecificRules,
    defaultLanguage: str("defaultLanguage", fallback.defaultLanguage ?? "English"),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * USE CASE 1 — AI-generated guide.
 * User clicked "Generate AI Script". Produce a full ConversationGuide from
 * scratch using Gemini. Falls back to a template guide if Gemini is unavailable.
 */
export async function generateGuide(
  params: GenerateGuideParams
): Promise<ConversationGuide> {
  const fallback = buildFallbackGuide(params, false);

  console.log(
    "[guide-service] generateGuide() —",
    `recipient="${params.recipientName}"`,
    `type="${params.callType}"`,
    `org="${params.organizationName ?? "Govinda AI"}"`
  );

  const prompt = buildGenerateGuidePrompt(params);
  const raw = await callGemini(prompt);

  if (!raw) {
    console.warn("[guide-service] generateGuide: Gemini unavailable — using fallback");
    return fallback;
  }

  const guide = parseGuideFromGemini(raw, fallback);
  console.log("[guide-service] generateGuide: guide produced successfully");
  return guide;
}

/**
 * USE CASE 2 — User-written script conversion.
 * User typed their own script. Extract business intent and convert to
 * ConversationGuide. The original script wording is never used downstream.
 */
export async function convertScriptToGuide(
  params: ConvertScriptParams
): Promise<ConversationGuide> {
  const fallback = buildFallbackGuide(params, true);

  console.log(
    "[guide-service] convertScriptToGuide() —",
    `recipient="${params.recipientName}"`,
    `type="${params.callType}"`,
    `scriptLength=${params.userScript.length}`
  );

  const prompt = buildConvertScriptPrompt(params);
  const raw = await callGemini(prompt);

  if (!raw) {
    console.warn("[guide-service] convertScriptToGuide: Gemini unavailable — using fallback");
    return fallback;
  }

  const guide = parseGuideFromGemini(raw, fallback);
  console.log("[guide-service] convertScriptToGuide: conversion successful");
  return guide;
}

/**
 * Serialise a ConversationGuide to a compact JSON string for storage in MongoDB.
 */
export function serializeGuide(guide: ConversationGuide): string {
  return JSON.stringify(guide);
}

/**
 * Deserialise a stored guide string back to a ConversationGuide.
 * Returns null if the string is not valid JSON or not a valid guide.
 */
export function deserializeGuide(raw: string): ConversationGuide | null {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (
      typeof parsed["callObjective"] === "string" &&
      Array.isArray(parsed["talkingPoints"])
    ) {
      return parsed as unknown as ConversationGuide;
    }
    return null;
  } catch {
    return null;
  }
}
