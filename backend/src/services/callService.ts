// src/services/callService.ts
//
// CallService prepares call context and talks to the telephony provider.
// It contains NO prompt logic (that lives in promptBuilder.ts) and NO
// audio/streaming logic (that lives in realtimeBridge.ts).
//
// Flow: CallRequest → validate → resolve organization from Tenant →
// ResolvedCallContext → Call.create() → Exotel.initiateOutboundCall().
//
// There is no script, no guide, no serialization step. The objective and
// context fields are stored directly on the Call document and re-read by
// the WebSocket GuideResolver in index.ts at call time.

import { Call, Tenant } from "../models";
import { env } from "../config/env";
import { AppError } from "../utils/AppError";
import { resolveObjectIdString } from "../utils/resolveId";
import { describeToolViolations } from "../config/toolCompatibility";
import * as exotelService from "./exotelService";
import type { ICall } from "../models/Call";
import type { CallRequest } from "../types/callRequest";

// ---------------------------------------------------------------------------
// initiateCall
// ---------------------------------------------------------------------------

export async function initiateCall(
  req: CallRequest,
  tenantId: string,
  userId: string
) {
  const normalized = req.phoneNumber.replace(/\s/g, "");
  if (!/^\+?[\d]{8,15}$/.test(normalized)) {
    throw new AppError(400, "Invalid phone number", "INVALID_PHONE");
  }

  if (req.objectiveType === "custom" && !req.customObjectiveText?.trim()) {
    throw new AppError(
      400,
      "customObjectiveText is required when objectiveType is 'custom'",
      "MISSING_CUSTOM_OBJECTIVE"
    );
  }

  // Defense-in-depth tool validation (see toolCompatibility.ts). This is
  // deliberately NOT an objective-based allowlist — a feedback call that
  // ends in a booked appointment, or a sales call that ends in a human
  // transfer, is normal conversational drift, not an error. Only unknown
  // tool values, duplicates, or a genuinely conflicting pair are rejected.
  // The route validator should already catch these before the request
  // reaches here; the service layer never trusts that it's the only caller.
  if (req.enabledTools && req.enabledTools.length > 0) {
    const violations = describeToolViolations(req.enabledTools);
    if (violations.length > 0) {
      throw new AppError(400, violations.join("; "), "INVALID_TOOL_COMBINATION");
    }
  }

  // Organization name is always resolved server-side from the tenant
  // record. It is never trusted from the frontend.
  const tenantOid = resolveObjectIdString(tenantId, "tenantId");
  const tenant = await Tenant.findById(tenantOid).select("name").lean();
  const organizationName = tenant?.name ?? "our organization";

  const call = await Call.create({
    tenantId: tenantOid,
    userId: resolveObjectIdString(userId, "userId"),
    placeId: req.placeId,
    placeName: req.recipientName,
    phoneNumber: normalized,
    category: req.recipientCategory,

    organizationName,
    objectiveType: req.objectiveType,
    customObjectiveText: req.customObjectiveText,
    businessContext: req.businessContext,
    notes: req.notes,
    enabledTools: req.enabledTools,

    status: "queued",
    direction: "outbound",
  });

  try {
    if (
      !env.exotel.apiKey ||
      !env.exotel.apiToken ||
      !env.exotel.accountSid ||
      !env.exotel.exophone
    ) {
      throw new Error("Exotel credentials not configured");
    }

    const exotel = await exotelService.initiateOutboundCall({
      to: normalized,
      customField: call._id.toString(),
    });

    call.status = "initiated";
    call.exotelCallSid = exotel.callSid;
    if (!exotel.callSid) {
      // System-diagnostic detail — goes in providerError, never in notes.
      call.providerError = "Exotel accepted request but returned no Call Sid";
    }
    await call.save();
  } catch (err) {
    // Bug fix: this used to write into `call.notes`, silently destroying
    // any business context the caller had set (e.g. "Ask for Dr. Mehta").
    // Provider/telephony failures are system diagnostics and belong in
    // their own field — `notes` is user-authored and must stay untouched.
    const message =
      err instanceof AppError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Call failed";
    call.status = "failed";
    call.providerError = message;
    await call.save();
    console.error("[callService] initiateCall provider error", {
      callId: call._id.toString(),
      message,
    });
  }

  return serializeCall(call);
}

// ---------------------------------------------------------------------------
// Read operations
// ---------------------------------------------------------------------------

type PopulatedUser = { _id: unknown; firstName?: string; lastName?: string };

export function serializeCall(
  call: ICall & { userId?: PopulatedUser | ICall["userId"] }
) {
  let initiatedBy: { id: string; name: string } | undefined;
  const uid = call.userId as unknown as PopulatedUser | undefined;
  if (uid && typeof uid === "object" && "firstName" in uid && uid._id) {
    initiatedBy = {
      id: String(uid._id),
      name: [uid.firstName, uid.lastName].filter(Boolean).join(" ").trim(),
    };
  }

  const now = new Date().toISOString();

  return {
    id: call._id.toString(),
    placeId: call.placeId,
    placeName: call.placeName,
    phoneNumber: call.phoneNumber,
    category: call.category,
    status: call.status,
    direction: call.direction,
    objectiveType: call.objectiveType,
    customObjectiveText: call.customObjectiveText,
    businessContext: call.businessContext,
    notes: call.notes,
    enabledTools: call.enabledTools,
    exotelCallSid: call.exotelCallSid,
    recordingUrl: call.recordingUrl,
    durationSeconds: call.durationSeconds,
    providerError: call.providerError,
    summary: call.summary,
    sentiment: call.sentiment,
    extractedData: call.extractedData,
    initiatedBy,
    createdAt: call.createdAt?.toISOString() ?? now,
    updatedAt: call.updatedAt?.toISOString() ?? now,
  };
}

export async function listCalls(tenantId: string, userId: string, limit = 50) {
  const calls = await Call.find({
    tenantId: resolveObjectIdString(tenantId, "tenantId"),
    userId: resolveObjectIdString(userId, "userId"),
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("userId", "firstName lastName");

  return calls.map((c) =>
    serializeCall(c as unknown as ICall & { userId: PopulatedUser })
  );
}

export async function getCallAnalytics(tenantId: string, userId: string) {
  const tenantOid = resolveObjectIdString(tenantId, "tenantId");
  const userOid = resolveObjectIdString(userId, "userId");

  const [total, completed, failed, recent] = await Promise.all([
    Call.countDocuments({ tenantId: tenantOid, userId: userOid }),
    Call.countDocuments({ tenantId: tenantOid, userId: userOid, status: "completed" }),
    Call.countDocuments({ tenantId: tenantOid, userId: userOid, status: "failed" }),
    Call.find({ tenantId: tenantOid, userId: userOid })
      .sort({ createdAt: -1 })
      .limit(5)
      .select("placeName status createdAt durationSeconds")
      .populate("userId", "firstName lastName"),
  ]);

  const terminal = completed + failed;
  const successRate =
    terminal > 0 ? Math.round((completed / terminal) * 100) : 0;

  return {
    totalCalls: total,
    completedCalls: completed,
    failedCalls: failed,
    successRate,
    recent: recent.map((c) => {
      const row = serializeCall(
        c as unknown as ICall & { userId: PopulatedUser }
      );
      return {
        placeName: row.placeName,
        status: row.status,
        createdAt: row.createdAt,
        durationSeconds: row.durationSeconds,
        initiatedBy: row.initiatedBy,
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// Webhook handler
// ---------------------------------------------------------------------------

function mapExotelTerminalStatus(
  status: string | undefined
): ICall["status"] | null {
  if (!status) return null;
  const s = status.toLowerCase();
  if (s === "completed") return "completed";
  if (s === "failed") return "failed";
  if (s === "busy") return "busy";
  if (s === "no-answer" || s === "no_answer") return "no-answer";
  return null;
}

export async function applyExotelStatusCallback(
  payload: Record<string, unknown>
) {
  console.log("[webhook] raw payload:", JSON.stringify(payload, null, 2));

  const callSid =
    typeof payload.CallSid === "string" ? payload.CallSid : undefined;
  const customField =
    typeof payload.CustomField === "string" ? payload.CustomField : undefined;

  let call: ICall | null = null;

  if (customField && /^[a-f\d]{24}$/i.test(customField)) {
    call = await Call.findById(customField);
  }
  if (!call && callSid) {
    call = await Call.findOne({ exotelCallSid: callSid });
  }
  if (!call && typeof payload.To === "string") {
    call = await Call.findOne({ phoneNumber: payload.To })
      .sort({ createdAt: -1 })
      .limit(1);
  }

  if (!call) {
    console.warn("[callService] webhook: no call match", { callSid, customField });
    return { ok: false as const, reason: "not_found" };
  }

  const status = mapExotelTerminalStatus(
    typeof payload.Status === "string" ? payload.Status : undefined
  );
  if (status) call.status = status;

  const convDuration = payload.ConversationDuration;
  if (typeof convDuration === "number") {
    call.durationSeconds = convDuration;
  } else if (typeof convDuration === "string" && /^\d+$/.test(convDuration)) {
    call.durationSeconds = parseInt(convDuration, 10);
  }

  const recording =
    typeof payload.RecordingUrl === "string" ? payload.RecordingUrl : undefined;
  if (recording) call.recordingUrl = recording;

  if (!call.exotelCallSid && callSid) call.exotelCallSid = callSid;

  await call.save();
  return { ok: true as const, callId: call._id.toString() };
}
