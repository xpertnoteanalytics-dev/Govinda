import { env } from "../../config/env";
import { AppError } from "../../utils/AppError";
import { getCompanySupportEmail } from "../companyOutreach";
import nodemailer from "nodemailer";

export interface SendEmailInput {
  to: string;
  subject: string;
  body: string;
  replyTo?: string;
}

export interface SendEmailResult {
  provider: string;
  messageId: string;
  status: "sent" | "queued";
}

function resolveFromAddress(): string {
  const from = getCompanySupportEmail();
  if (!from) {
    throw new AppError(
      503,
      "Company email is not configured. Set COMPANY_SUPPORT_EMAIL (or EMAIL_FROM).",
      "EMAIL_NOT_CONFIGURED"
    );
  }
  return from;
}

async function sendViaResend(input: SendEmailInput): Promise<SendEmailResult> {
  if (!env.email.resendApiKey) {
    throw new AppError(503, "Resend API key not configured", "RESEND_NOT_CONFIGURED");
  }
  const from = resolveFromAddress();

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.email.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      text: input.body,
      reply_to: input.replyTo,
    }),
  });

  const data = (await res.json()) as { id?: string; message?: string };
  if (!res.ok) {
    throw new AppError(
      res.status >= 500 ? 502 : 400,
      data.message ?? "Resend rejected the email",
      "EMAIL_PROVIDER_ERROR"
    );
  }

  return {
    provider: "resend",
    messageId: data.id ?? `resend-${Date.now()}`,
    status: "sent",
  };
}

async function sendViaSendGrid(input: SendEmailInput): Promise<SendEmailResult> {
  if (!env.email.sendgridApiKey) {
    throw new AppError(503, "SendGrid API key not configured", "SENDGRID_NOT_CONFIGURED");
  }
  const from = resolveFromAddress();

  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.email.sendgridApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: input.to }] }],
      from: { email: from },
      subject: input.subject,
      content: [{ type: "text/plain", value: input.body }],
      reply_to: input.replyTo ? { email: input.replyTo } : undefined,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new AppError(
      res.status >= 500 ? 502 : 400,
      text.slice(0, 200) || "SendGrid rejected the email",
      "EMAIL_PROVIDER_ERROR"
    );
  }

  const messageId = res.headers.get("x-message-id") ?? `sendgrid-${Date.now()}`;
  return { provider: "sendgrid", messageId, status: "sent" };
}

async function sendViaGmail(input: SendEmailInput): Promise<SendEmailResult> {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    throw new AppError(
      503,
      "Gmail SMTP not configured",
      "GMAIL_NOT_CONFIGURED"
    );
  }

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  const info = await transporter.sendMail({
    from: process.env.GMAIL_USER,
    to: input.to,
    subject: input.subject,
    text: input.body,
    replyTo: input.replyTo,
  });

  return {
    provider: "gmail",
    messageId: info.messageId,
    status: "sent",
  };
}
/** Development-safe provider: records intent without external API. */
async function sendViaLog(input: SendEmailInput): Promise<SendEmailResult> {
  const from = getCompanySupportEmail() || "(not configured)";
  console.info("[emailProvider:log]", {
    from,
    to: input.to,
    subject: input.subject,
    preview: input.body.slice(0, 120),
  });
  return {
    provider: "log",
    messageId: `log-${Date.now()}`,
    status: "sent",
  };
}

/**
 * Provider-ready email dispatch (Resend / SendGrid / log fallback).
 * Nodemailer can be wired by adding a nodemailer branch when SMTP_* env vars are set.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const provider = env.email.provider;

  switch (provider) {
  case "gmail":
    return sendViaGmail(input);

  case "resend":
    return sendViaResend(input);

  case "sendgrid":
    return sendViaSendGrid(input);

  case "log":
  default:
    return sendViaLog(input);
}
}

export function isEmailProviderConfigured(): boolean {
  if (!getCompanySupportEmail()) return false;
  if (env.email.provider === "log") return true;
  if (env.email.provider === "resend") {
    return Boolean(env.email.resendApiKey);
  }
  if (env.email.provider === "sendgrid") {
    return Boolean(env.email.sendgridApiKey);
  }
  return false;
}
