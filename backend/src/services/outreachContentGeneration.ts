import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../config/env";
import Bottleneck from "bottleneck";
import type { OutreachChannel, OutreachType } from "../types/outreach";
import {
  getCompanySupportEmail,
  getCompanyWhatsAppNumber,
} from "./companyOutreach";

const limiter = new Bottleneck({
  maxConcurrent: 1,
  minTime: 2000,
});

function outreachInstructions(outreachType: OutreachType): string {
  switch (outreachType) {
    case "appointment_scheduling":
      return "Focus on appointment or callback scheduling: availability, required documents, and next steps.";
    case "healthcare_coordination":
      return "Focus on care coordination: referrals, follow-up labs/imaging, and secure handoffs.";
    case "partnership_outreach":
      return "Focus on partnership or collaboration: mutual value, pilot scope, and compliance alignment.";
    case "follow_up":
      return "Focus on a polite follow-up to a prior outreach: recap, open items, and a clear ask.";
    case "pharmacy_inquiry":
    default:
      return "Focus on pharmacy outreach: stock, alternatives, delivery/pickup, and escalation path.";
  }
}

function channelGuidelines(channel: OutreachChannel): string {
  if (channel === "email") {
    return `Format as a professional email with:
- Subject line on the first line prefixed exactly with "Subject: "
- Then a blank line
- Email body (under 280 words)
- Formal greeting and sign-off
- HIPAA-aware: do not request unnecessary PHI`;
  }
  return `Format as a WhatsApp message:
- Under 120 words, conversational but professional
- No subject line
- Short paragraphs or line breaks for readability
- HIPAA-aware: do not request unnecessary PHI`;
}

function templateEmail(params: {
  placeName: string;
  category: string;
  outreachType: OutreachType;
  purpose?: string;
  organizationName?: string;
}): { subject: string; body: string } {
  const org = params.organizationName ?? "Govinda AI";
  const angle = outreachInstructions(params.outreachType);
  const purpose =
    params.purpose ??
    params.outreachType.replace(/_/g, " ");

  const subject = `${org} — healthcare outreach to ${params.placeName}`;
  const body = `Dear ${params.placeName} team,

I am writing from ${org} regarding ${purpose} (${params.category}).

${angle}

Could you please advise on the best contact for this request and your preferred follow-up channel?

Thank you for supporting community healthcare.

Best regards,
${org} Operations`;

  return { subject, body };
}

function templateWhatsApp(params: {
  placeName: string;
  category: string;
  outreachType: OutreachType;
  purpose?: string;
  organizationName?: string;
}): string {
  const org = params.organizationName ?? "Govinda AI";
  const purpose = params.purpose ?? params.outreachType.replace(/_/g, " ");

  return `Hello, this is ${org}.

We're reaching out to ${params.placeName} (${params.category}) regarding ${purpose}.

${outreachInstructions(params.outreachType)}

Could you connect us with the right point of contact? Thank you.`;
}

async function generateWithGemini(prompt: string): Promise<string | null> {
  if (!env.gemini.apiKey) return null;

  const genAI = new GoogleGenerativeAI(env.gemini.apiKey);
  const model = genAI.getGenerativeModel({ model: env.gemini.model });

  try {
    const result = await limiter.schedule(() => model.generateContent(prompt));
    return result.response.text()?.trim() ?? null;
  } catch (e: unknown) {
    console.warn("[outreach-content] Gemini failed", e);
    return null;
  }
}

function parseEmailDraft(raw: string): { subject: string; body: string } {
  const subjectMatch = raw.match(/^Subject:\s*(.+)$/im);
  if (subjectMatch) {
    const subject = subjectMatch[1].trim();
    const body = raw.replace(/^Subject:\s*.+\n?/im, "").trim();
    return { subject, body: body || raw };
  }
  const lines = raw.split("\n");
  const subject = lines[0]?.slice(0, 120) || "Healthcare outreach";
  const body = lines.slice(1).join("\n").trim() || raw;
  return { subject, body };
}

export async function generateOutreachEmailDraft(params: {
  placeName: string;
  category: string;
  outreachType: OutreachType;
  purpose?: string;
  organizationName?: string;
}): Promise<{ subject: string; body: string }> {
  const org = params.organizationName ?? "Govinda AI";
  const companyEmail = getCompanySupportEmail();
  const companyWhatsApp = getCompanyWhatsAppNumber();
  const prompt = `Write a professional healthcare outreach email.

Organization: ${org}
Official sender email (company support line): ${companyEmail || "configured company inbox"}
Company WhatsApp (for reference): ${companyWhatsApp || "configured company line"}
Facility: ${params.placeName}
Category: ${params.category}
Outreach type: ${params.outreachType.replace(/_/g, " ")}
Context: ${params.purpose ?? "standard facility outreach"}

The email will be sent FROM the company support address, not from a personal staff inbox.
Sign off as the organization support/operations team.

${outreachInstructions(params.outreachType)}
${channelGuidelines("email")}
Neutral English suitable for Indian healthcare facilities.`;

  const gemini = await generateWithGemini(prompt);
  if (gemini) return parseEmailDraft(gemini);
  return templateEmail(params);
}

export async function generateOutreachWhatsAppDraft(params: {
  placeName: string;
  category: string;
  outreachType: OutreachType;
  purpose?: string;
  organizationName?: string;
}): Promise<string> {
  const org = params.organizationName ?? "Govinda AI";
  const companyWhatsApp = getCompanyWhatsAppNumber();
  const prompt = `Write a WhatsApp outreach message for a healthcare operations team.

Organization: ${org}
Official sender: company WhatsApp business line ${companyWhatsApp || "(configured company number)"}
Recipient: ${params.placeName} facility phone (not the staff personal number)
Category: ${params.category}
Outreach type: ${params.outreachType.replace(/_/g, " ")}
Context: ${params.purpose ?? "standard facility outreach"}

The message is sent FROM the company WhatsApp operations line via the platform, not from a personal WhatsApp account.
Introduce the sender as the organization's support/operations team.

${outreachInstructions(params.outreachType)}
${channelGuidelines("whatsapp")}`;

  const gemini = await generateWithGemini(prompt);
  if (gemini) return gemini;
  return templateWhatsApp(params);
}
