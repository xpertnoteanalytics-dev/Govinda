import { apiFetch } from "./api";

export interface OperationsOverview {
  organization: {
    memberCount: number;
    activeMembers: number;
    plan: string;
    tenantName: string;
    tenantSlug: string;
    isActive: boolean;
  };
  ai: { conversations: number };
  search: {
    totalSearches: number;
    byCategory: Array<{ category: string; count: number }>;
    recent: Array<{
      category: string;
      locationLabel: string;
      resultCount: number;
      createdAt: string;
    }>;
  };
  calls: {
    totalCalls: number;
    completedCalls: number;
    failedCalls: number;
    successRate: number;
    recent: Array<{
      placeName: string;
      status: string;
      createdAt: string;
      durationSeconds?: number;
      initiatedBy?: { id: string; name: string };
    }>;
  };
  emails: {
    totalEmails: number;
    sentEmails: number;
    failedEmails: number;
    successRate: number;
    recent: Array<{
      placeName: string;
      subject: string;
      status: string;
      outreachType: string;
      createdAt: string;
      initiatedBy?: { id: string; name: string };
    }>;
  };
  whatsapp: {
    totalMessages: number;
    sentMessages: number;
    failedMessages: number;
    successRate: number;
    recent: Array<{
      placeName: string;
      status: string;
      deliveryStatus?: string;
      outreachType: string;
      createdAt: string;
      initiatedBy?: { id: string; name: string };
    }>;
  };
  outreach: {
    totalEmails: number;
    totalWhatsApp: number;
    totalCalls: number;
    combined: number;
    recent: Array<{
      channel: "email" | "whatsapp" | "call";
      placeName: string;
      status: string;
      createdAt: string;
      detail?: string;
      outreachType?: string;
      initiatedBy?: { id: string; name: string };
    }>;
  };
  activityScore: number;
}

export async function getOperationsOverview(): Promise<OperationsOverview> {
  return apiFetch<OperationsOverview>("/v1/operations/overview");
}
