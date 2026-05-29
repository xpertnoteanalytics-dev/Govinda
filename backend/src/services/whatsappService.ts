import { OutreachWhatsApp } from "../models";
import type { IOutreachWhatsApp } from "../models/OutreachWhatsApp";
import { AppError } from "../utils/AppError";
import { resolveObjectIdString } from "../utils/resolveId";
import * as whatsappProvider from "./providers/whatsappProvider";
import { generateOutreachWhatsAppDraft } from "./outreachContentGeneration";
import {
  applyCompanyMessageBranding,
  getCompanyWhatsAppNumber,
} from "./companyOutreach";
import type { OutreachType } from "../types/outreach";
import { extractOperationalIntent } from "./aiIntentExtraction";
import { Appointment } from "../models/Appointment";
import { Feedback } from "../models/Feedback";

export { type OutreachType };

export async function generateWhatsAppDraft(params: {
  placeName: string;
  category: string;
  outreachType?: OutreachType;
  purpose?: string;
  organizationName?: string;
}): Promise<string> {
  const outreachType: OutreachType = params.outreachType ?? "pharmacy_inquiry";
  return generateOutreachWhatsAppDraft({
    placeName: params.placeName,
    category: params.category,
    outreachType,
    purpose: params.purpose,
    organizationName: params.organizationName,
  });
}

export async function sendOutreachWhatsApp(params: {
  tenantId: string;
  userId: string;
  placeId?: string;
  placeName: string;
  phoneNumber: string;
  message: string;
  category?: string;
  outreachType?: OutreachType;
  /** When true, skip provider API and return a wa.me deep link only */
  openChatOnly?: boolean;
}) {
  const normalized = params.phoneNumber.replace(/\s/g, "");
  if (!/^\+?[\d]{8,15}$/.test(normalized)) {
    throw new AppError(400, "Invalid phone number", "INVALID_PHONE");
  }

  const outreachType: OutreachType = params.outreachType ?? "pharmacy_inquiry";
  const fromNumber = getCompanyWhatsAppNumber();
  const brandedMessage = applyCompanyMessageBranding(params.message.trim());

  const record = await OutreachWhatsApp.create({
    tenantId: resolveObjectIdString(params.tenantId, "tenantId"),
    userId: resolveObjectIdString(params.userId, "userId"),
    placeId: params.placeId,
    placeName: params.placeName,
    category: params.category,
    phoneNumber: normalized,
    fromNumber: fromNumber || undefined,
    message: brandedMessage,
    outreachType,
    status: "queued",
  });

  const deepLink = whatsappProvider.buildWhatsAppDeepLink(
    normalized,
    record.message
  );

  if (params.openChatOnly) {
    record.status = "sent";
    record.provider = "deep_link";
    record.notes =
      "Manual backup link to facility number. Prefer company API send so messages originate from the business WhatsApp line.";
    record.deliveryStatus = "manual_facility_link";
    await record.save();
    return {
      ...serializeWhatsApp(record),
      deepLink,
      senderMode: "manual_deep_link" as const,
    };
  }

  try {
    const result = await whatsappProvider.sendWhatsAppMessage({
      to: normalized,
      body: record.message,
    });
    record.status = result.status === "sent" ? "sent" : "queued";
    record.provider = result.provider;
    record.providerMessageId = result.messageId;
    record.deliveryStatus = result.deliveryStatus ?? "company_line";
    await record.save();
  } catch (err) {
    const message =
      err instanceof AppError
        ? err.message
        : err instanceof Error
          ? err.message
          : "WhatsApp send failed";
    record.status = "failed";
    record.notes = message;
    await record.save();
    console.error("[whatsappService] sendOutreachWhatsApp provider error", {
      messageId: record._id.toString(),
      message,
    });
  }

  return {
    ...serializeWhatsApp(record),
    deepLink,
    senderMode: "company_api" as const,
  };
}

type PopulatedUser = { _id: unknown; firstName?: string; lastName?: string };

export function serializeWhatsApp(
  row: IOutreachWhatsApp & { userId?: PopulatedUser | IOutreachWhatsApp["userId"] }
) {
  let initiatedBy: { id: string; name: string } | undefined;
  const uid = row.userId as unknown as PopulatedUser | undefined;
  if (uid && typeof uid === "object" && "firstName" in uid && uid._id) {
    initiatedBy = {
      id: String(uid._id),
      name: [uid.firstName, uid.lastName].filter(Boolean).join(" ").trim(),
    };
  }

  const now = new Date().toISOString();

  return {
    id: row._id.toString(),
    placeId: row.placeId,
    placeName: row.placeName,
    category: row.category,
    phoneNumber: row.phoneNumber,
    fromNumber: row.fromNumber,
    message: row.message,
    outreachType: row.outreachType,
    status: row.status,
    deliveryStatus: row.deliveryStatus,
    provider: row.provider,
    providerMessageId: row.providerMessageId,
    notes: row.notes,
    initiatedBy,
    createdAt: row.createdAt?.toISOString() ?? now,
    updatedAt: row.updatedAt?.toISOString() ?? now,
  };
}

export async function listWhatsAppMessages(
  tenantId: string,
  userId: string,
  limit = 50
) {
  const rows = await OutreachWhatsApp.find({
    tenantId: resolveObjectIdString(tenantId, "tenantId"),
    userId: resolveObjectIdString(userId, "userId"),
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("userId", "firstName lastName");

  return rows.map((r) =>
    serializeWhatsApp(r as unknown as IOutreachWhatsApp & { userId: PopulatedUser })
  );
}

export async function getWhatsAppAnalytics(tenantId: string, userId: string) {
  const tenantOid = resolveObjectIdString(tenantId, "tenantId");
  const userOid = resolveObjectIdString(userId, "userId");

  const [total, sent, failed, recent] = await Promise.all([
    OutreachWhatsApp.countDocuments({ tenantId: tenantOid, userId: userOid }),
    OutreachWhatsApp.countDocuments({
      tenantId: tenantOid,
      userId: userOid,
      status: { $in: ["sent", "delivered", "read"] },
    }),
    OutreachWhatsApp.countDocuments({
      tenantId: tenantOid,
      userId: userOid,
      status: "failed",
    }),
    OutreachWhatsApp.find({ tenantId: tenantOid, userId: userOid })
      .sort({ createdAt: -1 })
      .limit(5)
      .select("placeName status deliveryStatus createdAt outreachType")
      .populate("userId", "firstName lastName"),
  ]);

  const terminal = sent + failed;
  const successRate = terminal > 0 ? Math.round((sent / terminal) * 100) : 0;

  return {
    totalMessages: total,
    sentMessages: sent,
    failedMessages: failed,
    successRate,
    recent: recent.map((r) => {
      const row = serializeWhatsApp(
        r as unknown as IOutreachWhatsApp & { userId: PopulatedUser }
      );
      return {
        placeName: row.placeName,
        status: row.status,
        deliveryStatus: row.deliveryStatus,
        outreachType: row.outreachType,
        createdAt: row.createdAt,
        initiatedBy: row.initiatedBy,
      };
    }),
  };
}
