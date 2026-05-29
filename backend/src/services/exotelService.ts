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
  const token = Buffer.from(`${env.exotel.apiKey}:${env.exotel.apiToken}`).toString(
    "base64"
  );
  return `Basic ${token}`;
}

/**
 * Exotel Connect API: dials `fromLeg` first; when answered, connects `toLeg`.
 * CallerId must be your ExoPhone (virtual number).
 * @see https://developer.exotel.com/api/make-a-call-api
 */
export async function connectTwoLegCall(params: {
  fromLeg: string;
  toLeg: string;
  customField?: string;
}): Promise<{ callSid: string; status: string }> {
  assertExotelConfigured();

  const from = params.fromLeg.replace(/\s/g, "");
  const to = params.toLeg.replace(/\s/g, "");
  if (!from || !to) {
    throw new AppError(400, "From and To phone numbers are required", "INVALID_CALL_LEGS");
  }

  const base = env.exotel.apiBase.replace(/\/$/, "");
  const url = `${base}/v1/Accounts/${env.exotel.accountSid}/Calls/connect.json`;

  const body = new URLSearchParams({
    From: from,
    To: to,
    CallerId: env.exotel.exophone.replace(/\s/g, ""),
    Record: "true",
  });

  if (params.customField) {
    body.set("CustomField", params.customField);
  }

  if (env.exotel.statusCallbackUrl) {
    body.set("StatusCallback", env.exotel.statusCallbackUrl);
    body.append("StatusCallbackEvents[0]", "terminal");
    body.set("StatusCallbackContentType", "application/json");
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
    console.error("[exotel] connect failed", {
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
