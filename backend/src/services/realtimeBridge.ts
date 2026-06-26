// src/services/realtimeBridge.ts
import WebSocket from "ws";
import { env } from "../config/env";

// Model must be a valid GA model: set OPENAI_MODEL=gpt-realtime in Render env vars.
// "gpt-realtime-1.5" is not a valid model name and will be rejected.
const OPENAI_REALTIME_URL =
  `wss://api.openai.com/v1/realtime?model=${env.openai.model}`;

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
  | { event: "media"; media: { chunk: number; timestamp: string; payload: string } }
  | { event: "stop"; stop: { call_sid: string } }
  | { event: "mark"; mark: { name: string } }
  | { event: "error"; error: { code: string; message: string } };

export function createRealtimeBridge(exotelWs: WebSocket, script?: string) {
  let openAiWs: WebSocket | null = null;
  let streamSid = "";
  let callSid = "";
  let sessionReady = false;
  let sessionUpdated = false;
  const audioQueue: string[] = [];

  // ─── helpers ────────────────────────────────────────────────────

  function flushQueue() {
    if (!openAiWs || openAiWs.readyState !== WebSocket.OPEN) return;
    while (audioQueue.length > 0) {
      const payload = audioQueue.shift()!;
      sendToOpenAi({
        type: "input_audio_buffer.append",
        audio: payload,
      });
    }
  }

  function sendToOpenAi(obj: unknown) {
    if (openAiWs && openAiWs.readyState === WebSocket.OPEN) {
      openAiWs.send(JSON.stringify(obj));
    }
  }

  function sendToExotel(obj: unknown) {
    if (exotelWs.readyState === WebSocket.OPEN) {
      exotelWs.send(JSON.stringify(obj));
    }
  }

  // ─── OpenAI connection ───────────────────────────────────────────

  function connectOpenAi() {
    console.log(
      "[bridge] connectOpenAi() called — key present:",
      env.openai.apiKey ? `yes (len=${env.openai.apiKey.length})` : "NO — KEY IS EMPTY",
      "url:", OPENAI_REALTIME_URL
    );

    openAiWs = new WebSocket(OPENAI_REALTIME_URL, {
      headers: {
        Authorization: `Bearer ${env.openai.apiKey}`,
        // No OpenAI-Beta header — GA API uses Bearer token only
      },
    });

    openAiWs.on("open", () => {
      console.log("[bridge] OpenAI Realtime connected");

      // ===== GA session.update schema =====
      // Source: https://developers.openai.com/api/reference/resources/realtime/client-events
      // and https://platform.openai.com/docs/guides/realtime-vad
      //
      // Top-level session fields: type, instructions, voice, tools,
      //   max_response_output_tokens, audio
      //
      // "modalities" does NOT exist in the GA schema — removed.
      //
      // audio.input.format: object with { type: "audio/pcmu" } for G.711 μ-law
      // audio.output.format: object with { type: "audio/pcmu" } for G.711 μ-law
      // audio.input.transcription: { model: "whisper-1" }
      // audio.input.turn_detection: server_vad config object
      // audio.output.voice and audio.output.speed are under audio.output
      sendToOpenAi({
        type: "session.update",
        session: {
          type: "realtime",
          instructions: script
            ? `You are an AI calling assistant for RKG Labs healthcare. Your script: ${script}. Be concise, warm, and professional. Speak in clear English or Hindi based on the caller.`
            : "You are a helpful AI calling assistant for RKG Labs healthcare. Be concise, warm, and professional. Keep responses short since this is a phone call.",
          voice: "alloy",
          audio: {
            input: {
              format: { type: "audio/pcmu" },
              transcription: { model: "whisper-1" },
              turn_detection: {
                type: "server_vad",
                threshold: 0.5,
                prefix_padding_ms: 300,
                silence_duration_ms: 500,
                create_response: true,
                interrupt_response: true,
              },
            },
            output: {
              format: { type: "audio/pcmu" },
            },
          },
        },
      });
    });

    openAiWs.on("message", (raw: WebSocket.RawData) => {
      let event: Record<string, unknown>;
      try {
        event = JSON.parse(raw.toString()) as Record<string, unknown>;
      } catch {
        return;
      }

      const type = event.type as string;

      if (type === "session.created") {
        console.log("[bridge] OpenAI session created");
        sessionReady = true;
        flushQueue();
        sendToOpenAi({ type: "response.create" });
        return;
      }

      if (type === "session.updated") {
        console.log("[bridge] OpenAI session updated");
        sessionUpdated = true;
        if (!sessionReady) {
          sessionReady = true;
          flushQueue();
        }
        return;
      }

      // GA event name for audio delta
      if (type === "response.output_audio.delta") {
        const delta = event.delta as string | undefined;
        if (delta) {
          sendToExotel({
            event: "media",
            streamSid,
            media: { payload: delta },
          });
        }
        return;
      }

      // GA event name for end of audio turn
      if (type === "response.output_audio.done") {
        sendToExotel({
          event: "mark",
          streamSid,
          mark: { name: "ai_done" },
        });
        return;
      }

      if (type === "conversation.item.input_audio_transcription.completed") {
        const transcript = event.transcript as string;
        console.log(`[bridge] User said: "${transcript}" | callSid: ${callSid}`);
        return;
      }

      if (type === "response.text.done") {
        const text = event.text as string;
        console.log(`[bridge] AI said: "${text}" | callSid: ${callSid}`);
        return;
      }

      if (type === "error") {
        console.error("[bridge] OpenAI Realtime error:", JSON.stringify(event.error));
        return;
      }
    });

    openAiWs.on("close", (code, reason) => {
      console.log("[bridge] OpenAI Realtime closed", code, reason.toString());
      openAiWs = null;
      sessionReady = false;
      sessionUpdated = false;
    });

    openAiWs.on("error", (err) => {
      console.error("[bridge] OpenAI WS error:", err.message, JSON.stringify(err));
    });
  }

  // ─── Exotel message handler ──────────────────────────────────────

  function handleExotelMessage(raw: string) {
    let evt: ExotelEvent;
    try {
      evt = JSON.parse(raw) as ExotelEvent;
    } catch {
      console.warn("[bridge] non-JSON from Exotel:", raw.slice(0, 200));
      return;
    }

    console.log("[bridge] Exotel event:", evt.event);

    switch (evt.event) {
      case "connected":
        console.log("[bridge] Exotel stream connected, protocol:", evt.protocol);
        break;

      case "start":
        callSid   = evt.start.call_sid;
        streamSid = evt.start.stream_sid ?? evt.start.call_sid;
        console.log("[bridge] stream started — callSid:", callSid, "streamSid:", streamSid);
        break;

      case "media": {
        const payload = evt.media.payload;
        if (sessionReady) {
          sendToOpenAi({
            type: "input_audio_buffer.append",
            audio: payload,
          });
        } else {
          audioQueue.push(payload);
        }
        break;
      }

      case "stop":
        console.log("[bridge] Exotel stream stopped — callSid:", evt.stop.call_sid);
        if (openAiWs && openAiWs.readyState === WebSocket.OPEN) {
          sendToOpenAi({ type: "input_audio_buffer.commit" });
          openAiWs.close(1000, "call ended");
        }
        break;

      case "mark":
        console.log("[bridge] Exotel mark received:", evt.mark.name);
        break;

      case "error":
        console.error("[bridge] Exotel error:", evt.error);
        if (openAiWs && openAiWs.readyState === WebSocket.OPEN) {
          openAiWs.close(1011, "exotel error");
        }
        break;

      default:
        console.log("[bridge] unknown Exotel event:", (evt as { event: string }).event, "raw:", raw.slice(0, 300));
    }
  }

  // ─── Cleanup ─────────────────────────────────────────────────────

  function destroy() {
    if (openAiWs) {
      try {
        openAiWs.close(1000, "bridge destroyed");
      } catch {
        // ignore
      }
      openAiWs = null;
    }
    sessionReady = false;
    sessionUpdated = false;
    audioQueue.length = 0;
  }

  // Connect to OpenAI immediately on bridge creation
  connectOpenAi();

  return { handleExotelMessage, destroy };
}
