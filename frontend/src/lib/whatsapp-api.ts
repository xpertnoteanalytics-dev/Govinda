import { apiFetch } from "./api";
import type { OutreachType } from "./outreach-types";

export interface WhatsAppRecord {
  id: string;
  placeId?: string;
  placeName: string;
  category?: string;
  phoneNumber: string;
  fromNumber?: string;
  message: string;
  outreachType: OutreachType;
  status: string;
  deliveryStatus?: string;
  provider?: string;
  providerMessageId?: string;
  notes?: string;
  initiatedBy?: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
}

export interface WhatsAppAnalytics {
  totalMessages: number;
  sentMessages: number;
  failedMessages: number;
  successRate: number;
  recent: Array<{
    placeName: string;
    status: string;
    deliveryStatus?: string;
    outreachType: OutreachType;
    createdAt: string;
    initiatedBy?: { id: string; name: string };
  }>;
}

export async function listWhatsAppMessages(): Promise<WhatsAppRecord[]> {
  const data = await apiFetch<{ messages: WhatsAppRecord[] }>("/v1/whatsapp");
  return data.messages;
}

export async function getWhatsAppAnalytics(): Promise<WhatsAppAnalytics> {
  return apiFetch<WhatsAppAnalytics>("/v1/whatsapp/analytics");
}

export async function generateWhatsAppDraft(input: {
  placeName: string;
  category: string;
  purpose?: string;
  outreachType?: OutreachType;
}): Promise<string> {
  const data = await apiFetch<{ message: string }>("/v1/whatsapp/draft", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return data.message;
}

export async function sendWhatsAppMessage(input: {
  placeName: string;
  phoneNumber: string;
  message: string;
  placeId?: string;
  category?: string;
  outreachType?: OutreachType;
  openChatOnly?: boolean;
}): Promise<
  WhatsAppRecord & { deepLink?: string; senderMode?: "company_api" | "manual_deep_link" }
> {
  return apiFetch<WhatsAppRecord & { deepLink?: string }>("/v1/whatsapp/send", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
