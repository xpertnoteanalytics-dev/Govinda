import dotenv from "dotenv";

dotenv.config();

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: parseInt(process.env.PORT ?? "4000", 10),
  mongodbUri: requireEnv("MONGODB_URI"),
  jwt: {
    accessSecret: requireEnv("JWT_ACCESS_SECRET"),
    refreshSecret: requireEnv("JWT_REFRESH_SECRET"),
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? "15m",
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? "7d",
  },
  clientUrl: process.env.CLIENT_URL ?? "http://localhost:3000",
  isProduction: process.env.NODE_ENV === "production",
  gemini: {
    apiKey: process.env.GEMINI_API_KEY ?? "",
    model: process.env.GEMINI_MODEL ?? "gemini-2.0-flash",
  },
  ai: {
    /**
     * Primary runtime provider. Keep Gemini as the safe default.
     * - gemini: uses Google Generative AI (no tool calling)
     * - openai: uses OpenAI agent with tool calling (maps/calls/memory)
     */
    provider: (process.env.AI_PROVIDER ?? "gemini") as "gemini" | "openai",
  },
  googleMaps: {
    apiKey: process.env.GOOGLE_MAPS_API_KEY ?? "",
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY ?? "",
    model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
  },
  exotel: {
    /** Mumbai cluster: https://api.in.exotel.com — Singapore: https://api.exotel.com */
    apiBase: process.env.EXOTEL_API_BASE ?? "https://api.exotel.com",
    apiKey: process.env.EXOTEL_API_KEY ?? "",
    apiToken: process.env.EXOTEL_API_TOKEN ?? "",
    accountSid: process.env.EXOTEL_ACCOUNT_SID ?? "",
    exophone: process.env.EXOTEL_EXOPHONE ?? "",
    /** First leg for Connect API: staff/agent phone Exotel dials before the destination (To). */
    fromNumber: process.env.EXOTEL_FROM_NUMBER ?? "",
    /** Optional: public URL Exotel POSTs terminal status to (include /api/webhooks/exotel/call-status). */
    statusCallbackUrl: process.env.EXOTEL_STATUS_CALLBACK_URL ?? "",
    webhookSecret: process.env.EXOTEL_WEBHOOK_SECRET ?? "",
  },
  elevenLabs: {
    apiKey: process.env.ELEVENLABS_API_KEY ?? "",
  },
  anam: {
    apiKey: process.env.ANAM_API_KEY ?? "",
    agentIds: {
      govinda: process.env.ANAM_AGENT_ID_GOVINDA ?? "",
      durga: process.env.ANAM_AGENT_ID_DURGA ?? "",
    },
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? "60000", 10),
    max: parseInt(process.env.RATE_LIMIT_MAX ?? "120", 10),
  },
  company: {
    /** Official company WhatsApp line (outbound sender for API + displayed in UI). */
    whatsappNumber: process.env.COMPANY_WHATSAPP_NUMBER ?? "",
    /** Official company support inbox (outbound email From). */
    supportEmail: process.env.COMPANY_SUPPORT_EMAIL ?? "",
  },
  email: {
    /** log (dev), resend, sendgrid — nodemailer/SMTP can be added alongside */
    provider: (process.env.EMAIL_PROVIDER ?? "log") as "log" | "resend" | "sendgrid" | "gmail",
    from: process.env.EMAIL_FROM ?? "",
    resendApiKey: process.env.RESEND_API_KEY ?? "",
    sendgridApiKey: process.env.SENDGRID_API_KEY ?? "",
  },
  whatsapp: {
    provider: (process.env.WHATSAPP_PROVIDER ?? "log") as "log" | "twilio" | "meta",
    twilio: {
      accountSid: process.env.TWILIO_ACCOUNT_SID ?? "",
      authToken: process.env.TWILIO_AUTH_TOKEN ?? "",
      /** Falls back to COMPANY_WHATSAPP_NUMBER when unset. */
      fromNumber:
        process.env.TWILIO_WHATSAPP_FROM ??
        process.env.COMPANY_WHATSAPP_NUMBER ??
        "",
    },
    meta: {
      accessToken: process.env.META_WHATSAPP_ACCESS_TOKEN ?? "",
      phoneNumberId: process.env.META_WHATSAPP_PHONE_NUMBER_ID ?? "",
    },
  },
} as const;
