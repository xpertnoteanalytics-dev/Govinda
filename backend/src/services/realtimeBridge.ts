// src/services/realtimeBridge.ts
import WebSocket from "ws";
import { env } from "../config/env";

const OPENAI_REALTIME_URL =
  "wss://api.openai.com/v1/realtime?model=gpt-realtime-1.5";

type ExotelEvent =
  | { event: "connected"; protocol: string; version: string }
  | { event: "start"; start: { callSid: string; customParameters?: Record<string, string> } }
  | { event: "media"; media: { chunk: number; timestamp: string; payload: string } }
  | { event: "stop"; stop: { callSid: string } }
  | { event: "error"; error: { code: string; message: string } };

export function createRealtimeBridge(exotelWs: WebSocket, script?: string) {
  let openAiWs: WebSocket | null = null;
  let streamSid = "";
  let sessionReady = false;
  const audioQueue: string[] = [];

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

  function connectOpenAi() {
    openAiWs = new WebSocket(OPENAI_REALTIME_URL, {
      headers: {
        Authorization: `Bearer ${env.openai.apiKey}`,
      },
    });

    openAiWs.on("open", () => {
      console.log("[bridge] OpenAI Realtime connected");

      sendToOpenAi({
        type: "session.update",
        session: {
          modalities: ["audio", "text"],
          instructions: script
            ? `You are an AI calling assistant. Your script: ${script}`
            : "You are a helpful AI calling assistant. Be concise and professional.",
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

      if (type === "session.created" || type === "session.updated") {
        sessionReady = true;
        flushQueue();
        // Trigger AI to speak first (greeting)
        sendToOpenAi({ type: "response.create" });
        return;
      }

      if (type === "response.audio.delta") {
        const delta = event.delta as string | undefined;
        if (delta && exotelWs.readyState === WebSocket.OPEN) {
          exotelWs.send(
            JSON.stringify({
              event: "media",
              streamSid,
              media: { payload: delta },
            })
          );
        }
        return;
      }

      if (type === "response.audio.done") {
        if (exotelWs.readyState === WebSocket.OPEN) {
          exotelWs.send(
            JSON.stringify({ event: "mark", streamSid, mark: { name: "ai_done" } })
          );
        }
        return;
      }

      if (type === "error") {
        console.error("[bridge] OpenAI Realtime error", event.error);
      }
    });

    openAiWs.on("close", (code, reason) => {
      console.log("[bridge] OpenAI Realtime closed", code, reason.toString());
      openAiWs = null;
    });

    openAiWs.on("error", (err) => {
      console.error("[bridge] OpenAI Realtime WS error", err.message);
    });
  }

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
        streamSid = evt.start.callSid;
        console.log("[bridge] stream started, callSid:", streamSid);
        connectOpenAi();
        break;

      case "media": {
        const payload = evt.media.payload;
        if (sessionReady) {
          sendToOpenAi({ type: "input_audio_buffer.append", audio: payload });
        } else {
          audioQueue.push(payload);
        }
        break;
      }

      case "stop":
        console.log("[bridge] Exotel stream stopped, callSid:", evt.stop.callSid);
        if (openAiWs && openAiWs.readyState === WebSocket.OPEN) {
          sendToOpenAi({ type: "input_audio_buffer.commit" });
          openAiWs.close(1000, "call ended");
        }
        break;

      case "error":
        console.error("[bridge] Exotel error:", evt.error);
        if (openAiWs && openAiWs.readyState === WebSocket.OPEN) {
          openAiWs.close(1011, "exotel error");
        }
        break;

      default:
        console.log("[bridge] unknown Exotel event:", (evt as { event: string }).event);
    }
  }

  function destroy() {
    if (openAiWs) {
      try {
        openAiWs.close(1000, "bridge destroyed");
      } catch {
        // ignore
      }
      openAiWs = null;
    }
  }

  return { handleExotelMessage, destroy };
}