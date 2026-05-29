import { OutreachEmail } from "../models";
import type { IOutreachEmail } from "../models/OutreachEmail";
import { AppError } from "../utils/AppError";
import { resolveObjectIdString } from "../utils/resolveId";
import * as emailProvider from "./providers/emailProvider";
import {
  generateOutreachEmailDraft,
} from "./outreachContentGeneration";
import {
  applyCompanyMessageBranding,
  getCompanySupportEmail,
} from "./companyOutreach";
import type { OutreachType } from "../types/outreach";
import { extractOperationalIntent } from "./aiIntentExtraction";
import { Appointment } from "../models/Appointment";
import { Feedback } from "../models/Feedback";

export { type OutreachType };

export async function generateEmailDraft(params: {
  placeName: string;
  category: string;
  outreachType?: OutreachType;
  purpose?: string;
  organizationName?: string;
}): Promise<{ subject: string; body: string }> {
  const outreachType: OutreachType = params.outreachType ?? "pharmacy_inquiry";
  return generateOutreachEmailDraft({
    placeName: params.placeName,
    category: params.category,
    outreachType,
    purpose: params.purpose,
    organizationName: params.organizationName,
  });
}

export async function sendOutreachEmail(params: {
  tenantId: string;
  userId: string;
  placeId?: string;
  placeName: string;
  toEmail: string;
  subject: string;
  body: string;
  category?: string;
  outreachType?: OutreachType;
}) {
  const email = params.toEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AppError(400, "Invalid email address", "INVALID_EMAIL");
  }

  const outreachType: OutreachType = params.outreachType ?? "pharmacy_inquiry";
  const fromEmail = getCompanySupportEmail();
  const body = applyCompanyMessageBranding(params.body.trim());

  const record = await OutreachEmail.create({
    tenantId: resolveObjectIdString(params.tenantId, "tenantId"),
    userId: resolveObjectIdString(params.userId, "userId"),
    placeId: params.placeId,
    placeName: params.placeName,
    category: params.category,
    toEmail: email,
    fromEmail: fromEmail || undefined,
    subject: params.subject.trim(),
    body,
    outreachType,
    status: "queued",
  });

  try {
    const result = await emailProvider.sendEmail({
      to: email,
      subject: record.subject,
      body: record.body,
    });
    record.status = result.status === "sent" ? "sent" : "queued";
    record.provider = result.provider;
    record.providerMessageId = result.messageId;
    await record.save();
    try {
  const extracted = await extractOperationalIntent(record.body);

  if (extracted.intent === "appointment") {
    await Appointment.create({
      patientName: extracted.patientName,
      service: extracted.service,
      appointmentDate: extracted.appointmentDate,
      appointmentTime: extracted.appointmentTime,
      source: "email",
      notes: record.body,
    });

    console.log("[AI] Appointment created");
  }

  if (extracted.intent === "feedback") {
    await Feedback.create({
      patientName: extracted.patientName,
      feedback: extracted.feedback,
      sentiment: extracted.sentiment,
      source: "email",
    });

    console.log("[AI] Feedback created");
  }
} catch (aiErr) {
  console.error("[AI] Intent extraction failed", aiErr);
}
  } catch (err) {
    const message =
      err instanceof AppError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Email failed";
    record.status = "failed";
    record.notes = message;
    await record.save();
    console.error("[emailService] sendOutreachEmail provider error", {
      emailId: record._id.toString(),
      message,
    });
  }

  return serializeEmail(record);
}

type PopulatedUser = { _id: unknown; firstName?: string; lastName?: string };

export function serializeEmail(
  row: IOutreachEmail & { userId?: PopulatedUser | IOutreachEmail["userId"] }
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
    toEmail: row.toEmail,
    fromEmail: row.fromEmail,
    subject: row.subject,
    body: row.body,
    outreachType: row.outreachType,
    status: row.status,
    provider: row.provider,
    providerMessageId: row.providerMessageId,
    notes: row.notes,
    initiatedBy,
    createdAt: row.createdAt?.toISOString() ?? now,
    updatedAt: row.updatedAt?.toISOString() ?? now,
  };
}

export async function listEmails(tenantId: string, userId: string, limit = 50) {
  const rows = await OutreachEmail.find({
    tenantId: resolveObjectIdString(tenantId, "tenantId"),
    userId: resolveObjectIdString(userId, "userId"),
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("userId", "firstName lastName");

  return rows.map((r) =>
    serializeEmail(r as unknown as IOutreachEmail & { userId: PopulatedUser })
  );
}

export async function getEmailAnalytics(tenantId: string, userId: string) {
  const tenantOid = resolveObjectIdString(tenantId, "tenantId");
  const userOid = resolveObjectIdString(userId, "userId");

  const [total, sent, failed, recent] = await Promise.all([
    OutreachEmail.countDocuments({ tenantId: tenantOid, userId: userOid }),
    OutreachEmail.countDocuments({
      tenantId: tenantOid,
      userId: userOid,
      status: { $in: ["sent", "delivered"] },
    }),
    OutreachEmail.countDocuments({ tenantId: tenantOid, userId: userOid, status: "failed" }),
    OutreachEmail.find({ tenantId: tenantOid, userId: userOid })
      .sort({ createdAt: -1 })
      .limit(5)
      .select("placeName subject status createdAt outreachType")
      .populate("userId", "firstName lastName"),
  ]);

  const terminal = sent + failed;
  const successRate = terminal > 0 ? Math.round((sent / terminal) * 100) : 0;

  return {
    totalEmails: total,
    sentEmails: sent,
    failedEmails: failed,
    successRate,
    recent: recent.map((r) => {
      const row = serializeEmail(r as unknown as IOutreachEmail & { userId: PopulatedUser });
      return {
        placeName: row.placeName,
        subject: row.subject,
        status: row.status,
        outreachType: row.outreachType,
        createdAt: row.createdAt,
        initiatedBy: row.initiatedBy,
      };
    }),
  };
}
