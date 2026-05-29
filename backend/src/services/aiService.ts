import { GoogleGenerativeAI, GoogleGenerativeAIError } from "@google/generative-ai";
import { Chat, Tenant } from "../models";
import type { IChat, IChatMessage } from "../models/Chat";
import { env } from "../config/env";
import { AppError } from "../utils/AppError";
import { resolveObjectIdString } from "../utils/resolveId";
import type { Role } from "../types/roles";

const BASE_SYSTEM_PROMPT = `You are Govinda AI, an expert healthcare operations assistant...`;

// ─── Singleton GenAI client (avoids re-instantiation per request) ───────────
let _genAI: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
  if (!env.gemini.apiKey) {
    throw new AppError(
      503,
      "AI service is not configured. Set GEMINI_API_KEY.",
      "AI_NOT_CONFIGURED"
    );
  }
  if (!_genAI) {
    _genAI = new GoogleGenerativeAI(env.gemini.apiKey);
  }
  return _genAI;
}

// ─── Classify Gemini errors into AppErrors ───────────────────────────────────
function classifyGeminiError(err: unknown): AppError {
  console.error("[Gemini] RAW:", JSON.stringify(err, Object.getOwnPropertyNames(err as object), 2));
  console.error("[Gemini] TYPE:", (err as any)?.constructor?.name);
  console.error("[Gemini] STATUS:", (err as any)?.status);
  console.error("[Gemini] MESSAGE:", (err as any)?.message);

  if (err instanceof GoogleGenerativeAIError) {
    const msg = err.message.toLowerCase();
    const httpStatus = (err as any)?.status ?? 0;

    if (httpStatus === 401 || httpStatus === 403 || msg.includes("api_key")) {
      return new AppError(503, "Invalid Gemini API key", "AI_NOT_CONFIGURED");
    }
    if (httpStatus === 429 || msg.includes("quota") || msg.includes("resource exhausted")) {
      return new AppError(429, "Gemini quota exceeded", "AI_QUOTA_EXCEEDED");
    }
    if (httpStatus === 404 || msg.includes("not found")) {
      return new AppError(503, `Model not found: ${env.gemini.model}`, "AI_MODEL_NOT_FOUND");
    }
    if (msg.includes("safety") || msg.includes("blocked")) {
      return new AppError(422, "Blocked by safety filters", "AI_SAFETY_BLOCK");
    }
    return new AppError(502, `Gemini error ${httpStatus}: ${(err as any).message}`, "AI_GENERATION_FAILED");
  }

  console.error("[Gemini] NOT GoogleGenerativeAIError:", err);
  return new AppError(502, `AI failed: ${(err as any)?.message ?? "unknown"}`, "AI_GENERATION_FAILED");
}
// ─── Build system prompt ─────────────────────────────────────────────────────
export async function buildSystemPrompt(tenantId: string, userRole: Role): Promise<string> {
  const tenant = await Tenant.findById(
    resolveObjectIdString(tenantId, "tenantId")
  ).select("name slug plan settings");

  const parts = [BASE_SYSTEM_PROMPT];

  if (tenant) {
    parts.push(
      `\nOrganization: ${tenant.name} (${tenant.slug})`,
      `Plan: ${tenant.plan}`,
      `User role: ${userRole.replace(/_/g, " ")}`
    );

    if (tenant.settings?.aiSystemPrompt?.trim()) {
      parts.push(
        `\nOrganization-specific instructions:\n${tenant.settings.aiSystemPrompt.trim()}`
      );
    }
  }

  return parts.join("\n");
}

// ─── Format MongoDB messages → Gemini history format ────────────────────────
function toGeminiHistory(messages: IChatMessage[]) {
  return messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",  // Gemini uses "model" not "assistant"
      parts: [{ text: m.content }],
    }));
}

// ─── Core Gemini call ────────────────────────────────────────────────────────
async function generateAssistantReply(
  systemPrompt: string,
  history: IChatMessage[],   // All messages BEFORE the current user message
  userMessage: string
): Promise<string> {
  const genAI = getGenAI();

  const model = genAI.getGenerativeModel({
    model: env.gemini.model,          // e.g. "gemini-1.5-flash"
    systemInstruction: systemPrompt,  // ✅ Set ONCE here only
  });

  // history = prior turns only; current message goes to sendMessage()
  const geminiHistory = toGeminiHistory(history);

  console.debug(
    `[Gemini] Starting chat | model=${env.gemini.model} | historyTurns=${geminiHistory.length}`
  );

  const chat = model.startChat({
    history: geminiHistory,
    // Optional: tune generation
    generationConfig: {
      maxOutputTokens: 2048,
      temperature: 0.7,
    },
  });

  // ✅ Send ONLY the user message — no system prompt here
  const result = await chat.sendMessage(userMessage);
  const text = result.response.text();

  if (!text?.trim()) {
    throw new AppError(502, "Empty response from AI model", "AI_EMPTY_RESPONSE");
  }

  console.debug(`[Gemini] Reply received | chars=${text.length}`);
  return text.trim();
}

// ─── Friendly fallback message ───────────────────────────────────────────────
function friendlyUnavailableMessage(code?: string): string {
  if (code === "AI_SAFETY_BLOCK") {
    return "Your message was flagged by safety filters. Please rephrase and try again.";
  }
  if (code === "AI_QUOTA_EXCEEDED") {
    return "The AI service is temporarily rate-limited. Please try again in a few minutes.";
  }
  return [
    "I'm temporarily unable to reach the AI service.",
    "",
    "Please try again in a moment. If the issue persists, contact your administrator.",
  ].join("\n");
}

// ─── Utility helpers ─────────────────────────────────────────────────────────
function deriveTitle(firstMessage: string): string {
  const cleaned = firstMessage.replace(/\s+/g, " ").trim();
  if (cleaned.length <= 48) return cleaned || "New conversation";
  return `${cleaned.slice(0, 45)}…`;
}

async function getOwnedChat(
  chatId: string,
  tenantId: string,
  userId: string
): Promise<IChat> {
  const chat = await Chat.findOne({
    _id: resolveObjectIdString(chatId, "chatId"),
    tenantId: resolveObjectIdString(tenantId, "tenantId"),
    userId: resolveObjectIdString(userId, "userId"),
  });
  if (!chat) {
    throw new AppError(404, "Conversation not found", "CHAT_NOT_FOUND");
  }
  return chat;
}

// ─── Serializers ─────────────────────────────────────────────────────────────
export function serializeChat(chat: IChat) {
  return {
    id: chat._id.toString(),
    title: chat.title,
    tenantId: chat.tenantId.toString(),
    userId: chat.userId.toString(),
    messages: chat.messages.map((m) => ({
      id: String((m as IChatMessage & { _id?: unknown })._id ?? ""),
      role: m.role,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    })),
    createdAt: chat.createdAt.toISOString(),
    updatedAt: chat.updatedAt.toISOString(),
  };
}

export function serializeChatSummary(chat: IChat) {
  const lastMessage = chat.messages[chat.messages.length - 1];
  return {
    id: chat._id.toString(),
    title: chat.title,
    preview: lastMessage?.content?.slice(0, 80) ?? "",
    messageCount: chat.messages.length,
    updatedAt: chat.updatedAt.toISOString(),
    createdAt: chat.createdAt.toISOString(),
  };
}

// ─── Public service methods ───────────────────────────────────────────────────
export async function listChats(tenantId: string, userId: string) {
  const chats = await Chat.find({
    tenantId: resolveObjectIdString(tenantId, "tenantId"),
    userId: resolveObjectIdString(userId, "userId"),
  })
    .sort({ updatedAt: -1 })
    .limit(50);

  return chats.map(serializeChatSummary);
}

export async function getChat(chatId: string, tenantId: string, userId: string) {
  const chat = await getOwnedChat(chatId, tenantId, userId);
  return serializeChat(chat);
}

export async function createChat(tenantId: string, userId: string, title?: string) {
  const chat = await Chat.create({
    tenantId: resolveObjectIdString(tenantId, "tenantId"),
    userId: resolveObjectIdString(userId, "userId"),
    title: title?.trim() || "New conversation",
    messages: [],
  });
  return serializeChat(chat);
}

export async function deleteChat(
  chatId: string,
  tenantId: string,
  userId: string
): Promise<void> {
  const result = await Chat.deleteOne({
    _id: resolveObjectIdString(chatId, "chatId"),
    tenantId: resolveObjectIdString(tenantId, "tenantId"),
    userId: resolveObjectIdString(userId, "userId"),
  });
  if (result.deletedCount === 0) {
    throw new AppError(404, "Conversation not found", "CHAT_NOT_FOUND");
  }
}

export async function sendMessage(
  chatId: string,
  tenantId: string,
  userId: string,
  userRole: Role,
  content: string
) {
  const chat = await getOwnedChat(chatId, tenantId, userId);
  const trimmed = content.trim();

  if (!trimmed) throw new AppError(400, "Message cannot be empty", "EMPTY_MESSAGE");
  if (trimmed.length > 8000) throw new AppError(400, "Message is too long", "MESSAGE_TOO_LONG");

  // Append user message first
  const userMsg: IChatMessage = {
    role: "user",
    content: trimmed,
    createdAt: new Date(),
  };
  chat.messages.push(userMsg);

  if (chat.messages.length === 1 && chat.title === "New conversation") {
    chat.title = deriveTitle(trimmed);
  }

  // History = everything before the message we just pushed
  const historyBeforeAssistant = chat.messages.slice(0, -1);

  let assistantContent: string;
  let errorCode: string | undefined;

  try {
    const systemPrompt = await buildSystemPrompt(tenantId, userRole);
    assistantContent = await generateAssistantReply(
      systemPrompt,
      historyBeforeAssistant,
      trimmed
    );
  } catch (err) {
    // Normalize to AppError with proper Gemini classification
    const appErr = err instanceof AppError ? err : classifyGeminiError(err);
    errorCode = appErr.code;

    // Only swallow "expected" AI failures — rethrow auth/DB errors
    const swallowable = new Set([
      "AI_NOT_CONFIGURED",
      "AI_GENERATION_FAILED",
      "AI_EMPTY_RESPONSE",
      "AI_QUOTA_EXCEEDED",
      "AI_SAFETY_BLOCK",
      "AI_NETWORK_ERROR",
      "AI_MODEL_NOT_FOUND",
    ]);

    if (!swallowable.has(appErr.code)) {
      throw appErr;  // e.g. CHAT_NOT_FOUND, DB errors — don't swallow
    }

    assistantContent = friendlyUnavailableMessage(errorCode);
  }

  const assistantMsg: IChatMessage = {
    role: "assistant",
    content: assistantContent,
    createdAt: new Date(),
  };

  chat.messages.push(assistantMsg);
  await chat.save();

  return {
    chat: serializeChat(chat),
    userMessage: {
      role: userMsg.role,
      content: userMsg.content,
      createdAt: userMsg.createdAt.toISOString(),
    },
    assistantMessage: {
      role: assistantMsg.role,
      content: assistantMsg.content,
      createdAt: assistantMsg.createdAt.toISOString(),
    },
  };
}