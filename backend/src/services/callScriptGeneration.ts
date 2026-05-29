import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../config/env";
import Bottleneck from "bottleneck";

const limiter = new Bottleneck({
  maxConcurrent: 1,
  minTime: 2000,
});

export type CallScriptType =
  | "pharmacy_inquiry"
  | "appointment_scheduling"
  | "healthcare_coordination";

function scriptInstructions(scriptType: CallScriptType): string {
  switch (scriptType) {
    case "appointment_scheduling":
      return (
        "Focus on scheduling a callback or appointment: confirm department, preferred times, documentation needed, and next steps."
      );
    case "healthcare_coordination":
      return (
        "Focus on care coordination: referrals, lab or imaging follow-up, care team handoffs, and HIPAA-safe information sharing practices."
      );
    case "pharmacy_inquiry":
    default:
      return (
        "Focus on pharmacy outreach: stock availability, alternatives, delivery or pickup, formulary questions, and escalation path."
      );
  }
}

function templateScript(params: {
  placeName: string;
  category: string;
  scriptType: CallScriptType;
  purpose?: string;
  organizationName?: string;
}): string {
  const org = params.organizationName ?? "Govinda AI";
  const angle = scriptInstructions(params.scriptType);
  const purpose =
    params.purpose ??
    (params.scriptType === "appointment_scheduling"
      ? "scheduling an appointment or callback"
      : params.scriptType === "healthcare_coordination"
        ? "care coordination and follow-up"
        : "medication availability and partnership outreach");

  return `Hello, this is ${org} calling regarding ${purpose}.

I'm reaching out to ${params.placeName} (${params.category}).
${angle}

Could you please connect me with the right point of contact?

I'd like to briefly cover:
1. Purpose of our outreach and how we can collaborate
2. Operating hours and the best channel for follow-up
3. Any compliance or documentation requirements on your side

Thank you for your time. We appreciate your support in community healthcare.`;
}


async function generateWithGemini(prompt: string): Promise<string | null> {
  if (!env.gemini.apiKey) return null;

  const genAI = new GoogleGenerativeAI(env.gemini.apiKey);
  const model = genAI.getGenerativeModel({ model: env.gemini.model });

  try {
    const result = await limiter.schedule(() =>
      model.generateContent(prompt)
    );

    const text = result.response.text()?.trim();

    return text ?? null;
  } catch (e: any) {
    console.warn("[call-script] Gemini failed", e);

    if (e?.status === 429) {
      console.log("Rate limit hit. Retrying...");

      await new Promise((resolve) => setTimeout(resolve, 10000));

      const retryResult = await limiter.schedule(() =>
        model.generateContent(prompt)
      );

      return retryResult.response.text()?.trim() ?? null;
    }

    return null;
  }
}

export async function generateAiCallScript(params: {
  placeName: string;
  category: string;
  scriptType: CallScriptType;
  purpose?: string;
  organizationName?: string;
}): Promise<string> {
  const org = params.organizationName ?? "Govinda AI";
  const angle = scriptInstructions(params.scriptType);

  const prompt = `Write a short professional outbound phone script (under 220 words) for a healthcare operations team.

Organization: ${org}
Facility name: ${params.placeName}
Facility type or category: ${params.category}
Script focus: ${params.scriptType.replace(/_/g, " ")}
Additional context: ${params.purpose ?? "standard outreach"}

Guidelines:
- ${angle}
- HIPAA-aware: do not request unnecessary PHI
- Include intro, reason for call, talking points, and close
- Neutral English suitable for Indian healthcare facilities.
`;

  const gemini = await generateWithGemini(prompt);

  if (gemini) return gemini;

  return templateScript(params);
}