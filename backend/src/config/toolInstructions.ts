// src/config/toolInstructions.ts
//
// Single source of truth for how each CallTool is described to the realtime
// model. One label + one behavioural instruction per tool — nothing else.
//
// promptBuilder.ts reads this to render a "TOOLS AVAILABLE" block. No other
// file should hardcode tool-specific prompt text; add a new tool here and
// the prompt picks it up automatically via ResolvedCallContext.enabledTools.

import type { CallTool } from "../types/callRequest";

interface ToolInstruction {
  /** Short label shown in the "TOOLS AVAILABLE" list. */
  label: string;
  /** One sentence telling the model exactly when/how to use this tool. */
  instruction: string;
}

const TOOL_INSTRUCTIONS: Record<CallTool, ToolInstruction> = {
  appointment_booking: {
    label: "Appointment booking",
    instruction: "If the recipient confirms a slot, complete the booking immediately rather than just noting it.",
  },
  crm_update: {
    label: "CRM update",
    instruction: "Treat every confirmed detail as data to be logged — be precise and unambiguous when stating it back.",
  },
  human_transfer: {
    label: "Human transfer",
    instruction: "If the recipient asks for a human, or the conversation cannot progress, transfer the call instead of continuing to push the objective.",
  },
  whatsapp_followup: {
    label: "WhatsApp follow-up",
    instruction: "If a follow-up message would help (directions, confirmation, documents), offer to send it on WhatsApp and confirm the number.",
  },
  callback_schedule: {
    label: "Callback scheduling",
    instruction: "If the recipient cannot continue now, schedule a specific callback time before ending the call.",
  },
  post_call_extraction: {
    label: "Post-call extraction",
    instruction: "Speak in clear, complete statements when confirming outcomes — the call will be analysed afterward.",
  },
};

/** Returns the tool instruction entry for a single tool, if known. */
export function getToolInstruction(tool: CallTool): ToolInstruction | undefined {
  return TOOL_INSTRUCTIONS[tool];
}

/** Returns label + instruction pairs for a list of enabled tools, in order, skipping unknown tools. */
export function getToolInstructions(tools: CallTool[] | undefined): ToolInstruction[] {
  if (!tools || tools.length === 0) return [];
  return tools
    .map((t) => TOOL_INSTRUCTIONS[t])
    .filter((t): t is ToolInstruction => Boolean(t));
}
