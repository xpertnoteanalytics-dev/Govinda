import { GoogleGenerativeAI } from "@google/generative-ai";
import { Chat, Tenant } from "../models";
import type { IChat, IChatMessage } from "../models/Chat";
import { env } from "../config/env";
import { AppError } from "../utils/AppError";
import { resolveObjectIdString } from "../utils/resolveId";
import type { Role } from "../types/roles";

const BASE_SYSTEM_PROMPT = `You are Govinda AI, an expert healthcare operations assistant embedded in a multi-tenant clinical SaaS platform.

Personality & tone:
- Professional, calm, and empathetic — like a trusted clinical operations advisor
- Clear, concise, and actionable; avoid unnecessary jargon
- Support clinicians, administrators, and staff with workflows, compliance awareness, and best practices

Guidelines:
- You assist with healthcare operations, workflows, documentation guidance, patient communication templates, scheduling, and general clinical admin — NOT direct diagnosis or prescribing
- Always remind users that clinical decisions require licensed professionals and local protocols
- Never fabricate patient data, lab results, or regulations; say when you are uncertain
- Format responses with markdown when helpful (headings, lists, tables)
- Protect privacy: do not ask for or store PHI in chat beyond what the user shares

Respond as a knowledgeable healthcare SaaS copilot for the user's organization.`;

function getGenAI() {
  if (!env.gemini.apiKey) {
    throw new AppError(
      503,
      "AI service is not configured. Set GEMINI_API_KEY in environment.",
      "AI_NOT_CONFIGURED"
    );
  }
  return new GoogleGenerativeAI(env.gemini.apiKey);
}

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

function formatMessage(msg: IChatMessage) {
  return {
    role: msg.role === "assistant" ? "model" : "user",
    parts: [{ text: msg.content }],
  };
}

async function generateAssistantReply(
  systemPrompt: string,
  history: IChatMessage[],
  userMessage: string
): Promise<string> {
  const genAI = getGenAI();
  const model = genAI.getGenerativeModel({
  model: env.gemini.model,
  systemInstruction: systemPrompt,
});
  const historyForGemini = history
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map(formatMessage);

  const chat = model.startChat({
    history: historyForGemini,
  });

    const result =
    await chat.sendMessage(

      `${systemPrompt}

  User message:
  ${userMessage}`
    );
  const text = result.response.text();

  if (!text?.trim()) {
    throw new AppError(502, "Empty response from AI model", "AI_EMPTY_RESPONSE");
  }

  return text.trim();
}

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

  if (!trimmed) {
    throw new AppError(400, "Message cannot be empty", "EMPTY_MESSAGE");
  }

  if (trimmed.length > 8000) {
    throw new AppError(400, "Message is too long", "MESSAGE_TOO_LONG");
  }

  const userMsg: IChatMessage = {
    role: "user",
    content: trimmed,
    createdAt: new Date(),
  };

  chat.messages.push(userMsg);

  if (chat.messages.length === 1 && chat.title === "New conversation") {
    chat.title = deriveTitle(trimmed);
  }

  const systemPrompt = await buildSystemPrompt(tenantId, userRole);
  const historyBeforeAssistant = chat.messages.slice(0, -1);

  let assistantContent: string;
  try {
    assistantContent = await generateAssistantReply(
      systemPrompt,
      historyBeforeAssistant,
      trimmed
    );
  } catch (err) {
    if (err instanceof AppError) throw err;
    const message = err instanceof Error ? err.message : "AI request failed";
    throw new AppError(502, message, "AI_GENERATION_FAILED");
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
