// src/services/realtimeBridge.ts
//
// Responsibility: stream audio between Exotel and OpenAI Realtime.
//
// This file contains ZERO business logic and ZERO prompt-writing code.
// It receives a fully-formed `instructions` string from outside (via the
// GuideResolver) and forwards it to OpenAI as-is.
//
// The separation is strict:
//   • ConversationGuide knowledge lives in conversationGuideService.ts
//   • Prompt rendering lives in promptBuilder.ts
//   • Audio streaming lives here (realtimeBridge.ts)
//
// DO NOT add prompt generation, script handling, or business logic here.

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
// base64-encoded) for outbound playback — confirmed in official Exotel docs.
//
// ITU-T G.711 μ-law decode — standard algorithm, no external dependency.
// Each input byte is one μ-law sample; each output is one int16 LE sample.

function ulawToLinear(ulaw: number): number {
  ulaw = ~ulaw & 0xff;
  const sign     = ulaw & 0x80;
  const exponent = (ulaw >> 4) & 0x07;
  const mantissa = ulaw & 0x0f;
  let sample = ((mantissa << 3) | 0x84) << exponent;
  sample -= 0x84;
  return sign !== 0 ? -sample : sample;
}

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
// GuideResolver type
// ---------------------------------------------------------------------------

/**
 * Resolves the fully-rendered OpenAI `instructions` string for a given
 * Exotel call_sid.
 *
 * Supplied by index.ts. The resolver is responsible for:
 *   1. Looking up the Call document in MongoDB (existing logic).
 *   2. Deserialising the stored ConversationGuide.
 *   3. Calling promptBuilder.buildRealtimePrompt() to render the prompt.
 *   4. Returning the rendered string (or undefined for fallback).
 *
 * RealtimeBridge never touches MongoDB, ConversationGuide, or prompt logic.
 */
export type GuideResolver = (callSid: string) => Promise<string | undefined>;

// ---------------------------------------------------------------------------
// Bridge factory
// ---------------------------------------------------------------------------

export function createRealtimeBridge(
  exotelWs: WebSocket,
  resolveInstructions: GuideResolver
) {
  let openAiWs: WebSocket | null = null;
  let streamSid = "";
  let callSid = "";

  /**
   * True only after session.updated is received.
   * session.created alone does NOT mean the session is configured.
   */
  let sessionReady = false;

  /**
   * True once we've started (or finished) connecting to OpenAI.
   * Guards against double-connecting.
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
   * Connect to OpenAI Realtime and configure the session with the given
   * instructions string. Called only after the guide resolver has settled.
   *
   * @param instructions — The fully-rendered prompt from promptBuilder.
   *                        If undefined, a minimal fallback string is used.
   */
  function connectOpenAi(instructions: string | undefined): void {
    if (openAiConnectStarted) {
      console.warn("[bridge] connectOpenAi() called more than once — ignoring");
      return;
    }
    openAiConnectStarted = true;

    // If no instructions were resolved, use the absolute minimum fallback.
    // This should only happen if both the DB lookup and the guide service
    // fallback failed — which should never occur in normal operation.
    const finalInstructions =
      instructions ??
      `You are a professional healthcare executive from Govinda AI.
       Be warm, helpful, and concise. Keep responses to 2–3 sentences.
       Ask one question at a time. Wait for the customer to reply.
       Mirror the customer's language (English, Hindi, or Hinglish).`;

    console.log(
      "[bridge] connectOpenAi() — key present:",
      env.openai.apiKey
        ? `yes (len=${env.openai.apiKey.length})`
        : "NO — KEY IS EMPTY",
      "| url:", OPENAI_REALTIME_URL,
      "| instructions length:", finalInstructions.length
    );

    openAiWs = new WebSocket(OPENAI_REALTIME_URL, {
      headers: {
        Authorization: `Bearer ${env.openai.apiKey}`,
      },
    });

    // ── open ──────────────────────────────────────────────────────────────

    openAiWs.on("open", () => {
      console.log("[bridge] OpenAI Realtime WebSocket connected");

      sendToOpenAi({
        type: "session.update",
        session: {
          type: "realtime",
          output_modalities: ["audio"],

          // The rendered prompt from promptBuilder. Contains all call knowledge,
          // conversation rules, language rules, and turn-taking instructions.
          instructions: finalInstructions,

          audio: {
            input: {
              // G.711 μ-law (PCMU) — format is an object in GA, NOT a string
              format: { type: "audio/pcmu" },
              transcription: {
                model: "whisper-1",
              },
              turn_detection: {
                type: "server_vad",

                // 0.4: slightly more sensitive than default (0.5).
                // Catches softer speech onsets common in phone calls.
                threshold: 0.4,

                // 200ms: shorter than default (300ms).
                // Captures more of the start of words.
                prefix_padding_ms: 200,

                // 600ms: slightly longer than default (500ms).
                // Lets the customer pause mid-thought without cutting them off.
                silence_duration_ms: 600,

                // Auto-create AI response when VAD detects end of customer speech.
                // This drives the listen → respond loop without manual triggers.
                create_response: true,

                // INTERRUPTION: cancel the AI's audio output the instant the
                // customer starts speaking. This is the core of interruption handling.
                // The bridge does NOT need to send response.cancel manually —
                // OpenAI handles it internally when this flag is true.
                interrupt_response: true,
              },
            },
            output: {
              format: { type: "audio/pcmu" },

              // "ash" — deepest natural male voice in GA OpenAI Realtime API.
              // Official GA voice list: alloy, ash, ballad, coral, echo,
              // sage, shimmer, verse.
              // "ash" is male and natural for professional phone calls.
              // "coral", "sage", "shimmer" are female.
              // "marin" is NOT a valid GA voice name.
              voice: "ash",
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
        console.log(
          "[bridge][session.created] session acknowledged, waiting for session.updated"
        );
        return;
      }

      if (type === "session.updated") {
        console.log(
          "[bridge][session.updated] session READY — flushing queue and triggering greeting"
        );
        sessionReady = true;
        flushAudioQueue();

        // Trigger the AI's opening greeting. This is the ONLY manual
        // response.create we send — all subsequent turns are triggered
        // automatically by create_response: true in the VAD config.
        // The model generates a natural opening based on the instructions
        // (call objective, caller identity, recipient name) — never a
        // hardcoded greeting.
        sendToOpenAi({ type: "response.create" });
        return;
      }

      // ── Audio output → Exotel ────────────────────────────────────────────

      if (type === "response.output_audio.delta") {
        const delta = event.delta as string | undefined;
        if (delta) {
          const slin16Payload = pcmuBase64ToSlin16Base64(delta);
          sendToExotel({
            event: "media",
            stream_sid: streamSid,
            media: { payload: slin16Payload },
          });
        }
        return;
      }

      if (type === "response.output_audio.done") {
        console.log("[bridge][response.output_audio.done] AI audio turn complete → mark");
        sendToExotel({
          event: "mark",
          stream_sid: streamSid,
          mark: { name: "ai_done" },
        });
        return;
      }

      // ── AI speech transcript (informational) ─────────────────────────────

      if (type === "response.output_audio_transcript.delta") {
        const delta = event.delta as string | undefined;
        if (delta) process.stdout.write(`[bridge][ai-tx] ${delta}`);
        return;
      }

      if (type === "response.output_audio_transcript.done") {
        const transcript = event.transcript as string | undefined;
        console.log(
          `\n[bridge][ai-tx-done] callSid=${callSid} | "${transcript ?? ""}"`
        );
        return;
      }

      // ── User speech transcript (informational) ───────────────────────────

      if (type === "conversation.item.input_audio_transcription.delta") {
        const delta = event.delta as string | undefined;
        if (delta) process.stdout.write(`[bridge][user-tx] ${delta}`);
        return;
      }

      if (type === "conversation.item.input_audio_transcription.completed") {
        const transcript = event.transcript as string | undefined;
        console.log(
          `\n[bridge][user-tx-done] callSid=${callSid} | "${transcript ?? ""}"`
        );
        return;
      }

      if (type === "conversation.item.input_audio_transcription.failed") {
        console.error("[bridge][user-tx-failed]", JSON.stringify(event, null, 2));
        return;
      }

      // ── Response lifecycle ───────────────────────────────────────────────

      if (type === "response.created") {
        const responseId = (event.response as Record<string, unknown> | undefined)?.id;
        console.log(`[bridge][response.created] id=${responseId ?? "?"}`);
        return;
      }

      if (type === "response.done") {
        const resp = event.response as Record<string, unknown> | undefined;
        console.log(
          `[bridge][response.done] status=${resp?.status ?? "?"} | usage=${JSON.stringify(resp?.usage)}`
        );
        return;
      }

      if (type === "response.cancelled") {
        // Expected behaviour: fired when interrupt_response:true cancels the
        // AI output because the customer started speaking. Not an error.
        console.log("[bridge][response.cancelled] AI interrupted by customer speech — expected");
        return;
      }

      // ── Conversation items ───────────────────────────────────────────────

      if (type === "conversation.item.created") {
        const item = event.item as Record<string, unknown> | undefined;
        console.log(
          `[bridge][item.created] id=${item?.id ?? "?"} role=${item?.role ?? "?"}`
        );
        return;
      }

      if (type === "conversation.item.truncated") {
        // Expected: fired when AI audio is cut short by an interruption.
        console.log("[bridge][item.truncated] AI audio truncated — customer interrupted");
        return;
      }

      if (type === "conversation.item.retrieved") {
        console.log("[bridge][item.retrieved]", JSON.stringify(event, null, 2));
        return;
      }

      if (type === "conversation.item.deleted") {
        console.log("[bridge][item.deleted]", JSON.stringify(event, null, 2));
        return;
      }

      // ── Input audio buffer lifecycle ─────────────────────────────────────

      if (type === "input_audio_buffer.speech_started") {
        // Customer started speaking. With interrupt_response:true, OpenAI
        // automatically cancels any in-progress AI response. No manual action needed.
        console.log(
          `[bridge][speech_started] customer speaking | audio_start_ms=${event.audio_start_ms}`
        );
        return;
      }

      if (type === "input_audio_buffer.speech_stopped") {
        // Customer stopped speaking. With create_response:true, OpenAI
        // automatically commits the buffer and creates the next AI response.
        console.log(
          `[bridge][speech_stopped] customer finished | audio_end_ms=${event.audio_end_ms}`
        );
        return;
      }

      if (type === "input_audio_buffer.committed") {
        console.log(`[bridge][buffer.committed] item_id=${event.item_id}`);
        return;
      }

      if (type === "input_audio_buffer.cleared") {
        console.log("[bridge][buffer.cleared]");
        return;
      }

      if (type === "input_audio_buffer.timeout_triggered") {
        console.log("[bridge][buffer.timeout]", JSON.stringify(event, null, 2));
        return;
      }

      // ── Output text (not expected in audio-only mode) ─────────────────────

      if (type === "response.output_text.delta") {
        console.log(`[bridge][text.delta] "${event.delta ?? ""}"`);
        return;
      }

      if (type === "response.output_text.done") {
        console.log(`[bridge][text.done] "${event.text ?? ""}"`);
        return;
      }

      // ── Rate limits ──────────────────────────────────────────────────────

      if (type === "rate_limits.updated") {
        console.log("[bridge][rate_limits]", JSON.stringify(event.rate_limits));
        return;
      }

      // ── Errors ───────────────────────────────────────────────────────────

      if (type === "error") {
        console.error(
          "[bridge][ERROR] OpenAI error:",
          JSON.stringify(event, null, 2)
        );
        return;
      }

      // ── Unhandled ─────────────────────────────────────────────────────────

      console.log(
        `[bridge][unhandled] type="${type}"`,
        JSON.stringify(event, null, 2)
      );
    });

    // ── close ─────────────────────────────────────────────────────────────

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

    openAiWs.on("error", (err: Error) => {
      console.error(
        "[bridge][openai-error]", err.message,
        "| full:", JSON.stringify(err, Object.getOwnPropertyNames(err))
      );
    });
  }

  // ─── Exotel message handler ───────────────────────────────────────────────

  function handleExotelMessage(raw: string): void {
    let evt: ExotelEvent;
    try {
      evt = JSON.parse(raw) as ExotelEvent;
    } catch {
      console.warn("[bridge][exotel] non-JSON:", raw.slice(0, 200));
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

        // Resolve the fully-rendered instructions BEFORE connecting to OpenAI.
        // session.update is only sent once the instructions string is in hand.
        // Audio that arrives during this async window is queued and flushed
        // once session.updated comes back.
        resolveInstructions(callSid)
          .then((instructions) => {
            connectOpenAi(instructions);
          })
          .catch((err) => {
            console.error(
              "[bridge][exotel-start] guide resolution failed — using fallback:",
              err instanceof Error ? err.message : err
            );
            connectOpenAi(undefined);
          });
        break;
      }

      case "media": {
        const payload = evt.media.payload;
        if (sessionReady) {
          sendToOpenAi({ type: "input_audio_buffer.append", audio: payload });
        } else {
          if (audioQueue.length >= AUDIO_QUEUE_MAX) {
            audioQueue.shift();
            console.warn(
              `[bridge][exotel-media] queue full (cap=${AUDIO_QUEUE_MAX}) — dropping oldest chunk`
            );
          }
          audioQueue.push(payload);
        }
        break;
      }

      case "stop":
        console.log("[bridge][exotel-stop] callSid:", evt.stop.call_sid);
        if (openAiWs && openAiWs.readyState === WebSocket.OPEN) {
          sendToOpenAi({ type: "input_audio_buffer.commit" });
          openAiWs.close(1000, "call ended");
        }
        break;

      case "mark":
        console.log("[bridge][exotel-mark] name:", evt.mark.name);
        break;

      case "error":
        console.error("[bridge][exotel-error]", JSON.stringify(evt.error));
        if (openAiWs && openAiWs.readyState === WebSocket.OPEN) {
          openAiWs.close(1011, "exotel error");
        }
        break;

      default:
        console.log(
          "[bridge][exotel-unknown]",
          (evt as { event: string }).event,
          raw.slice(0, 300)
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
        // Socket may already be closing
      }
      openAiWs = null;
    }
    sessionReady = false;
    audioQueue.length = 0;
  }

  return { handleExotelMessage, destroy };
}
