import { Chat, SearchHistory, Call, OutreachEmail, OutreachWhatsApp } from "../models";
import { resolveObjectIdString } from "../utils/resolveId";
import * as mapsService from "./mapsService";
import * as callService from "./callService";
import * as emailService from "./emailService";
import * as whatsappService from "./whatsappService";
import * as dashboardService from "./dashboardService";

export async function getOperationsOverview(tenantId: string, userId: string) {
  const tenantOid = resolveObjectIdString(tenantId, "tenantId");
  const userOid = resolveObjectIdString(userId, "userId");

  const [
    tenantAnalytics,
    searchAnalytics,
    callAnalytics,
    emailAnalytics,
    whatsappAnalytics,
    chatCount,
    totalSearches,
    totalCalls,
    totalEmails,
    totalWhatsApp,
  ] = await Promise.all([
    dashboardService.getTenantAnalytics(tenantId),
    mapsService.getSearchAnalytics(tenantId, userId),
    callService.getCallAnalytics(tenantId, userId),
    emailService.getEmailAnalytics(tenantId, userId),
    whatsappService.getWhatsAppAnalytics(tenantId, userId),
    Chat.countDocuments({ tenantId: tenantOid, userId: userOid }),
    SearchHistory.countDocuments({ tenantId: tenantOid, userId: userOid }),
    Call.countDocuments({ tenantId: tenantOid, userId: userOid }),
    OutreachEmail.countDocuments({ tenantId: tenantOid, userId: userOid }),
    OutreachWhatsApp.countDocuments({ tenantId: tenantOid, userId: userOid }),
  ]);

  return {
    organization: tenantAnalytics,
    ai: {
      conversations: chatCount,
    },
    search: {
      totalSearches,
      byCategory: searchAnalytics.byCategory,
      recent: searchAnalytics.recent,
    },
    calls: callAnalytics,
    emails: emailAnalytics,
    whatsapp: whatsappAnalytics,
    outreach: {
      totalEmails,
      totalWhatsApp,
      totalCalls,
      combined:
        totalEmails + totalWhatsApp + totalCalls,
      recent: [
        ...emailAnalytics.recent.map((e) => ({
          channel: "email" as const,
          placeName: e.placeName,
          status: e.status,
          createdAt: e.createdAt,
          detail: e.subject,
          outreachType: e.outreachType,
          initiatedBy: e.initiatedBy,
        })),
        ...whatsappAnalytics.recent.map((w) => ({
          channel: "whatsapp" as const,
          placeName: w.placeName,
          status: w.status,
          createdAt: w.createdAt,
          detail: w.deliveryStatus,
          outreachType: w.outreachType,
          initiatedBy: w.initiatedBy,
        })),
        ...callAnalytics.recent.map((c) => ({
          channel: "call" as const,
          placeName: c.placeName,
          status: c.status,
          createdAt: c.createdAt,
          detail:
            c.durationSeconds != null ? `${c.durationSeconds}s` : undefined,
          outreachType: undefined,
          initiatedBy: c.initiatedBy,
        })),
      ]
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        .slice(0, 8),
    },
    activityScore: Math.min(
      100,
      chatCount * 2 +
        totalSearches * 3 +
        totalCalls * 5 +
        totalEmails * 4 +
        totalWhatsApp * 4
    ),
  };
}
