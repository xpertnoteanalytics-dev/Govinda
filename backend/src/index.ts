// src/index.ts
//
// resolveInstructions is the ONLY place where the two layers are wired
// together:
//   1. MongoDB lookup  (Call model)
//   2. Prompt rendering  (promptBuilder.buildRealtimePrompt)
//
// It is injected into RealtimeBridge through the constructor options.
// RealtimeBridge receives only the final rendered string and has no
// knowledge of either layer.
//
// ── callSid lifecycle note ──────────────────────────────────────────────
// RealtimeBridge connects to OpenAI immediately in its constructor, and
// needs callSid (for resolveInstructions, Exotel stream_sid, logging) at
// construction time. callSid is only known once Exotel's "start" event
// arrives on the WebSocket. So construction of RealtimeBridge is delayed
// until "start" is seen; any messages that arrive before that (in practice
// just the "connected" event) are buffered and replayed once the bridge
// exists — including the "start" message itself, so RealtimeBridge's own
// handleExotelMessage() still sees and logs it normally.
//
// ── Integration note (extraction engine) ──────────────────────────────────
// On WS close, the call has fully ended. The accumulated transcript
// (bridge.getTranscript()) plus a fresh Call document lookup are handed to
// extractionTrigger.runForCall(), which fires runExtraction() →
// dispatchExtraction() without blocking the close handler. PromptBuilder,
// RealtimeBridge's audio/session logic, and CallRequest are all
// untouched — this only adds one fire-and-forget call at the point the
// call is already torn down.
//
// ── Inbound/outbound note (2026-07-01) ─────────────────────────────────
// Outbound calls always have a pre-existing Call document (created by
// callService.initiateCall() before Exotel is ever dialed) — see
// models/Call.ts and callService.ts. Customer-initiated inbound calls
// have no such document today: nothing in this codebase creates a Call
// document for them, so the lookup below finds nothing.
//
// IMPORTANT CAVEAT, left in deliberately rather than silently resolved:
// this means the "no doc found" branch and the "lookup threw" (catch)
// branch are BOTH currently treated as inbound. That collapses two
// different situations — genuine inbound calls, and outbound calls whose
// lookup failed for an unrelated reason (DB hiccup, a race between the
// Exotel "start" event and Call.create() finishing, a bad
// exotelCallSid match) — into the same signal. If Exotel's start event
// (start.from / start.to / start.media_format, confirmed present in
// production logs) turns out to reliably distinguish inbound from
// outbound on its own, that should replace this doc-absence heuristic
// entirely. Until then, this is what was explicitly requested: thread
// direction into buildFallbackPrompt() rather than let promptBuilder.ts
// infer it, so the moment a better signal exists, only this function
// needs to change.
//
// ── callDirection wiring (2026-07-01) ────────────────────────────────────
// When a Call document IS found, its `direction` field is now copied onto
// ResolvedCallContext.callDirection before rendering, so promptBuilder's
// identityBlock() can pick the correct opening for genuinely-found docs
// too (today these are always "outbound" in practice, since inbound calls
// never have a pre-created doc — but this keeps the two layers correctly
// decoupled per the file-level note above, rather than promptBuilder ever
// guessing at direction on its own).

import { createApp } from "./app";
import { connectDatabase, disconnectDatabase } from "./config/database";
import { env } from "./config/env";
import { WebSocketServer } from "ws";
import type { RawData } from "ws";
import type { IncomingMessage } from "http";
import type { Socket } from "net";
import { RealtimeBridge } from "./services/realtimeBridge";
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
    // below can look the Call document up again for extraction.
    let resolvedCallSid: string | undefined;

    // RealtimeBridge requires callSid at construction time (it connects to
    // OpenAI immediately in its constructor). callSid is only known once
    // Exotel's "start" event arrives, so messages received before that
    // point are buffered here and replayed once the bridge exists.
    let bridge: RealtimeBridge | undefined;
    const preStartQueue: string[] = [];

    /**
     * resolveInstructions — passed into RealtimeBridge's constructor.
     * Called once, from the bridge's session.created handler, with the
     * callSid it was constructed with.
     *
     * Steps:
     *   1. Look up the Call document in MongoDB by exotelCallSid.
     *   2. Build a ResolvedCallContext directly from the stored fields,
     *      including direction.
     *   3. Render it with promptBuilder.buildRealtimePrompt().
     *   4. If nothing is found: this is an inbound call (no Call document
     *      is ever pre-created for inbound calls today) — render the
     *      inbound fallback prompt.
     *   5. If the lookup itself throws: also falls back to the inbound
     *      prompt today — see the file-level note above on why this is
     *      a known, deliberate simplification rather than a guess.
     */
    const resolveInstructions = async (callSid: string): Promise<string> => {
      try {
        const doc = await Call.findOne({ exotelCallSid: callSid })
          .select(
            "placeName category organizationName objectiveType customObjectiveText businessContext notes enabledTools phoneNumber direction"
          )
          .lean();

        if (!doc) {
          console.warn("[ws] no Call document found for callSid:", callSid, "— treating as inbound");
          return buildFallbackPrompt(undefined, "inbound");
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
          callDirection: doc.direction,
        };

        console.log(
          "[ws] call context resolved for callSid:", callSid,
          "| objective:", ctx.objectiveType,
          "| direction:", doc.direction
        );

        return buildRealtimePrompt(ctx);
      } catch (err) {
        console.error(
          "[ws] context resolution error for callSid:", callSid,
          "|", err instanceof Error ? err.message : err,
          "— treating as inbound"
        );
        return buildFallbackPrompt(undefined, "inbound");
      }
    };

    function buildBridge(callSid: string): RealtimeBridge {
      return new RealtimeBridge({
        exotelWs: ws,
        openAiApiKey: env.openai.apiKey,
        openAiModel: env.openai.model,
        elevenLabsApiKey: env.elevenLabs.apiKey,
        elevenLabsVoiceId: env.elevenLabs.voiceId,
        callSid,
        resolveInstructions,
      });
    }

    ws.on("message", (message: RawData) => {
      const raw = message.toString();

      let parsed: { event?: string; start?: { call_sid?: string; stream_sid?: string } } | undefined;
      try {
        parsed = JSON.parse(raw);
        if (parsed?.event && parsed.event !== "media") {
          console.log("[ws] non-media event received:", raw.slice(0, 500));
        }
      } catch {
        // not JSON — ignore, fall through and let the bridge (if any)
        // handle/log it as a parse failure.
      }

      if (!bridge) {
        if (parsed?.event === "start") {
          const callSid = parsed.start?.call_sid ?? parsed.start?.stream_sid;
          if (!callSid) {
            console.error("[ws] start event missing call_sid, dropping connection");
            ws.close();
            return;
          }
          resolvedCallSid = callSid;
          bridge = buildBridge(callSid);
          bridge.handleExotelMessage(raw);
          for (const queued of preStartQueue) {
            bridge.handleExotelMessage(queued);
          }
          preStartQueue.length = 0;
        } else {
          preStartQueue.push(raw);
        }
        return;
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
      triggerCallExtraction(resolvedCallSid, bridge?.getTranscript() ?? "");

      bridge?.destroy();
    });

    ws.on("error", (err) => {
      console.error("[ws] error", err.message);
      bridge?.destroy();
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
