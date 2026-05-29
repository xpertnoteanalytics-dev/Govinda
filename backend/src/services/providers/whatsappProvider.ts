import { env } from "../../config/env";
import { AppError } from "../../utils/AppError";
import { getCompanyWhatsAppNumber } from "../companyOutreach";

export interface SendWhatsAppInput {
  to: string;
  body: string;
}

export interface SendWhatsAppResult {
  provider: string;
  messageId: string;
  status: "sent" | "queued";
  deliveryStatus?: string;
}

function normalizeWhatsAppTo(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) {
    throw new AppError(400, "Invalid WhatsApp phone number", "INVALID_WHATSAPP_PHONE");
  }
  return `+${digits}`;
}

function resolveCompanyWhatsAppFrom(): string {
  const from = getCompanyWhatsAppNumber();
  if (!from) {
    throw new AppError(
      503,
      "Company WhatsApp is not configured. Set COMPANY_WHATSAPP_NUMBER.",
      "WHATSAPP_NOT_CONFIGURED"
    );
  }
  return from;
}

async function sendViaTwilio(input: SendWhatsAppInput): Promise<SendWhatsAppResult> {
  const { accountSid, authToken } = env.whatsapp.twilio;
  const fromNumber = resolveCompanyWhatsAppFrom();
  if (!accountSid || !authToken) {
    throw new AppError(
      503,
      "Twilio WhatsApp is not configured",
      "TWILIO_WHATSAPP_NOT_CONFIGURED"
    );
  }

  const to = normalizeWhatsAppTo(input.to);
  const from = fromNumber.startsWith("whatsapp:")
    ? fromNumber
    : `whatsapp:${fromNumber.replace(/\s/g, "")}`;
  const toAddr = to.startsWith("whatsapp:") ? to : `whatsapp:${to.replace(/^\+/, "+")}`;

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const body = new URLSearchParams({
    From: from,
    To: toAddr,
    Body: input.body,
  });

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  const data = (await res.json()) as {
    sid?: string;
    status?: string;
    message?: string;
  };

  if (!res.ok) {
    throw new AppError(
      res.status >= 500 ? 502 : 400,
      data.message ?? "Twilio rejected the WhatsApp message",
      "WHATSAPP_PROVIDER_ERROR"
    );
  }

  return {
    provider: "twilio",
    messageId: data.sid ?? `twilio-${Date.now()}`,
    status: "sent",
    deliveryStatus: data.status,
  };
}

async function sendViaMeta(input: SendWhatsAppInput): Promise<SendWhatsAppResult> {
  const { accessToken, phoneNumberId } = env.whatsapp.meta;
  if (!accessToken || !phoneNumberId) {
    throw new AppError(503, "Meta WhatsApp is not configured", "META_WHATSAPP_NOT_CONFIGURED");
  }

  const to = normalizeWhatsAppTo(input.to).replace(/\D/g, "");

  const res = await fetch(
    `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: input.body },
      }),
    }
  );

  const data = (await res.json()) as {
    messages?: Array<{ id: string }>;
    error?: { message?: string };
  };

  if (!res.ok) {
    throw new AppError(
      res.status >= 500 ? 502 : 400,
      data.error?.message ?? "Meta WhatsApp API error",
      "WHATSAPP_PROVIDER_ERROR"
    );
  }

  return {
    provider: "meta",
    messageId: data.messages?.[0]?.id ?? `meta-${Date.now()}`,
    status: "sent",
    deliveryStatus: "accepted",
  };
}

async function sendViaLog(input: SendWhatsAppInput): Promise<SendWhatsAppResult> {
  const from = getCompanyWhatsAppNumber() || "(not configured)";
  console.info("[whatsappProvider:log]", {
    from,
    to: input.to,
    preview: input.body.slice(0, 120),
  });
  return {
    provider: "log",
    messageId: `log-wa-${Date.now()}`,
    status: "sent",
    deliveryStatus: "simulated",
  };
}

export async function sendWhatsAppMessage(
  input: SendWhatsAppInput
): Promise<SendWhatsAppResult> {
  switch (env.whatsapp.provider) {
    case "twilio":
      return sendViaTwilio(input);
    case "meta":
      return sendViaMeta(input);
    case "log":
    default:
      return sendViaLog(input);
  }
}

/**
 * Deep link to message the facility (recipient). Uses api.whatsapp.com for consistency.
 * Note: device WhatsApp still uses the locally logged-in account; prefer API send for company sender.
 */
export function buildWhatsAppDeepLink(facilityPhone: string, message: string): string {
  const digits = facilityPhone.replace(/\D/g, "");
  const text = encodeURIComponent(message);
  return `https://api.whatsapp.com/send?phone=${digits}&text=${text}`;
}

/** True when Twilio/Meta can send from the company WhatsApp line. */
export function isWhatsAppApiConfigured(): boolean {
  if (!getCompanyWhatsAppNumber() && env.whatsapp.provider === "twilio") {
    return false;
  }
  if (env.whatsapp.provider === "log") return Boolean(getCompanyWhatsAppNumber());
  if (env.whatsapp.provider === "twilio") {
    return Boolean(
      env.whatsapp.twilio.accountSid &&
        env.whatsapp.twilio.authToken &&
        getCompanyWhatsAppNumber()
    );
  }
  if (env.whatsapp.provider === "meta") {
    return Boolean(env.whatsapp.meta.accessToken && env.whatsapp.meta.phoneNumberId);
  }
  return false;
}
