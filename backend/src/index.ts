// src/index.ts
//
// The GuideResolver passed to createRealtimeBridge() is the ONLY place where
// the three layers are wired together:
//   1. MongoDB lookup  (existing Call model — unchanged)
//   2. Guide deserialisation  (conversationGuideService.deserializeGuide)
//   3. Prompt rendering  (promptBuilder.buildRealtimePrompt)
//
// RealtimeBridge receives only the final rendered string and has no
// knowledge of any of these layers.

import { createApp } from "./app";
import { connectDatabase, disconnectDatabase } from "./config/database";
import { env } from "./config/env";
import { WebSocketServer } from "ws";
import type { RawData } from "ws";
import type { IncomingMessage } from "http";
import type { Socket } from "net";
import { createRealtimeBridge } from "./services/realtimeBridge";
import { Call } from "./models";
import { deserializeGuide } from "./services/conversationGuideService";
import { buildRealtimePrompt, buildFallbackPrompt } from "./services/promptBuilder";

async function bootstrap() {
  await connectDatabase();
  const app = createApp();
  const server = app.listen(env.port, () => {
    console.log(`[api] Govinda AI API running on port ${env.port}`);
    if (env.nodeEnv === "production") {
      setInterval(() => {
        fetch(`http://localhost:${env.port}/api/health`).catch(() => undefined);
      }, 10 * 60 * 1000);
    }
  });

  console.log(
    "[ws] OpenAI key present:",
    env.openai.apiKey ? `yes (len=${env.openai.apiKey.length})` : "NO — KEY IS EMPTY"
  );

  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req: IncomingMessage, socket: Socket, head: Buffer) => {
    const pathname = req.url ?? "";
    console.log("[ws] upgrade request for:", pathname);
    if (pathname === "/ws") {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on("connection", (ws, req) => {
    console.log("[ws] Exotel voicebot connected from", req.socket.remoteAddress);

    /**
     * GuideResolver — called by RealtimeBridge once it has the callSid.
     *
     * Steps:
     *   1. Look up the Call document in MongoDB by exotelCallSid.
     *   2. Attempt to deserialise the stored `script` field as a ConversationGuide.
     *      (New calls store JSON. Legacy calls may store plain-text scripts.)
     *   3. If a valid guide is found: render it with promptBuilder.
     *   4. If the stored value is plain-text (legacy): treat it as fallback context
     *      and render a minimal prompt wrapping it.
     *   5. If nothing is found: return undefined → bridge uses its own fallback.
     */
    const bridge = createRealtimeBridge(ws, async (callSid: string) => {
      try {
        const doc = await Call.findOne({ exotelCallSid: callSid })
          .select("script placeName category scriptType")
          .lean();

        if (!doc) {
          console.warn("[ws] no Call document found for callSid:", callSid);
          return buildFallbackPrompt();
        }

        if (!doc.script) {
          console.warn("[ws] Call document has no script for callSid:", callSid);
          return buildFallbackPrompt();
        }

        // Attempt to parse as ConversationGuide JSON (new format)
        const guide = deserializeGuide(doc.script);

        if (guide) {
          // New format: render the guide into a full prompt
          console.log(
            "[ws] ConversationGuide found for callSid:", callSid,
            "| objective:", guide.callObjective.slice(0, 80)
          );
          return buildRealtimePrompt(guide);
        }

        // Legacy format: the stored value is a plain-text script.
        // Wrap it in a minimal prompt that instructs the model to reason
        // over it rather than read it, preserving backward compatibility.
        console.log(
          "[ws] legacy plain-text script found for callSid:", callSid,
          "| length:", doc.script.length,
          "— wrapping in legacy prompt"
        );
        return buildLegacyScriptPrompt(doc.script, doc.placeName, doc.category);
      } catch (err) {
        console.error(
          "[ws] guide resolution error for callSid:", callSid,
          "|", err instanceof Error ? err.message : err
        );
        return buildFallbackPrompt();
      }
    });

    ws.on("message", (message: RawData) => {
      const raw = message.toString();

      try {
        const parsed = JSON.parse(raw) as { event?: string };
        if (parsed.event && parsed.event !== "media") {
          console.log("[ws] non-media event received:", raw.slice(0, 500));
        }
      } catch {
        // not JSON — ignore
      }

      bridge.handleExotelMessage(raw);
    });

    ws.on("close", (code, reason) => {
      console.log("[ws] Exotel disconnected", code, reason.toString());
      bridge.destroy();
    });

    ws.on("error", (err) => {
      console.error("[ws] error", err.message);
      bridge.destroy();
    });
  });

  const shutdown = async (signal: string) => {
    console.log(`[api] ${signal} received, shutting down...`);
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

/**
 * Legacy compatibility: wrap a plain-text script in a prompt that tells
 * the model to reason over it, not recite it. This handles all existing
 * Call documents created before the ConversationGuide architecture.
 *
 * Once all existing calls are migrated (or expired), this can be removed.
 */
function buildLegacyScriptPrompt(
  script: string,
  placeName: string,
  category?: string
): string {
  return `
You are a professional healthcare executive from Govinda AI making a phone call.
You are calling: ${placeName}${category ? ` (${category})` : ""}.
You sound completely human. You never sound scripted. You think and reason.

Below is background knowledge about this call.
This is NOT a script. Do NOT read it word-for-word.
Read it to understand the purpose and talking points.
Then speak naturally as a human executive would.

BACKGROUND KNOWLEDGE:
${script}

RULES:
• Speak one thought at a time. Ask one question at a time. Then stop and listen.
• Never continue speaking while the customer is talking.
• If interrupted, stop immediately and listen.
• Mirror the customer's language (English / Hindi / Hinglish).
• Never switch to Chinese, Japanese, Korean, or any unrelated language.
• Keep every response to 2–3 sentences maximum.
• Return to the call objective after answering any side questions.
• Never invent medical facts, pricing, or policies.
`.trim();
}

bootstrap().catch((err) => {
  console.error("[api] failed to start:", err);
  process.exit(1);
});
