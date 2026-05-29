import { apiFetch } from "./api";
import type { OutreachType } from "./outreach-types";

export interface EmailRecord {
  id: string;
  placeId?: string;
  placeName: string;
  category?: string;
  toEmail: string;
  fromEmail?: string;
  subject: string;
  body: string;
  outreachType: OutreachType;
  status: string;
  provider?: string;
  providerMessageId?: string;
  notes?: string;
  initiatedBy?: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
}

export interface EmailAnalytics {
  totalEmails: number;
  sentEmails: number;
  failedEmails: number;
  successRate: number;
  recent: Array<{
    placeName: string;
    subject: string;
    status: string;
    outreachType: OutreachType;
    createdAt: string;
    initiatedBy?: { id: string; name: string };
  }>;
}

export async function listEmails(): Promise<EmailRecord[]> {
  const data = await apiFetch<{ emails: EmailRecord[] }>("/v1/emails");
  return data.emails;
}

export async function getEmailAnalytics(): Promise<EmailAnalytics> {
  return apiFetch<EmailAnalytics>("/v1/emails/analytics");
}

export async function generateEmailDraft(input: {
  placeName: string;
  category: string;
  purpose?: string;
  outreachType?: OutreachType;
}): Promise<{ subject: string; body: string }> {
  return apiFetch<{ subject: string; body: string }>("/v1/emails/draft", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function sendOutreachEmail(input: {
  placeName: string;
  toEmail: string;
  subject: string;
  body: string;
  placeId?: string;
  category?: string;
  outreachType?: OutreachType;
}): Promise<EmailRecord> {
  const data = await apiFetch<{ email: EmailRecord }>("/v1/emails/send", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return data.email;
}
