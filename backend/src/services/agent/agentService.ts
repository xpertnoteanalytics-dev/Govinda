import OpenAI from "openai";
import { env } from "../../config/env";
import { AppError } from "../../utils/AppError";
import { Tenant } from "../../models";
import { resolveObjectIdString } from "../../utils/resolveId";
import * as memoryService from "../memoryService";
import type { Role } from "../../types/roles";
import type { AgentContext } from "./agentContext";
import { OPENAI_TOOL_DEFINITIONS, executeAgentTool } from "./agentTools";

const AGENT_BASE_PROMPT = `You are Govinda AI — a production healthcare operations employee embedded in a multi-tenant SaaS platform.

You behave like a real operations specialist: proactive, structured, and tool-driven.

Capabilities (use tools automatically when helpful):
- Search hospitals, pharmacies, clinics, diagnostic centers, medical labs, blood banks, schools, colleges, universities, NGOs, government offices, and other nearby services using your city or current location.
- Generate calling scripts for outreach
- Initiate outbound calls via Exotel when the user requests a call
- Generate and send professional outreach emails to facilities
- Generate and send WhatsApp messages (or open-chat deep links)
- Recall search history, call, email, and WhatsApp analytics
- Save and retrieve persistent operational memory

Rules:
- Never diagnose patients or prescribe medication
- Protect privacy; minimize PHI
- When search results are returned, summarize top options with distance and open status
- When generating scripts, keep them professional and concise
- Confirm before initiating calls unless the user explicitly asked to call now
- Use markdown for clarity`;

function getOpenAI(): OpenAI {
  if (!env.openai.apiKey) {
    throw new AppError(
      503,
      "AI agent is not configured. Set OPENAI_API_KEY.",
      "OPENAI_NOT_CONFIGURED"
    );
  }
  return new OpenAI({ apiKey: env.openai.apiKey });
}

export function isAgentEnabled(): boolean {
  return env.ai.provider === "openai" && Boolean(env.openai.apiKey);
}

function isOpenAIQuotaError(err: unknown): boolean {
  const anyErr = err as { status?: number; code?: string; message?: string };
  if (anyErr?.status === 429) return true;
  if (anyErr?.code === "insufficient_quota") return true;
  const msg = (anyErr?.message ?? "").toLowerCase();
  return msg.includes("quota") || msg.includes("rate limit") || msg.includes("429");
}

export async function buildAgentSystemPrompt(
  tenantId: string,
  userRole: Role
): Promise<string> {
  const tenant = await Tenant.findById(
    resolveObjectIdString(tenantId, "tenantId")
  ).select("name plan settings");

  const parts = [AGENT_BASE_PROMPT];
  if (tenant) {
    parts.push(
      `\nOrganization: ${tenant.name}`,
      `Plan: ${tenant.plan}`,
      `User role: ${userRole.replace(/_/g, " ")}`
    );
    if (tenant.settings?.aiSystemPrompt?.trim()) {
      parts.push(`\nTenant instructions:\n${tenant.settings.aiSystemPrompt.trim()}`);
    }
  }

  return parts.join("\n");
}

export async function runAgentConversation(params: {
  tenantId: string;
  userId: string;
  userRole: Role;
  messages: { role: "user" | "assistant"; content: string }[];
}): Promise<{ content: string; toolsUsed: string[] }> {
  const client = getOpenAI();
  const systemPrompt = await buildAgentSystemPrompt(params.tenantId, params.userRole);
  const memories = await memoryService.getMemories(params.tenantId, params.userId, 15);
  const memoryBlock = memoryService.formatMemoriesForPrompt(memories);

  const tenant = await Tenant.findById(
    resolveObjectIdString(params.tenantId, "tenantId")
  ).select("name");

  const ctx: AgentContext = {
    tenantId: params.tenantId,
    userId: params.userId,
    userRole: params.userRole,
    organizationName: tenant?.name,
  };

  const openaiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt + memoryBlock },
    ...params.messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  const toolsUsed: string[] = [];
  const maxTurns = 6;

  for (let turn = 0; turn < maxTurns; turn++) {
    let response: OpenAI.Chat.Completions.ChatCompletion;
    try {
      response = await client.chat.completions.create({
        model: env.openai.model,
        messages: openaiMessages,
        tools: OPENAI_TOOL_DEFINITIONS,
        tool_choice: "auto",
      });
    } catch (err) {
      if (isOpenAIQuotaError(err)) {
        throw new AppError(
          429,
          "OpenAI quota exceeded. Falling back to Gemini.",
          "OPENAI_QUOTA_EXCEEDED"
        );
      }
      const msg = err instanceof Error ? err.message : "OpenAI request failed";
      throw new AppError(502, msg, "OPENAI_FAILED");
    }

    const choice = response.choices[0]?.message;
    if (!choice) {
      throw new AppError(502, "Empty agent response", "AGENT_EMPTY");
    }

    if (choice.tool_calls?.length) {
      openaiMessages.push(choice);

      for (const toolCall of choice.tool_calls) {
        if (toolCall.type !== "function") continue;
        const name = toolCall.function.name;
        toolsUsed.push(name);

        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(toolCall.function.arguments || "{}") as Record<
            string,
            unknown
          >;
        } catch {
          args = {};
        }

        const result = await executeAgentTool(name, args, ctx);
        openaiMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: result,
        });
      }
      continue;
    }

    const text = choice.content?.trim();
    if (!text) {
      throw new AppError(502, "Empty agent response", "AGENT_EMPTY");
    }

    return { content: text, toolsUsed };
  }

  throw new AppError(502, "Agent exceeded tool turn limit", "AGENT_MAX_TURNS");
}
