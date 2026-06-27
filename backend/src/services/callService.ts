// src/services/callService.ts
//
// Public API for the call subsystem.
//
// Changes from the original:
//   • generateCallingScript() is replaced by generateConversationGuide()
//     and convertUserScript().
//   • Both new functions return a serialised ConversationGuide JSON string
//     that is stored in the existing Call.script field (no schema change needed).
//   • initiateCall() accepts a pre-built guide string OR auto-generates one
//     if neither guide nor script is provided.
//   • Everything else (initiateCall provider logic, listCalls, analytics,
//     webhook handler, serializeCall) is unchanged.

import { Call } from "../models";
import { env } from "../config/env";
import { AppError } from "../utils/AppError";
import { resolveObjectIdString } from "../utils/resolveId";
import * as exotelService from "./exotelService";
import type { ICall } from "../models/Call";
import {
  generateGuide,
  convertScriptToGuide,
  serializeGuide,
  type CallType,
  type GenerateGuideParams,
  type ConvertScriptParams,
} from "./conversationGuideService";

// Re-export CallType so existing callers of callService don't need to change
// their import paths.
export { type CallType };

// ---------------------------------------------------------------------------
// Guide generation — USE CASE 1
// ---------------------------------------------------------------------------

/**
 * Generate a ConversationGuide from scratch using Gemini.
 * Replaces the old generateCallingScript() function.
 * Returns a serialised JSON string suitable for storing in Call.script.
 */
export async function generateConversationGuide(params: {
  placeName: string;
  category: string;
  purpose?: string;
  organizationName?: string;
  callType?: CallType;
  additionalContext?: string;
}): Promise<string> {
  const guideParams: GenerateGuideParams = {
    recipientName: params.placeName,
    recipientCategory: params.category,
    callType: params.callType ?? "pharmacy_inquiry",
    purpose: params.purpose,
    organizationName: params.organizationName,
    additionalContext: params.additionalContext,
  };
  const guide = await generateGuide(guideParams);
  return serializeGuide(guide);
}

// ---------------------------------------------------------------------------
// User script conversion — USE CASE 2
// ---------------------------------------------------------------------------

/**
 * Convert a user-written script into a ConversationGuide.
 * The original script wording is discarded — only business intent is preserved.
 * Returns a serialised JSON string suitable for storing in Call.script.
 */
export async function convertUserScript(params: {
  userScript: string;
  placeName: string;
  category: string;
  organizationName?: string;
  callType?: CallType;
}): Promise<string> {
  const convertParams: ConvertScriptParams = {
    userScript: params.userScript,
    recipientName: params.placeName,
    recipientCategory: params.category,
    callType: params.callType ?? "pharmacy_inquiry",
    organizationName: params.organizationName,
  };
  const guide = await convertScriptToGuide(convertParams);
  return serializeGuide(guide);
}

// ---------------------------------------------------------------------------
// Legacy alias — keeps existing callers working during migration
// ---------------------------------------------------------------------------

/**
 * @deprecated Use generateConversationGuide() instead.
 * Kept for backward compatibility with existing route handlers.
 * Will be removed in a future release.
 */
export async function generateCallingScript(params: {
  placeName: string;
  category: string;
  purpose?: string;
  organizationName?: string;
  scriptType?: CallType;
}): Promise<string> {
  console.warn(
    "[callService] generateCallingScript() is deprecated. " +
    "Use generateConversationGuide() instead."
  );
  return generateConversationGuide({
    placeName: params.placeName,
    category: params.category,
    purpose: params.purpose,
    organizationName: params.organizationName,
    callType: params.scriptType,
  });
}

// ---------------------------------------------------------------------------
// initiateCall — unchanged provider logic, guide-aware script storage
// ---------------------------------------------------------------------------

export async function initiateCall(params: {
  tenantId: string;
  userId: string;
  placeId?: string;
  placeName: string;
  phoneNumber: string;
  category?: string;
  /** Pre-built guide JSON or legacy script string. If omitted, auto-generated. */
  script?: string;
  /** Whether script is a user-written script that needs conversion. */
  convertScript?: boolean;
  scriptType?: CallType;
}) {
  const normalized = params.phoneNumber.replace(/\s/g, "");
  if (!/^\+?[\d]{8,15}$/.test(normalized)) {
    throw new AppError(400, "Invalid phone number", "INVALID_PHONE");
  }

  // Determine the guide string to store
  let guideJson: string | undefined = params.script;

  if (params.script && params.convertScript) {
    // User provided a hand-written script — convert it to a guide
    try {
      guideJson = await convertUserScript({
        userScript: params.script,
        placeName: params.placeName,
        category: params.category ?? "Healthcare",
        callType: params.scriptType,
      });
    } catch (err) {
      console.error("[callService] script conversion failed — using raw script:", err);
      // Fall through: guideJson stays as the raw script (legacy compat)
    }
  } else if (!params.script) {
    // No script provided — auto-generate a guide
    try {
      guideJson = await generateConversationGuide({
        placeName: params.placeName,
        category: params.category ?? "Healthcare",
        callType: params.scriptType,
      });
    } catch (err) {
      console.error("[callService] guide generation failed — proceeding without guide:", err);
      guideJson = undefined;
    }
  }

  const call = await Call.create({
    tenantId: resolveObjectIdString(params.tenantId, "tenantId"),
    userId: resolveObjectIdString(params.userId, "userId"),
    placeId: params.placeId,
    placeName: params.placeName,
    phoneNumber: normalized,
    category: params.category,
    script: guideJson,           // stores the ConversationGuide JSON (or legacy text)
    scriptType: params.scriptType,
    status: "queued",
    direction: "outbound",
  });

  let credentialsOk = true;
  try {
    if (
      !env.exotel.apiKey ||
      !env.exotel.apiToken ||
      !env.exotel.accountSid ||
      !env.exotel.exophone
    ) {
      credentialsOk = false;
      throw new Error("Exotel credentials not configured");
    }

    const exotel = await exotelService.initiateOutboundCall({
      to: normalized,
      customField: call._id.toString(),
    });

    call.status = "initiated";
    call.exotelCallSid = exotel.callSid;
    if (!exotel.callSid) {
      call.notes = "Exotel accepted request but returned no Call Sid";
    }
    await call.save();
  } catch (err) {
    const message =
      err instanceof AppError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Call failed";
    call.status = "failed";
    call.notes = credentialsOk ? message : `Exotel unavailable: ${message}`;
    await call.save();
    console.error("[callService] initiateCall provider error", {
      callId: call._id.toString(),
      message,
    });
  }

  return serializeCall(call);
}

// ---------------------------------------------------------------------------
// Read operations — unchanged
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
    script: call.script,
    scriptType: call.scriptType,
    exotelCallSid: call.exotelCallSid,
    recordingUrl: call.recordingUrl,
    durationSeconds: call.durationSeconds,
    notes: call.notes,
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
// Webhook handler — unchanged
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
