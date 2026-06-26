// src/services/realtimeBridge.ts
import WebSocket from "ws";
import { env } from "../config/env";

// ✅ Fixed: correct model name
const OPENAI_REALTIME_URL =
  "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview";

type ExotelEvent =
  | { event: "connected"; protocol: string; version: string }
  | {
      event: "start";
      start: {
        callSid: string;
        streamSid: string; // ✅ Added: separate from callSid
        customParameters?: Record<string, string>;
      };
    }
  | { event: "media"; media: { chunk: number; timestamp: string; payload: string } }
  | { event: "stop"; stop: { callSid: string } }
  | { event: "mark"; mark: { name: string } }
  | { event: "error"; error: { code: string; message: string } };

export function createRealtimeBridge(exotelWs: WebSocket, script?: string) {
  let openAiWs: WebSocket | null = null;
  let streamSid = "";
  let callSid = "";
  let sessionReady = false;
  let sessionUpdated = false; // ✅ Added: track update separately
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
    // ===== DEBUG ADDED =====
    console.log("[bridge] connectOpenAi() called — key present:", env.openai.apiKey ? `yes (len=${env.openai.apiKey.length})` : "NO — KEY IS EMPTY", "url:", OPENAI_REALTIME_URL);
    // ===== DEBUG ADDED =====

    openAiWs = new WebSocket(OPENAI_REALTIME_URL, {
      headers: {
        Authorization: `Bearer ${env.openai.apiKey}`,
        "OpenAI-Beta": "realtime=v1", // ✅ Required header
      },
    });

    openAiWs.on("open", () => {
      console.log("[bridge] OpenAI Realtime connected");

      // ✅ Send session config immediately on open
      sendToOpenAi({
        type: "session.update",
        session: {
          modalities: ["audio", "text"],
          instructions: script
            ? `You are an AI calling assistant for RKG Labs healthcare. Your script: ${script}. Be concise, warm, and professional. Speak in clear English or Hindi based on the caller.`
            : "You are a helpful AI calling assistant for RKG Labs healthcare. Be concise, warm, and professional. Keep responses short since this is a phone call.",
          voice: "alloy",
          input_audio_format: "g711_ulaw",
          output_audio_format: "g711_ulaw",
          input_audio_transcription: { model: "whisper-1" },
          turn_detection: {
            type: "server_vad",
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 500,
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

      // ✅ Fixed: session.created → mark ready + flush + greet ONCE
      if (type === "session.created") {
        console.log("[bridge] OpenAI session created");
        sessionReady = true;
        flushQueue();
        // Trigger AI greeting
        sendToOpenAi({ type: "response.create" });
        return;
      }

      // ✅ Fixed: session.updated → just flush, no extra greeting
      if (type === "session.updated") {
        console.log("[bridge] OpenAI session updated");
        sessionUpdated = true;
        if (!sessionReady) {
          sessionReady = true;
          flushQueue();
        }
        return;
      }

      // ✅ Stream audio delta back to Exotel
      if (type === "response.audio.delta") {
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

      // ✅ Mark end of AI speech turn
      if (type === "response.audio.done") {
        sendToExotel({
          event: "mark",
          streamSid,
          mark: { name: "ai_done" },
        });
        return;
      }

      // ✅ Log transcripts for debugging / saving later
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
      // ===== DEBUG ADDED =====
      console.error("[bridge] OpenAI WS error:", err.message, JSON.stringify(err));
      // ===== DEBUG ADDED =====
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
        // ✅ Fixed: use streamSid from start event, keep callSid separate
        callSid   = evt.start.callSid;
        streamSid = evt.start.streamSid ?? evt.start.callSid;
        console.log("[bridge] stream started — callSid:", callSid, "streamSid:", streamSid);
        connectOpenAi();
        break;

      case "media": {
        const payload = evt.media.payload;
        if (sessionReady) {
          sendToOpenAi({
            type: "input_audio_buffer.append",
            audio: payload,
          });
        } else {
          // Buffer audio until session is ready
          audioQueue.push(payload);
        }
        break;
      }

      case "stop":
        console.log("[bridge] Exotel stream stopped — callSid:", evt.stop.callSid);
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
        // ===== DEBUG ADDED =====
        console.log("[bridge] unknown Exotel event:", (evt as { event: string }).event, "raw:", raw.slice(0, 300));
        // ===== DEBUG ADDED =====
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

  return { handleExotelMessage, destroy };
}
