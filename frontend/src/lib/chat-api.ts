import { apiFetch } from "./api";

export interface ChatMessage {
  id?: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
}

export interface ChatSummary {
  id: string;
  title: string;
  preview: string;
  messageCount: number;
  updatedAt: string;
  createdAt: string;
}

export interface Chat {
  id: string;
  title: string;
  tenantId: string;
  userId: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export async function listChats(): Promise<ChatSummary[]> {
  const data = await apiFetch<{ chats: ChatSummary[] }>("/v1/ai/chats");
  return data.chats;
}

export async function createChat(title?: string): Promise<Chat> {
  const data = await apiFetch<{ chat: Chat }>("/v1/ai/chats", {
    method: "POST",
    body: JSON.stringify(title ? { title } : {}),
  });
  return data.chat;
}

export async function getChat(chatId: string): Promise<Chat> {
  const data = await apiFetch<{ chat: Chat }>(`/v1/ai/chats/${chatId}`);
  return data.chat;
}

export async function deleteChat(chatId: string): Promise<void> {
  await apiFetch(`/v1/ai/chats/${chatId}`, { method: "DELETE" });
}

export async function sendChatMessage(chatId: string, content: string) {
  return apiFetch<{
    chat: Chat;
    userMessage: ChatMessage;
    assistantMessage: ChatMessage;
  }>(`/v1/ai/chats/${chatId}/messages`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
}
