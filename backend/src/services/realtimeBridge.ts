// src/services/realtimeBridge.ts

import WebSocket from "ws";
import { env } from "../config/env";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** GA Realtime API endpoint. Model is set via env.openai.model. */
const OPENAI_REALTIME_URL = `wss://api.openai.com/v1/realtime?model=${env.openai.model}`;

/**
 * Hard cap on the pre-session audio queue.
 * At ~20 ms per G.711 chunk (160 bytes @ 8 kHz) this is ~10 seconds.
 * Oldest chunks are dropped silently once the cap is reached.
 */
const AUDIO_QUEUE_MAX = 500;

// ---------------------------------------------------------------------------
// G.711 μ-law → 16-bit linear PCM (slin16) decoder
// ---------------------------------------------------------------------------
//
// OpenAI outputs audio/pcmu (G.711 μ-law, 8 kHz, base64-encoded).
// Exotel Voicebot Applet expects raw/slin (16-bit PCM little-endian, 8 kHz,
// base64-encoded) for outbound playback — confirmed in official Exotel docs:
//   "All audio payloads are sent as raw/slin (16-bit, 8kHz, mono PCM
//    little-endian) encoded in base64. The same is expected from the client
//    in the case of bi-directional streams."
//   (developer.exotel.com/docs/agentstream/stream-voicebot-applet)
//
// ITU-T G.711 μ-law decode — standard algorithm, no external dependency.
// Each input byte is one μ-law sample; each output is one int16 LE sample.

/** Decode a single μ-law byte to a 16-bit signed linear PCM sample. */
function ulawToLinear(ulaw: number): number {
  // Invert all bits (μ-law bytes are transmitted inverted per ITU-T G.711)
  ulaw = ~ulaw & 0xff;
  const sign     = ulaw & 0x80;
  const exponent = (ulaw >> 4) & 0x07;
  const mantissa = ulaw & 0x0f;
  // Reconstruct the magnitude
  let sample = ((mantissa << 3) | 0x84) << exponent;
  // Bias removal: subtract the bias that was added during encoding
  sample -= 0x84;
  return sign !== 0 ? -sample : sample;
}

/**
 * Convert a base64-encoded PCMU (G.711 μ-law) buffer to a base64-encoded
 * raw slin16 (16-bit signed PCM, little-endian) buffer.
 *
 * Input:  N bytes of μ-law data (one sample per byte)
 * Output: 2N bytes of linear PCM data (two bytes per sample, little-endian)
 */
function pcmuBase64ToSlin16Base64(pcmuBase64: string): string {
  const pcmu   = Buffer.from(pcmuBase64, "base64");
  const slin16 = Buffer.allocUnsafe(pcmu.length * 2);
  for (let i = 0; i < pcmu.length; i++) {
    slin16.writeInt16LE(ulawToLinear(pcmu[i]!), i * 2);
  }
  return slin16.toString("base64");
}

// ---------------------------------------------------------------------------
// Exotel event types
// ---------------------------------------------------------------------------

type ExotelEvent =
  | { event: "connected"; protocol: string; version: string }
  | {
      event: "start";
      start: {
        call_sid: string;
        stream_sid: string;
        customParameters?: Record<string, string>;
      };
    }
  | {
      event: "media";
      media: { chunk: number; timestamp: string; payload: string };
    }
  | { event: "stop"; stop: { call_sid: string } }
  | { event: "mark"; mark: { name: string } }
  | { event: "error"; error: { code: string; message: string } };

// ---------------------------------------------------------------------------
// Bridge factory
// ---------------------------------------------------------------------------

/**
 * Resolves the calling script for a given Exotel call_sid.
 * Supplied by the caller (index.ts) so this module stays decoupled from
 * the DB layer. Must resolve (or reject) before the OpenAI session is
 * configured — the bridge will wait on it.
 */
export type ScriptResolver = (callSid: string) => Promise<string | undefined>;

export function createRealtimeBridge(
  exotelWs: WebSocket,
  resolveScript: ScriptResolver
) {
  let openAiWs: WebSocket | null = null;
  let streamSid = "";
  let callSid = "";

  /**
   * True only after session.updated is received.
   * session.created alone does NOT mean the session is configured —
   * we must wait for the server to acknowledge our session.update.
   */
  let sessionReady = false;

  /**
   * True once we've started (or finished) connecting to OpenAI.
   * Guards against double-connecting if "start" somehow fires twice
   * or media arrives in an unexpected order.
   */
  let openAiConnectStarted = false;

  /** Pre-session audio buffer (chunks received before sessionReady = true). */
  const audioQueue: string[] = [];

  // ─── Helpers ─────────────────────────────────────────────────────────────

  function sendToOpenAi(obj: unknown): void {
    if (openAiWs && openAiWs.readyState === WebSocket.OPEN) {
      openAiWs.send(JSON.stringify(obj));
    }
  }

  function sendToExotel(obj: unknown): void {
    if (exotelWs.readyState === WebSocket.OPEN) {
      exotelWs.send(JSON.stringify(obj));
    }
  }

  /** Drain buffered audio chunks into the OpenAI input buffer. */
  function flushAudioQueue(): void {
    if (!openAiWs || openAiWs.readyState !== WebSocket.OPEN) return;
    const count = audioQueue.length;
    if (count > 0) {
      console.log(`[bridge] flushing ${count} queued audio chunk(s)`);
    }
    while (audioQueue.length > 0) {
      const payload = audioQueue.shift()!;
      sendToOpenAi({ type: "input_audio_buffer.append", audio: payload });
    }
  }

  // ─── OpenAI connection ────────────────────────────────────────────────────

  /**
   * Connects to the OpenAI Realtime API and sends session.update using the
   * given script. This is NOT called automatically on bridge creation —
   * it is only invoked once we have a callSid/streamSid from Exotel's
   * "start" event AND the script lookup (DB call) has resolved. This
   * guarantees session.update is never sent with a stale/missing script.
   *
   * Audio frames that arrive from Exotel before this resolves are queued
   * by handleExotelMessage() (via the existing audioQueue) and flushed
   * once the OpenAI session reaches session.updated.
   */
  function connectOpenAi(script: string | undefined): void {
    if (openAiConnectStarted) {
      console.warn("[bridge] connectOpenAi() called more than once — ignoring");
      return;
    }
    openAiConnectStarted = true;

    console.log(
      "[bridge] connectOpenAi() — key present:",
      env.openai.apiKey
        ? `yes (len=${env.openai.apiKey.length})`
        : "NO — KEY IS EMPTY",
      "| url:", OPENAI_REALTIME_URL,
      "| script:", script ? `provided (len=${script.length})` : "none (using default instructions)"
    );

    openAiWs = new WebSocket(OPENAI_REALTIME_URL, {
      headers: {
        // GA Realtime API: Bearer token only.
        // Do NOT include OpenAI-Beta header — that is the beta-only header.
        Authorization: `Bearer ${env.openai.apiKey}`,
      },
    });

    // ── open ──────────────────────────────────────────────────────────────

    openAiWs.on("open", () => {
      console.log("[bridge] OpenAI Realtime WebSocket connected");

      // Send session.update immediately on open.
      // The server will respond with session.created (state acknowledged)
      // and then session.updated (configuration applied → we are truly ready).
      //
      // GA session.update schema (verified from official docs):
      //   session.type            = "realtime"                (required, always this value)
      //   session.output_modalities = ["audio"]              (top-level, not "modalities")
      //   session.instructions    = string                   (system prompt)
      //   session.audio.input.format = { type: "audio/pcmu" } (PCMU object, not a string)
      //   session.audio.input.transcription.model            (optional, enables user transcript)
      //   session.audio.input.turn_detection                 (server_vad config)
      //   session.audio.input.turn_detection.create_response = true  (auto-respond after VAD)
      //   session.audio.input.turn_detection.interrupt_response = true
      //   session.audio.output.format = { type: "audio/pcmu" } (PCMU object, not a string)
      //   session.audio.output.voice  = "marin"              (voice under audio.output, not top-level)
      sendToOpenAi({
        type: "session.update",
        session: {
          type: "realtime",
          output_modalities: ["audio"],
          instructions: script
            ? `You are an AI calling assistant for RKG Labs healthcare. Your script: ${script}. Be concise, warm, and professional. Speak in clear English or Hindi based on the caller.`
            : "You are a helpful AI calling assistant for RKG Labs healthcare. Be concise, warm, and professional. Keep responses short since this is a phone call.",
          audio: {
            input: {
              // G.711 μ-law (PCMU) — format is an object in GA, NOT a string
              format: { type: "audio/pcmu" },
              // Input transcription (user speech → text, runs asynchronously)
              transcription: {
                model: "whisper-1",
              },
              // Server VAD: model detects speech boundaries automatically
              turn_detection: {
                type: "server_vad",
                threshold: 0.5,
                prefix_padding_ms: 300,
                silence_duration_ms: 500,
                // Auto-create a response when VAD detects end of user speech
                create_response: true,
                // Cancel ongoing AI response if user starts speaking
                interrupt_response: true,
              },
            },
            output: {
              // G.711 μ-law (PCMU) output — format is an object in GA, NOT a string
              format: { type: "audio/pcmu" },
              // voice goes under audio.output in GA (NOT at session top-level)
              voice: "marin",
            },
          },
        },
      });
    });

    // ── message ───────────────────────────────────────────────────────────

    openAiWs.on("message", (raw: WebSocket.RawData) => {
      let event: Record<string, unknown>;
      try {
        event = JSON.parse(raw.toString()) as Record<string, unknown>;
      } catch {
        console.warn("[bridge] non-JSON from OpenAI, ignoring");
        return;
      }

      const type = event.type as string;

      // ── Session lifecycle ────────────────────────────────────────────────

      if (type === "session.created") {
        // Server has acknowledged the connection. The session is NOT yet
        // configured — session.update is still being processed. Wait for
        // session.updated before marking ready.
        console.log(
          "[bridge][session.created] session acknowledged, waiting for session.updated"
        );
        console.log("[bridge][session.created]", JSON.stringify(event, null, 2));
        return;
      }

      if (type === "session.updated") {
        // Server has applied our session.update. Session is now fully
        // configured and ready to accept audio and trigger responses.
        console.log(
          "[bridge][session.updated] session is READY — flushing audio queue and triggering greeting"
        );
        console.log("[bridge][session.updated]", JSON.stringify(event, null, 2));

        sessionReady = true;

        // Drain any audio that arrived before the session was ready
        flushAudioQueue();

        // Send an initial response.create to have the AI speak first (greeting).
        // With server_vad + create_response:true, subsequent turns are automatic.
        // response.create payload: no required fields beyond type.
        sendToOpenAi({ type: "response.create" });
        return;
      }

      // ── Audio output (the core path — forwarded to Exotel) ──────────────

      if (type === "response.output_audio.delta") {
        // OpenAI delivers base64-encoded PCMU (G.711 μ-law, 8 kHz).
        // Exotel Voicebot Applet requires base64-encoded slin16
        // (16-bit PCM little-endian, 8 kHz). Transcode before forwarding.
        const delta = event.delta as string | undefined;
        if (delta) {
          const slin16Payload = pcmuBase64ToSlin16Base64(delta);
          console.log(
            `[bridge][response.output_audio.delta] pcmu ${delta.length} b64chars` +
            ` → slin16 ${slin16Payload.length} b64chars → Exotel`
          );
          sendToExotel({
            event: "media",
            stream_sid: streamSid,          // Exotel protocol key: stream_sid
            media: { payload: slin16Payload },
          });
        }
        return;
      }

      if (type === "response.output_audio.done") {
        // GA event name (verified). Audio turn complete — no audio data in this event.
        // Signal Exotel that this AI turn has finished.
        console.log("[bridge][response.output_audio.done] AI audio turn complete → sending mark");
        sendToExotel({
          event: "mark",
          stream_sid: streamSid,            // Exotel protocol key: stream_sid
          mark: { name: "ai_done" },
        });
        return;
      }

      // ── AI speech transcript ─────────────────────────────────────────────

      if (type === "response.output_audio_transcript.delta") {
        // Incremental AI speech transcript — informational only
        const delta = event.delta as string | undefined;
        if (delta) {
          process.stdout.write(`[bridge][ai-transcript-delta] ${delta}`);
        }
        return;
      }

      if (type === "response.output_audio_transcript.done") {
        const transcript = event.transcript as string | undefined;
        console.log(
          `\n[bridge][ai-transcript-done] callSid=${callSid} | transcript="${transcript ?? ""}"`
        );
        return;
      }

      // ── User speech transcript ───────────────────────────────────────────

      if (type === "conversation.item.input_audio_transcription.delta") {
        // Incremental user speech transcript — informational only
        const delta = event.delta as string | undefined;
        if (delta) {
          process.stdout.write(`[bridge][user-transcript-delta] ${delta}`);
        }
        return;
      }

      if (type === "conversation.item.input_audio_transcription.completed") {
        const transcript = event.transcript as string | undefined;
        console.log(
          `\n[bridge][user-transcript-done] callSid=${callSid} | transcript="${transcript ?? ""}"`
        );
        return;
      }

      if (type === "conversation.item.input_audio_transcription.failed") {
        console.error(
          "[bridge][user-transcript-failed]",
          JSON.stringify(event, null, 2)
        );
        return;
      }

      // ── Response lifecycle ───────────────────────────────────────────────

      if (type === "response.created") {
        const responseId = (event.response as Record<string, unknown> | undefined)?.id;
        console.log(`[bridge][response.created] responseId=${responseId ?? "unknown"}`);
        return;
      }

      if (type === "response.done") {
        const resp = event.response as Record<string, unknown> | undefined;
        const status = resp?.status as string | undefined;
        const usage = resp?.usage;
        console.log(
          `[bridge][response.done] status=${status ?? "unknown"} | usage=${JSON.stringify(usage)}`
        );
        return;
      }

      if (type === "response.cancelled") {
        console.log("[bridge][response.cancelled]", JSON.stringify(event, null, 2));
        return;
      }

      // ── Conversation items ───────────────────────────────────────────────

      if (type === "conversation.item.created") {
        const item = event.item as Record<string, unknown> | undefined;
        console.log(
          `[bridge][conversation.item.created] id=${item?.id ?? "?"} role=${item?.role ?? "?"} type=${item?.type ?? "?"}`
        );
        return;
      }

      if (type === "conversation.item.retrieved") {
        console.log("[bridge][conversation.item.retrieved]", JSON.stringify(event, null, 2));
        return;
      }

      if (type === "conversation.item.truncated") {
        console.log("[bridge][conversation.item.truncated]", JSON.stringify(event, null, 2));
        return;
      }

      if (type === "conversation.item.deleted") {
        console.log("[bridge][conversation.item.deleted]", JSON.stringify(event, null, 2));
        return;
      }

      // ── Input audio buffer lifecycle ─────────────────────────────────────

      if (type === "input_audio_buffer.speech_started") {
        console.log(
          `[bridge][input_audio_buffer.speech_started] audio_start_ms=${event.audio_start_ms}`
        );
        return;
      }

      if (type === "input_audio_buffer.speech_stopped") {
        console.log(
          `[bridge][input_audio_buffer.speech_stopped] audio_end_ms=${event.audio_end_ms}`
        );
        return;
      }

      if (type === "input_audio_buffer.committed") {
        console.log(`[bridge][input_audio_buffer.committed] item_id=${event.item_id}`);
        return;
      }

      if (type === "input_audio_buffer.cleared") {
        console.log("[bridge][input_audio_buffer.cleared]");
        return;
      }

      if (type === "input_audio_buffer.timeout_triggered") {
        // Emitted when idle_timeout_ms fires (no speech detected for that duration).
        console.log(
          "[bridge][input_audio_buffer.timeout_triggered]",
          JSON.stringify(event, null, 2)
        );
        return;
      }

      // ── Output text (if output_modalities includes "text") ───────────────

      if (type === "response.output_text.delta") {
        // Not expected with output_modalities: ["audio"] only, but log if seen
        console.log(
          `[bridge][response.output_text.delta] delta="${event.delta ?? ""}"`
        );
        return;
      }

      if (type === "response.output_text.done") {
        console.log(
          `[bridge][response.output_text.done] text="${event.text ?? ""}"`
        );
        return;
      }

      // ── Rate limits ──────────────────────────────────────────────────────

      if (type === "rate_limits.updated") {
        const limits = event.rate_limits;
        console.log("[bridge][rate_limits.updated]", JSON.stringify(limits));
        return;
      }

      // ── Errors ───────────────────────────────────────────────────────────

      if (type === "error") {
        // Log the FULL error payload including all nested fields
        console.error(
          "[bridge][ERROR] Full OpenAI error event:",
          JSON.stringify(event, null, 2)
        );
        return;
      }

      // ── Unhandled / future events ─────────────────────────────────────────

      console.log(
        `[bridge][unhandled] type="${type}"`,
        JSON.stringify(event, null, 2)
      );
    });

    // ── close ─────────────────────────────────────────────────────────────
    // Registered directly on openAiWs (NOT inside the message handler).

    openAiWs.on("close", (code: number, reason: Buffer) => {
      console.log(
        "[bridge][openai-close] code:", code,
        "| reason:", reason.toString() || "(none)"
      );
      openAiWs = null;
      sessionReady = false;
      audioQueue.length = 0;
    });

    // ── error ─────────────────────────────────────────────────────────────
    // Registered directly on openAiWs (NOT inside the message handler).

    openAiWs.on("error", (err: Error) => {
      console.error(
        "[bridge][openai-error] message:", err.message,
        "| full:", JSON.stringify(err, Object.getOwnPropertyNames(err))
      );
      // Do not close here — the close event will follow automatically
    });
  }

  // ─── Exotel message handler ───────────────────────────────────────────────

  function handleExotelMessage(raw: string): void {
    let evt: ExotelEvent;
    try {
      evt = JSON.parse(raw) as ExotelEvent;
    } catch {
      console.warn("[bridge][exotel] non-JSON message:", raw.slice(0, 200));
      return;
    }

    switch (evt.event) {
      case "connected":
        console.log(
          "[bridge][exotel-connected] protocol:", evt.protocol,
          "| version:", evt.version
        );
        break;

      case "start": {
        callSid   = evt.start.call_sid;
        streamSid = evt.start.stream_sid ?? evt.start.call_sid;
        console.log(
          "[bridge][exotel-start] callSid:", callSid,
          "| streamSid:", streamSid,
          "| params:", JSON.stringify(evt.start.customParameters ?? {})
        );

        // Resolve the script BEFORE connecting to OpenAI. This is the fix:
        // session.update (which carries `instructions`) is only ever sent
        // once we actually have the script in hand — there is no longer a
        // window where the OpenAI session gets configured with stale or
        // default instructions because a DB lookup hadn't finished yet.
        //
        // Any Exotel media frames that arrive while this lookup is in
        // flight are safely queued by the "media" case below and flushed
        // once session.updated comes back.
        resolveScript(callSid)
          .then((script) => {
            connectOpenAi(script);
          })
          .catch((err) => {
            console.error(
              "[bridge][exotel-start] script lookup failed, proceeding with default instructions:",
              err instanceof Error ? err.message : err
            );
            connectOpenAi(undefined);
          });
        break;
      }

      case "media": {
        const payload = evt.media.payload;
        if (sessionReady) {
          // Session is ready — send directly to OpenAI input buffer
          sendToOpenAi({ type: "input_audio_buffer.append", audio: payload });
        } else {
          // Session not yet configured (still connecting / awaiting script
          // resolution / awaiting session.updated) — buffer the chunk.
          // Drop oldest if the queue is full to prevent unbounded memory growth.
          if (audioQueue.length >= AUDIO_QUEUE_MAX) {
            audioQueue.shift();
            console.warn(
              `[bridge][exotel-media] audio queue full (cap=${AUDIO_QUEUE_MAX}) — dropping oldest chunk`
            );
          }
          audioQueue.push(payload);
        }
        break;
      }

      case "stop":
        console.log("[bridge][exotel-stop] callSid:", evt.stop.call_sid);
        if (openAiWs && openAiWs.readyState === WebSocket.OPEN) {
          // Commit any remaining audio, then close cleanly
          sendToOpenAi({ type: "input_audio_buffer.commit" });
          openAiWs.close(1000, "call ended");
        }
        break;

      case "mark":
        console.log("[bridge][exotel-mark] name:", evt.mark.name);
        break;

      case "error":
        console.error(
          "[bridge][exotel-error]",
          JSON.stringify(evt.error)
        );
        if (openAiWs && openAiWs.readyState === WebSocket.OPEN) {
          openAiWs.close(1011, "exotel error");
        }
        break;

      default:
        console.log(
          "[bridge][exotel-unknown] event:",
          (evt as { event: string }).event,
          "| raw:", raw.slice(0, 300)
        );
    }
  }

  // ─── Cleanup ──────────────────────────────────────────────────────────────

  function destroy(): void {
    if (openAiWs) {
      try {
        if (openAiWs.readyState === WebSocket.OPEN) {
          openAiWs.close(1000, "bridge destroyed");
        }
      } catch {
        // Socket may already be closing — ignore
      }
      openAiWs = null;
    }
    sessionReady = false;
    audioQueue.length = 0;
  }

  // NOTE: connectOpenAi() is intentionally NOT called here.
  // It is now triggered from inside handleExotelMessage()'s "start" case,
  // once the script has been resolved. This is the core fix: previously
  // this factory connected to OpenAI (and sent session.update) immediately
  // on construction, before any callSid/streamSid/script was available.

  return { handleExotelMessage, destroy };
}
