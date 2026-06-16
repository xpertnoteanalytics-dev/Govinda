import { GoogleGenerativeAI } from "@google/generative-ai";
import { Chat, Tenant } from "../models";
import type { IChat, IChatMessage } from "../models/Chat";
import { Appointment } from "../models/Appointment";
import { Feedback } from "../models/Feedback";
import { env } from "../config/env";
import { AppError } from "../utils/AppError";
import { AI_TOOLS, type CreateAppointmentArgs, type CreateFeedbackArgs } from "./geminiTools";

const genAI = new GoogleGenerativeAI(env.gemini.apiKey);

const BASE_SYSTEM_PROMPT = `
You are Govinda AI, an intelligent healthcare operations assistant.
You help patients and staff with appointment booking and submitting feedback.

## YOUR PERSONALITY
- Warm, professional, and clear
- Never robotic — vary your language naturally
- Always confirm what you heard before acting
- Keep responses concise unless the user asks for detail

## INTENT RECOGNITION RULES
- User says "appointment" alone → ask: "Sure! Would you like to book a new appointment, reschedule, or check an existing one?"
- User says "book appointment" or "schedule appointment" → begin collecting required fields one at a time
- User says "feedback" alone → ask: "Happy to help! Are you sharing feedback about a visit, or would you like to check previously submitted feedback?"
- User says "give feedback" or "submit feedback" → begin collecting the feedback details

## APPOINTMENT BOOKING WORKFLOW
Required fields (collect them conversationally, one or two at a time):
1. Patient full name
2. Phone number
3. Service or test needed
4. Preferred date
5. Preferred time

Rules:
- Never assume or invent field values
- If the user gives multiple fields in one message, acknowledge all of them and ask only for what's still missing
- Once all 5 fields are collected, show a SUMMARY and ask for confirmation:
  "Here's what I have:
  • Name: [name]
  • Phone: [phone]
  • Service: [service]
  • Date: [date]
  • Time: [time]
  Shall I go ahead and book this? (Yes / No)"
- Call the create_appointment tool ONLY after the user replies with "yes", "confirm", "go ahead", or similar
- Never call create_appointment without explicit confirmation

## FEEDBACK WORKFLOW
Required fields:
1. The feedback message itself
2. Sentiment (positive / negative / neutral — you can infer this, but confirm if unsure)
3. Patient name (optional — if not given, proceed without it)

Rules:
- Once you have the feedback text, show a summary and ask for confirmation before saving
- Call the create_feedback tool ONLY after confirmation
- Never silently save feedback

## ACTION TRANSPARENCY
- After a successful create_appointment call → confirm with: "✅ Your appointment has been booked! [summary]"
- After a failed create_appointment call → say: "❌ I wasn't able to book the appointment due to a technical issue. Please try again or contact the reception desk."
- After a successful create_feedback call → confirm with: "✅ Your feedback has been recorded. Thank you!"
- After a failed create_feedback call → say: "❌ There was a problem saving your feedback. Please try again."

## WHAT YOU CANNOT DO
- You cannot look up existing appointments or patient records
- You cannot cancel or reschedule appointments
- You cannot answer medical questions or give clinical advice
- For anything outside your scope, politely explain and suggest contacting staff directly

## ORGANIZATION
You are deployed for: {ORG_NAME}
Refer to the organization by this name when relevant (e.g. "at {ORG_NAME}").
`.trim();

function buildSystemPrompt(orgName: string, customPrompt?: string): string {
  const base = BASE_SYSTEM_PROMPT.replaceAll("{ORG_NAME}", orgName);
  if (customPrompt?.trim()) {
    return `${base}\n\n## ADDITIONAL INSTRUCTIONS FROM ${orgName.toUpperCase()}\n${customPrompt.trim()}`;
  }
  return base;
}

async function executeCreateAppointment(
  args: CreateAppointmentArgs,
  tenantId: string
): Promise<{ success: boolean; message: string; data?: Record<string, unknown> }> {
  try {
    const doc = await Appointment.create({
      tenantId,
      patientName: args.patientName,
      phone: args.phone,
      service: args.service,
      appointmentDate: args.appointmentDate,
      appointmentTime: args.appointmentTime,
      notes: args.notes ?? "",
      source: "ai_chat",
    });

    return {
      success: true,
      message: "Appointment created successfully.",
      data: {
        id: (doc as { _id: unknown })._id,
        patientName: args.patientName,
        phone: args.phone,
        service: args.service,
        appointmentDate: args.appointmentDate,
        appointmentTime: args.appointmentTime,
      },
    };
  } catch (err) {
    console.error("[aiService] create_appointment failed:", err);
    return { success: false, message: "Database error while creating appointment." };
  }
}

async function executeCreateFeedback(
  args: CreateFeedbackArgs,
  tenantId: string
): Promise<{ success: boolean; message: string }> {
  try {
    await Feedback.create({
      tenantId,
      patientName: args.patientName ?? undefined,
      feedback: args.feedback,
      sentiment: args.sentiment,
      source: "ai_chat",
    });

    return { success: true, message: "Feedback saved successfully." };
  } catch (err) {
    console.error("[aiService] create_feedback failed:", err);
    return { success: false, message: "Database error while saving feedback." };
  }
}

export async function sendMessage(
  chatId: string,
  tenantId: string,
  userId: string,
  userRole: string,
  userContent: string
): Promise<{
  chat: IChat;
  userMessage: IChatMessage;
  assistantMessage: IChatMessage;
}> {
  const chat = await Chat.findOne({ _id: chatId, tenantId, userId });
  if (!chat) throw new AppError(404, "Chat not found");

  const tenant = await Tenant.findById(tenantId).lean();
  const orgName = (tenant as { name?: string } | null)?.name ?? "your organization";
  const customPrompt = (tenant as { settings?: { aiSystemPrompt?: string } } | null)?.settings?.aiSystemPrompt;
  const systemPrompt = buildSystemPrompt(orgName, customPrompt);

  const trimmed = userContent.trim();
  const userMsg: IChatMessage = {
    role: "user",
    content: trimmed,
    createdAt: new Date(),
  } as IChatMessage;
  chat.messages.push(userMsg);

  const historyForGemini = chat.messages
    .slice(0, -1)
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  const model = genAI.getGenerativeModel({
    model: env.gemini.model,
    systemInstruction: { role: "system", parts: [{ text: systemPrompt }] },
    tools: AI_TOOLS,
  });

  const geminiChat = model.startChat({ history: historyForGemini });

  let assistantContent = "";
  let retries = 0;

  while (retries < 3) {
    try {
      const result = await geminiChat.sendMessage(trimmed);
      const response = result.response;
      const candidate = response.candidates?.[0];

      if (!candidate) {
        assistantContent = "I'm sorry, I couldn't generate a response. Please try again.";
        break;
      }

      const functionCall = candidate.content?.parts?.find((p) => p.functionCall);

      if (functionCall?.functionCall) {
        const { name, args } = functionCall.functionCall;
        let toolResult: { success: boolean; message: string; data?: Record<string, unknown> };

        if (name === "create_appointment") {
          toolResult = await executeCreateAppointment(
            args as unknown as CreateAppointmentArgs,
            tenantId
          );
        } else if (name === "create_feedback") {
          toolResult = await executeCreateFeedback(
            args as unknown as CreateFeedbackArgs,
            tenantId
          );
        } else {
          toolResult = { success: false, message: `Unknown tool: ${name}` };
        }

        const toolResponse = await geminiChat.sendMessage([
          {
            functionResponse: {
              name,
              response: toolResult,
            },
          },
        ]);

        assistantContent =
          toolResponse.response.text() ||
          (toolResult.success
            ? "✅ Done! Is there anything else I can help you with?"
            : "❌ Something went wrong. Please try again.");
      } else {
        assistantContent = response.text();
      }

      break;
    } catch (err: unknown) {
      retries++;
      if (retries >= 3) {
        console.error("[aiService] Gemini failed after 3 retries:", err);
        assistantContent = "I'm experiencing a technical issue. Please try again in a moment.";
      } else {
        await new Promise((r) => setTimeout(r, 2000 * retries));
      }
    }
  }

  const assistantMsg: IChatMessage = {
    role: "assistant",
    content: assistantContent,
    createdAt: new Date(),
  } as IChatMessage;
  chat.messages.push(assistantMsg);

  if (chat.messages.length === 2 && (!chat.title || chat.title === "New Chat")) {
    chat.title = trimmed.slice(0, 60) + (trimmed.length > 60 ? "…" : "");
  }

  await chat.save();

  return {
    chat,
    userMessage: userMsg,
    assistantMessage: assistantMsg,
  };
}

export async function listChats(tenantId: string, userId: string) {
  return Chat.find({ tenantId, userId })
    .sort({ updatedAt: -1 })
    .select("_id title updatedAt")
    .lean();
}

export async function createChat(tenantId: string, userId: string, title?: string) {
  return Chat.create({ tenantId, userId, title: title?.trim() || "New Chat", messages: [] });
}

export async function getChat(chatId: string, tenantId: string, userId: string) {
  const chat = await Chat.findOne({ _id: chatId, tenantId, userId });
  if (!chat) throw new AppError(404, "Chat not found");
  return chat;
}

export async function deleteChat(chatId: string, tenantId: string, userId: string) {
  const result = await Chat.deleteOne({ _id: chatId, tenantId, userId });
  if (result.deletedCount === 0) throw new AppError(404, "Chat not found");
}