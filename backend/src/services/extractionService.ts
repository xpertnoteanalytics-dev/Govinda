// src/services/extractionService.ts
//
// ExtractionService has exactly one job: turn a finished conversation into
// structured JSON via a single Gemini call. It does not know how, or
// whether, any section of that JSON gets stored anywhere. It has no import
// of Appointment, Feedback, CRM, WhatsApp, or Callback — that boundary is
// what lets new modules plug in later without this file changing.
//
// Replaces (after migration): extractOperationalIntent(), 
// appointmentExtractor.ts's regex pipeline, feedbackExtractor.ts's
// keyword pipeline. One model call instead of three separate heuristics,
// shared across AI Phone Calls, AI Chat, and future WhatsApp — the input
// shape (ExtractionInput) doesn't care which channel produced the
// transcript.
//
// Reuses the same Gemini client setup and retry pattern already proven in
// the legacy extractOperationalIntent() — same env.gemini config, same
// fenced-JSON stripping — rather than introducing a second way of talking
// to Gemini.

import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../config/env";
import type { ExtractionInput, ExtractionResult } from "../types/extraction";

const genAI = new GoogleGenerativeAI(env.gemini.apiKey);
const model = genAI.getGenerativeModel({ model: env.gemini.model });

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

// ---------------------------------------------------------------------------
// Prompt construction
// ---------------------------------------------------------------------------

/**
 * Tool labels are included so Gemini knows which sections are worth
 * looking for — e.g. don't bother looking for a CRM section if crm_update
 * wasn't enabled for this call. This keeps the prompt focused without the
 * service needing to know anything about how each tool is fulfilled
 * downstream; it only needs the tool's name.
 */
function toolHint(enabledTools: ExtractionInput["enabledTools"]): string {
  if (!enabledTools || enabledTools.length === 0) {
    return "No specific tools were enabled for this conversation — only extract what is clearly present.";
  }
  return `Tools enabled for this conversation: ${enabledTools.join(", ")}. Only populate the sections relevant to these tools, plus summary/sentiment, which are always relevant.`;
}

function buildPrompt(input: ExtractionInput): string {
  return `
You are a healthcare operations extraction engine. Read the conversation below and extract ONLY what is explicitly present — never invent, assume, or fill in plausible-sounding values.

OBJECTIVE TYPE: ${input.objectiveType}
${toolHint(input.enabledTools)}

${input.conversationSummary ? `CONVERSATION SUMMARY:\n${input.conversationSummary}\n` : ""}
CONVERSATION TRANSCRIPT:
${input.conversationTranscript}

Return ONLY valid JSON matching this exact shape. Omit a key entirely (do not include it as null or empty) if that section has no real data in the conversation:

{
  "summary": "a clear, complete recap of the whole call — what the caller wanted, what was discussed, what the AI told them, and how the call concluded. Write 3-5 sentences in plain natural language, not a single flat line. Mention specific details actually said (names, quantities, dates, products) so someone who didn't hear the call understands exactly what happened.",
  "sentiment": "positive" | "neutral" | "negative",
  "appointment": {
    "patientName": string,
    "phone": string,
    "service": string,
    "appointmentDate": string,
    "appointmentTime": string,
    "notes": string
  },
  "feedback": {
    "patientName": string,
    "feedback": string,
    "sentiment": "positive" | "neutral" | "negative"
  },
  "crm": { any relevant structured fields the conversation revealed },
  "whatsapp": { "phone": string, "message": string },
  "callback": { "phone": string, "preferredTime": string, "reason": string },
  "extractedData": { anything else worth capturing that doesn't fit above }
}

Only include "appointment" if a specific appointment was actually discussed and at least partially confirmed. Only include "feedback" if the recipient actually gave an opinion or rating. Return nothing but the JSON object — no prose, no markdown fences.
`.trim();
}

// ---------------------------------------------------------------------------
// Gemini call with retry (same pattern as the legacy extractOperationalIntent)
// ---------------------------------------------------------------------------

async function callGeminiWithRetry(prompt: string): Promise<string> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (err) {
      lastErr = err;
      if (attempt === MAX_RETRIES - 1) break;
      console.warn(
        `[extractionService] Gemini call failed (attempt ${attempt + 1}/${MAX_RETRIES}), retrying...`
      );
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Gemini extraction call failed");
}

function stripJsonFences(text: string): string {
  return text.replace(/```json/gi, "").replace(/```/g, "").trim();
}

// ---------------------------------------------------------------------------
// Output validation
// ---------------------------------------------------------------------------
//
// Gemini is asked to omit empty sections, but models don't always comply
// perfectly. This narrows the parsed JSON down to the typed shape and drops
// anything that isn't a genuinely populated object, so the Dispatcher never
// has to defensively check for empty-but-present sections like `{}`.

const VALID_SENTIMENTS = new Set(["positive", "neutral", "negative"]);

function isNonEmptyObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length > 0
  );
}

function normalizeResult(raw: unknown): ExtractionResult {
  if (!isNonEmptyObject(raw)) return {};

  const result: ExtractionResult = {};

  if (typeof raw.summary === "string" && raw.summary.trim()) {
    result.summary = raw.summary.trim();
  }

  if (typeof raw.sentiment === "string" && VALID_SENTIMENTS.has(raw.sentiment)) {
    result.sentiment = raw.sentiment as ExtractionResult["sentiment"];
  }

  if (isNonEmptyObject(raw.appointment)) {
    result.appointment = raw.appointment as ExtractionResult["appointment"];
  }

  if (isNonEmptyObject(raw.feedback)) {
    const fb = raw.feedback as Record<string, unknown>;
    result.feedback = {
      ...fb,
      sentiment:
        typeof fb.sentiment === "string" && VALID_SENTIMENTS.has(fb.sentiment)
          ? (fb.sentiment as "positive" | "neutral" | "negative")
          : undefined,
    };
  }

  if (isNonEmptyObject(raw.crm)) result.crm = raw.crm;
  if (isNonEmptyObject(raw.whatsapp)) result.whatsapp = raw.whatsapp;
  if (isNonEmptyObject(raw.callback)) result.callback = raw.callback;
  if (isNonEmptyObject(raw.extractedData)) result.extractedData = raw.extractedData;

  return result;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Runs the single Gemini extraction call for a finished conversation and
 * returns a validated, typed ExtractionResult. Throws on Gemini failure or
 * unparseable output — callers (the Dispatcher's caller) decide whether
 * that's fatal or just logged, since extraction is best-effort by nature.
 *
 * Works identically regardless of which channel produced the transcript —
 * AI Phone Call, AI Chat, or future WhatsApp — because the input shape
 * never references a channel.
 */
export async function runExtraction(input: ExtractionInput): Promise<ExtractionResult> {
  const prompt = buildPrompt(input);
  const rawText = await callGeminiWithRetry(prompt);
  const cleaned = stripJsonFences(rawText);

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    console.error("[extractionService] failed to parse Gemini output as JSON:", cleaned.slice(0, 300));
    throw new Error("Extraction returned non-JSON output");
  }

  return normalizeResult(parsed);
}
