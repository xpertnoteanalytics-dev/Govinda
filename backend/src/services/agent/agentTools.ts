import type OpenAI from "openai";
import * as mapsService from "../mapsService";
import * as callService from "../callService";
import * as emailService from "../emailService";
import * as whatsappService from "../whatsappService";
import * as memoryService from "../memoryService";
import type { OutreachType } from "../../types/outreach";
import type { PlaceCategory } from "../../types/places";
import type { AgentContext } from "./agentContext";

export const OPENAI_TOOL_DEFINITIONS: OpenAI.Chat.Completions.ChatCompletionTool[] =
  [
    {
      type: "function",
      function: {
        name: "search_healthcare_places",
        description:
          "Search nearby pharmacies, hospitals, NGOs, or polyclinics using Google Maps.",
        parameters: {
          type: "object",
          properties: {
            category: {
              type: "string",
              enum: ["pharmacy", "hospital", "ngo", "polyclinic"],
            },
            lat: { type: "number" },
            lng: { type: "number" },
            city: { type: "string" },
            radius: { type: "number", description: "Meters, 500-50000" },
          },
          required: ["category"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "generate_calling_script",
        description:
          "Generate a professional healthcare outreach calling script (pharmacy, appointment, or coordination).",
        parameters: {
          type: "object",
          properties: {
            placeName: { type: "string" },
            category: { type: "string" },
            purpose: { type: "string" },
            scriptType: {
              type: "string",
              enum: [
                "pharmacy_inquiry",
                "appointment_scheduling",
                "healthcare_coordination",
              ],
              description: "Kind of script to generate",
            },
          },
          required: ["placeName", "category"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "initiate_phone_call",
        description:
          "Initiate an outbound Exotel two-leg call: staff/agent phone is dialed first, then the facility. Use after searching places or generating a script. Pass agentPhone if EXOTEL_FROM_NUMBER is not set server-side.",
        parameters: {
          type: "object",
          properties: {
            placeName: { type: "string" },
            phoneNumber: { type: "string" },
            category: { type: "string" },
            placeId: { type: "string" },
            script: { type: "string" },
            scriptType: {
              type: "string",
              enum: [
                "pharmacy_inquiry",
                "appointment_scheduling",
                "healthcare_coordination",
              ],
            },
            agentPhone: {
              type: "string",
              description:
                "Staff phone Exotel dials first (From leg). Required if org has no EXOTEL_FROM_NUMBER.",
            },
          },
          required: ["placeName", "phoneNumber"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_search_history",
        description: "Retrieve recent healthcare place searches for this user.",
        parameters: { type: "object", properties: {} },
      },
    },
    {
      type: "function",
      function: {
        name: "get_call_analytics",
        description: "Get call volume and success metrics for this user.",
        parameters: { type: "object", properties: {} },
      },
    },
    {
      type: "function",
      function: {
        name: "generate_outreach_email",
        description:
          "Generate a professional healthcare outreach email draft (subject + body) for a facility.",
        parameters: {
          type: "object",
          properties: {
            placeName: { type: "string" },
            category: { type: "string" },
            purpose: { type: "string" },
            outreachType: {
              type: "string",
              enum: [
                "pharmacy_inquiry",
                "appointment_scheduling",
                "healthcare_coordination",
                "partnership_outreach",
                "follow_up",
              ],
            },
          },
          required: ["placeName", "category"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "send_outreach_email",
        description: "Send an outreach email to a healthcare facility.",
        parameters: {
          type: "object",
          properties: {
            placeName: { type: "string" },
            toEmail: { type: "string" },
            subject: { type: "string" },
            body: { type: "string" },
            category: { type: "string" },
            placeId: { type: "string" },
            outreachType: { type: "string" },
          },
          required: ["placeName", "toEmail", "subject", "body"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "generate_whatsapp_message",
        description:
          "Generate a WhatsApp outreach message for healthcare facility coordination.",
        parameters: {
          type: "object",
          properties: {
            placeName: { type: "string" },
            category: { type: "string" },
            purpose: { type: "string" },
            outreachType: { type: "string" },
          },
          required: ["placeName", "category"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "send_whatsapp_message",
        description:
          "Send WhatsApp outreach via configured provider, or log + deep link when openChatOnly is true.",
        parameters: {
          type: "object",
          properties: {
            placeName: { type: "string" },
            phoneNumber: { type: "string" },
            message: { type: "string" },
            category: { type: "string" },
            placeId: { type: "string" },
            outreachType: { type: "string" },
            openChatOnly: { type: "boolean" },
          },
          required: ["placeName", "phoneNumber", "message"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_outreach_analytics",
        description:
          "Get combined email, WhatsApp, and call outreach metrics for this user.",
        parameters: { type: "object", properties: {} },
      },
    },
    {
      type: "function",
      function: {
        name: "save_memory",
        description: "Persist an operational note for future conversations.",
        parameters: {
          type: "object",
          properties: {
            key: { type: "string" },
            value: { type: "string" },
            category: { type: "string" },
          },
          required: ["key", "value"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_memories",
        description: "Load persistent operational memories for this user.",
        parameters: { type: "object", properties: {} },
      },
    },
  ];

export async function executeAgentTool(
  name: string,
  args: Record<string, unknown>,
  ctx: AgentContext
): Promise<string> {
  switch (name) {
    case "search_healthcare_places": {
      const data = await mapsService.searchPlaces({
        category: args.category as PlaceCategory,
        lat: args.lat as number | undefined,
        lng: args.lng as number | undefined,
        city: args.city as string | undefined,
        radius: Number(args.radius) || 5000,
      });
      await mapsService.recordSearchHistory(
        ctx.tenantId,
        ctx.userId,
        {
          category: data.category,
          lat: data.location.lat,
          lng: data.location.lng,
          radius: data.radius,
          city: args.city as string | undefined,
        },
        data
      );
      return JSON.stringify({
        location: data.location,
        resultCount: data.resultCount,
        results: data.results.slice(0, 8).map((r) => ({
          name: r.name,
          address: r.address,
          phone: r.phone,
          rating: r.rating,
          isOpen: r.isOpen,
          distanceMeters: r.distanceMeters,
          directionsUrl: r.directionsUrl,
        })),
      });
    }
    case "generate_calling_script": {
      const script = await callService.generateCallingScript({
        placeName: String(args.placeName),
        category: String(args.category),
        purpose: args.purpose as string | undefined,
        organizationName: ctx.organizationName,
        scriptType: args.scriptType as
          | "pharmacy_inquiry"
          | "appointment_scheduling"
          | "healthcare_coordination"
          | undefined,
      });
      return JSON.stringify({ script });
    }
    case "initiate_phone_call": {
      const call = await callService.initiateCall({
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        placeId: args.placeId as string | undefined,
        placeName: String(args.placeName),
        phoneNumber: String(args.phoneNumber),
        category: args.category as string | undefined,
        script: args.script as string | undefined,
        scriptType: args.scriptType as
          | "pharmacy_inquiry"
          | "appointment_scheduling"
          | "healthcare_coordination"
          | undefined,
        agentPhone: args.agentPhone as string | undefined,
      });
      return JSON.stringify(call);
    }
    case "get_search_history": {
      const history = await mapsService.listSearchHistory(ctx.tenantId, ctx.userId);
      return JSON.stringify(history.slice(0, 10));
    }
    case "get_call_analytics": {
      const analytics = await callService.getCallAnalytics(ctx.tenantId, ctx.userId);
      return JSON.stringify(analytics);
    }
    case "generate_outreach_email": {
      const draft = await emailService.generateEmailDraft({
        placeName: String(args.placeName),
        category: String(args.category),
        purpose: args.purpose as string | undefined,
        organizationName: ctx.organizationName,
        outreachType: args.outreachType as OutreachType | undefined,
      });
      return JSON.stringify(draft);
    }
    case "send_outreach_email": {
      const email = await emailService.sendOutreachEmail({
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        placeId: args.placeId as string | undefined,
        placeName: String(args.placeName),
        toEmail: String(args.toEmail),
        subject: String(args.subject),
        body: String(args.body),
        category: args.category as string | undefined,
        outreachType: args.outreachType as OutreachType | undefined,
      });
      return JSON.stringify(email);
    }
    case "generate_whatsapp_message": {
      const message = await whatsappService.generateWhatsAppDraft({
        placeName: String(args.placeName),
        category: String(args.category),
        purpose: args.purpose as string | undefined,
        organizationName: ctx.organizationName,
        outreachType: args.outreachType as OutreachType | undefined,
      });
      return JSON.stringify({ message });
    }
    case "send_whatsapp_message": {
      const result = await whatsappService.sendOutreachWhatsApp({
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        placeId: args.placeId as string | undefined,
        placeName: String(args.placeName),
        phoneNumber: String(args.phoneNumber),
        message: String(args.message),
        category: args.category as string | undefined,
        outreachType: args.outreachType as OutreachType | undefined,
        openChatOnly: args.openChatOnly === true,
      });
      return JSON.stringify(result);
    }
    case "get_outreach_analytics": {
      const [emails, whatsapp, calls] = await Promise.all([
        emailService.getEmailAnalytics(ctx.tenantId, ctx.userId),
        whatsappService.getWhatsAppAnalytics(ctx.tenantId, ctx.userId),
        callService.getCallAnalytics(ctx.tenantId, ctx.userId),
      ]);
      return JSON.stringify({ emails, whatsapp, calls });
    }
    case "save_memory": {
      const saved = await memoryService.saveMemory(
        ctx.tenantId,
        ctx.userId,
        String(args.key),
        String(args.value),
        args.category as string | undefined
      );
      return JSON.stringify(saved);
    }
    case "get_memories": {
      const memories = await memoryService.getMemories(ctx.tenantId, ctx.userId);
      return JSON.stringify(memories);
    }
    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}
