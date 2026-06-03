// src/services/exotelService.ts
import { env } from "../config/env";
import { AppError } from "../utils/AppError";

function assertExotelConfigured() {
  if (
    !env.exotel.apiKey ||
    !env.exotel.apiToken ||
    !env.exotel.accountSid ||
    !env.exotel.exophone
  ) {
    throw new AppError(
      503,
      "Calling is not configured. Set Exotel credentials in environment.",
      "CALLING_NOT_CONFIGURED"
    );
  }
}

function authHeader(): string {
  const token = Buffer.from(
    `${env.exotel.apiKey}:${env.exotel.apiToken}`
  ).toString("base64");
  return `Basic ${token}`;
}

export async function initiateOutboundCall(params: {
  to: string;
  customField?: string;
}): Promise<{ callSid: string; status: string }> {
  assertExotelConfigured();

  const to = params.to.replace(/\s/g, "");
  if (!to) {
    throw new AppError(400, "To phone number is required", "INVALID_CALL_LEGS");
  }

  const base = env.exotel.apiBase.replace(/\/$/, "");
  const url = `${base}/v1/Accounts/${env.exotel.accountSid}/Calls/connect.json`;

  // Exotel: From = number to call, Url = app flow to connect them to
  const body = new URLSearchParams({
    From: to,
    CallerId: env.exotel.exophone.replace(/\s/g, ""),
    Url: `http://my.exotel.com/${env.exotel.accountSid}/exoml/start_voice/${env.exotel.appId}`,
    Record: "true",
  });

  if (params.customField) {
    body.set("CustomField", params.customField);
  }

  if (env.exotel.statusCallbackUrl) {
    body.set("StatusCallback", env.exotel.statusCallbackUrl);
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  const rawText = await res.text();
  let data: {
    Call?: { Sid?: string; Status?: string };
    RestException?: { Message?: string; Status?: number };
  } = {};

  try {
    data = JSON.parse(rawText) as typeof data;
  } catch {
    // non-JSON error page
  }

  if (!res.ok) {
    const msg =
      data.RestException?.Message ??
      (rawText?.length ? rawText.slice(0, 500) : "Exotel call failed");
    console.error("[exotel] outbound call failed", {
      status: res.status,
      message: msg,
    });
    throw new AppError(502, msg, "EXOTEL_ERROR");
  }

  return {
    callSid: data.Call?.Sid ?? "",
    status: data.Call?.Status ?? "queued",
  };
}