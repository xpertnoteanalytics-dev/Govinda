// src/index.ts
//
// The GuideResolver passed to createRealtimeBridge() is the ONLY place where
// the two layers are wired together:
//   1. MongoDB lookup  (Call model)
//   2. Prompt rendering  (promptBuilder.buildRealtimePrompt)
//
// RealtimeBridge receives only the final rendered string and has no
// knowledge of either layer.
//
// ── Integration note (extraction engine) ──────────────────────────────────
// On WS close, the call has fully ended. The accumulated transcript
// (bridge.getTranscript()) plus the same Call document already looked up
// for the GuideResolver are handed to extractionTrigger.runForCall(), which
// fires runExtraction() → dispatchExtraction() without blocking the close
// handler. PromptBuilder, RealtimeBridge's audio/session logic, and
// CallRequest are all untouched — this only adds one fire-and-forget call
// at the point the call is already torn down.

import { createApp } from "./app";
import { connectDatabase, disconnectDatabase } from "./config/database";
import { env } from "./config/env";
import { WebSocketServer } from "ws";
import type { RawData } from "ws";
import type { IncomingMessage } from "http";
import type { Socket } from "net";
import { createRealtimeBridge } from "./services/realtimeBridge";
import { Call } from "./models";
import { buildRealtimePrompt, buildFallbackPrompt } from "./services/promptBuilder";
import { runForCall } from "./services/extractionTrigger";
import type { ResolvedCallContext } from "./types/callRequest";

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

    // Tracks the callSid this socket resolved to, so the close handler
    // below can look the Call document up again for extraction without
    // needing the GuideResolver to expose anything new.
    let resolvedCallSid: string | undefined;

    /**
     * GuideResolver — called by RealtimeBridge once it has the callSid.
     *
     * Steps:
     *   1. Look up the Call document in MongoDB by exotelCallSid.
     *   2. Build a ResolvedCallContext directly from the stored fields.
     *   3. Render it with promptBuilder.buildRealtimePrompt().
     *   4. If nothing is found: return undefined → bridge uses its own fallback.
     */
    const bridge = createRealtimeBridge(ws, async (callSid: string) => {
      resolvedCallSid = callSid;
      try {
        const doc = await Call.findOne({ exotelCallSid: callSid })
          .select(
            "placeName category organizationName objectiveType customObjectiveText businessContext notes enabledTools phoneNumber"
          )
          .lean();

        if (!doc) {
          console.warn("[ws] no Call document found for callSid:", callSid);
          return buildFallbackPrompt();
        }

        const ctx: ResolvedCallContext = {
          aiIdentity: "Govinda",
          organizationName: doc.organizationName,
          recipientName: doc.placeName,
          recipientCategory: doc.category,
          objectiveType: doc.objectiveType,
          customObjectiveText: doc.customObjectiveText,
          businessContext: doc.businessContext,
          notes: doc.notes,
          enabledTools: doc.enabledTools,
        };

        console.log(
          "[ws] call context resolved for callSid:", callSid,
          "| objective:", ctx.objectiveType
        );

        return buildRealtimePrompt(ctx);
      } catch (err) {
        console.error(
          "[ws] context resolution error for callSid:", callSid,
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

      // Trigger extraction BEFORE destroy() — getTranscript() reads from
      // the bridge's still-live closure state. destroy() only tears down
      // the OpenAI socket/session flags, so ordering here doesn't risk
      // losing transcript data, but doing it first is the more obviously
      // correct order to read from a thing before discarding it.
      triggerCallExtraction(resolvedCallSid, bridge.getTranscript());

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
 * Fire-and-forget extraction trigger for a finished phone call.
 *
 * Looks the Call document up by callSid one more time (cheap — single
 * indexed find) to get tenantId, objectiveType, enabledTools, and the
 * recipient's phone number, none of which the WS close handler otherwise
 * has on hand. Does not await — never blocks WS teardown.
 */
function triggerCallExtraction(callSid: string | undefined, transcript: string): void {
  if (!callSid) {
    console.warn("[ws] call ended with no resolved callSid — skipping extraction");
    return;
  }
  if (!transcript.trim()) {
    console.log("[ws] call ended with empty transcript — skipping extraction for callSid:", callSid);
    return;
  }

  void Call.findOne({ exotelCallSid: callSid })
    .select("tenantId objectiveType enabledTools phoneNumber")
    .lean()
    .then((doc) => {
      if (!doc) {
        console.warn("[ws] no Call document found for extraction, callSid:", callSid);
        return;
      }
      runForCall({
        tenantId: doc.tenantId.toString(),
        callId: doc._id.toString(),
        transcript,
        objectiveType: doc.objectiveType,
        enabledTools: doc.enabledTools,
        recipientPhone: doc.phoneNumber,
      });
    })
    .catch((err) => {
      console.error(
        "[ws] failed to look up Call for extraction, callSid:", callSid,
        "|", err instanceof Error ? err.message : err
      );
    });
}

bootstrap().catch((err) => {
  console.error("[api] failed to start:", err);
  process.exit(1);
});
