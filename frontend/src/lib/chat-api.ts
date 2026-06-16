import { apiFetch } from "./api";

export interface ChatMeta {
  _id: string;
  title: string;
  updatedAt: string;
}

export interface ChatMessage {
  _id?: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface Chat extends ChatMeta {
  messages: ChatMessage[];
}

export interface SendMessageResult {
  chat: Chat;
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
}

export async function listChats(): Promise<ChatMeta[]> {
  const res = await apiFetch<{ chats: ChatMeta[] }>("/ai/chats");
  return res.chats;
}

export async function createChat(title?: string): Promise<ChatMeta> {
  const res = await apiFetch<{ chat: ChatMeta }>("/ai/chats", {
    method: "POST",
    body: JSON.stringify({ title }),
  });
  return res.chat;
}

export async function getChat(chatId: string): Promise<Chat> {
  const res = await apiFetch<{ chat: Chat }>(`/ai/chats/${chatId}`);
  return res.chat;
}

export async function deleteChat(chatId: string): Promise<void> {
  await apiFetch(`/ai/chats/${chatId}`, { method: "DELETE" });
}

export async function sendMessage(
  chatId: string,
  content: string
): Promise<SendMessageResult> {
  const res = await apiFetch<{ chat: Chat; userMessage: ChatMessage; assistantMessage: ChatMessage }>(
    `/ai/chats/${chatId}/messages`,
    {
      method: "POST",
      body: JSON.stringify({ content }),
    }
  );
  return res;
}