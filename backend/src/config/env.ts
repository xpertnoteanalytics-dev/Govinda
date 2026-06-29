// src/config/env.ts
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
    provider: (process.env.AI_PROVIDER ?? "gemini") as "gemini" | "openai",
  },
  googleMaps: {
    apiKey: process.env.GOOGLE_MAPS_API_KEY ?? "",
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY ?? "",
    model: process.env.OPENAI_MODEL ?? "gpt-realtime-1.5",
  },
  exotel: {
    apiBase: process.env.EXOTEL_API_BASE ?? "https://api.exotel.com",
    apiKey: process.env.EXOTEL_API_KEY ?? "",
    apiToken: process.env.EXOTEL_API_TOKEN ?? "",
    accountSid: process.env.EXOTEL_ACCOUNT_SID ?? "",
    exophone: process.env.EXOTEL_EXOPHONE ?? "",
    fromNumber: process.env.EXOTEL_FROM_NUMBER ?? "",
    statusCallbackUrl: process.env.EXOTEL_STATUS_CALLBACK_URL ?? "",
    webhookSecret: process.env.EXOTEL_WEBHOOK_SECRET ?? "",
    voicebotUrl: process.env.EXOTEL_VOICEBOT_URL ?? "",
    voicebotWsUrl: process.env.EXOTEL_VOICEBOT_WS_URL ?? "",
    appId: process.env.EXOTEL_APP_ID ?? "",          // ← add this
  },
  elevenLabs: {
    apiKey: process.env.ELEVENLABS_API_KEY ?? "",
    // No default — must be filled in after picking an Indian male voice
    // from the ElevenLabs Voice Library (e.g. "Aakash Aryan" or similar)
    // and copying its voice_id from My Voices. ElevenLabsClient throws a
    // clear error at connect time if this is empty, rather than silently
    // failing or guessing a voice ID that may not exist on this account.
    voiceId: process.env.ELEVENLABS_VOICE_ID ?? "",
    // Flash v2.5 — the model ElevenLabs themselves recommend for live
    // conversational voice agents (~75ms model inference time), not v3
    // (expressive but not real-time) or Multilingual v2 (higher quality,
    // higher latency, meant for narration).
    modelId: process.env.ELEVENLABS_MODEL_ID ?? "eleven_flash_v2_5",
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
    whatsappNumber: process.env.COMPANY_WHATSAPP_NUMBER ?? "",
    supportEmail: process.env.COMPANY_SUPPORT_EMAIL ?? "",
  },
  email: {
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
