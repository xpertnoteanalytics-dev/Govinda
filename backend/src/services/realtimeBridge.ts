// src/services/realtimeBridge.ts
import WebSocket from "ws";
import { env } from "../config/env";

const OPENAI_REALTIME_URL =
  `wss://api.openai.com/v1/realtime?model=${env.openai.model}`;

type ExotelEvent =
  | { event: "connected"; protocol: string; version: string }
  | {
      event: "start";
      start: {
        // ===== CHANGED: Exotel uses snake_case field names =====
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

      // ===== CHANGED: GA API session.update schema =====
      // - session.type is now required and must be "realtime"
      // - audio formats are objects ({ type: "audio/pcmu" }), not strings
      // - audio config is nested under session.audio.input and session.audio.output
      // - input_audio_transcription moves to session.audio.input.transcription
      // - turn_detection moves to session.audio.input.turn_detection
      // - modalities, instructions, voice remain at session top level
      sendToOpenAi({
        type: "session.update",
        session: {
          type: "realtime",
          modalities: ["audio", "text"],
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
              },
            },
            output: {
              format: { type: "audio/pcmu" },
            },
          },
        },
      });
      // ===== END CHANGED =====
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

      // ===== CHANGED: GA API uses response.output_audio.delta for audio streaming =====
      // Keep response.audio.delta as fallback for gpt-4o-realtime-preview compatibility
      if (type === "response.output_audio.delta" || type === "response.audio.delta") {
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

      // ===== CHANGED: GA API uses response.output_audio.done =====
      // Keep response.audio.done as fallback
      if (type === "response.output_audio.done" || type === "response.audio.done") {
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
        // ===== CHANGED: read snake_case fields from Exotel start payload =====
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
        // ===== CHANGED: read snake_case call_sid from stop event =====
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
