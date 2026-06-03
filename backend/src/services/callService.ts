// src/services/callService.ts
import { Call } from "../models";
import { env } from "../config/env";
import { AppError } from "../utils/AppError";
import { resolveObjectIdString } from "../utils/resolveId";
import * as exotelService from "./exotelService";
import type { ICall } from "../models/Call";
import {
  generateAiCallScript,
  type CallScriptType,
} from "./callScriptGeneration";

export { type CallScriptType };

export async function generateCallingScript(params: {
  placeName: string;
  category: string;
  purpose?: string;
  organizationName?: string;
  scriptType?: CallScriptType;
}): Promise<string> {
  const scriptType: CallScriptType = params.scriptType ?? "pharmacy_inquiry";
  return generateAiCallScript({
    placeName: params.placeName,
    category: params.category,
    purpose: params.purpose,
    organizationName: params.organizationName,
    scriptType,
  });
}

export async function initiateCall(params: {
  tenantId: string;
  userId: string;
  placeId?: string;
  placeName: string;
  phoneNumber: string;
  category?: string;
  script?: string;
  scriptType?: CallScriptType;
}) {
  const normalized = params.phoneNumber.replace(/\s/g, "");
  if (!/^\+?[\d]{8,15}$/.test(normalized)) {
    throw new AppError(400, "Invalid phone number", "INVALID_PHONE");
  }

  const call = await Call.create({
    tenantId: resolveObjectIdString(params.tenantId, "tenantId"),
    userId: resolveObjectIdString(params.userId, "userId"),
    placeId: params.placeId,
    placeName: params.placeName,
    phoneNumber: normalized,
    category: params.category,
    script: params.script,
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
    Call.countDocuments({
      tenantId: tenantOid,
      userId: userOid,
      status: "completed",
    }),
    Call.countDocuments({
      tenantId: tenantOid,
      userId: userOid,
      status: "failed",
    }),
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
  if (status) {
    call.status = status;
  }

  const convDuration = payload.ConversationDuration;
  if (typeof convDuration === "number") {
    call.durationSeconds = convDuration;
  } else if (
    typeof convDuration === "string" &&
    /^\d+$/.test(convDuration)
  ) {
    call.durationSeconds = parseInt(convDuration, 10);
  }

  const recording =
    typeof payload.RecordingUrl === "string"
      ? payload.RecordingUrl
      : undefined;
  if (recording) {
    call.recordingUrl = recording;
  }

  if (!call.exotelCallSid && callSid) {
    call.exotelCallSid = callSid;
  }

  await call.save();
  return { ok: true as const, callId: call._id.toString() };
}