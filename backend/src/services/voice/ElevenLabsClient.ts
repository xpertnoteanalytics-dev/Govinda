// src/services/voice/ElevenLabsClient.ts
//
// Responsibility: own ONE persistent WebSocket connection to ElevenLabs'
// Text-to-Speech stream-input endpoint, for the entire lifetime of a
// single phone call. Connect once on call start, send every flushed
// phrase from PhraseBuffer down the same socket, emit decoded PCM audio
// chunks as they arrive, close once on call end.
//
// Explicitly NEVER reconnects per sentence — that was the #1 requirement
// from the architecture review (a fresh WS per phrase pays the full
// TCP/TLS handshake cost every time, which measured slower from India
// than even ElevenLabs' own plain HTTP streaming endpoint). One socket,
// reused for every phrase, for the whole call.
//
// Message shapes taken directly from ElevenLabs' current API reference:
//   → init:  { text: " ", voice_settings: {...}, xi_api_key }
//   → text:  { text: "<phrase>" }
//   → close: { text: "" }   (empty string, NOT closing the raw socket)
//   ← audio: { audio: "<base64 pcm>", isFinal: boolean, ... }
//
// This file knows nothing about Exotel or OpenAI — it takes phrases in,
// emits audio chunks out, via plain callbacks. TurnStateManager decides
// when to call interrupt(); ElevenLabsClient just executes it.
//
// ── Post-destroy safety ───────────────────────────────────────────────
//
// After close() is called, the raw WebSocket object still exists in
// the Node event loop's message queue. Messages that arrived before the
// close() call (but hadn't been dispatched yet) will still fire the
// registered "message" handler — because the handler is registered on
// the *socket object*, not on this.ws. We guard against this with an
// explicit `this.state !== "closed"` check at the top of the handler:
// if the client is closed, all incoming messages are discarded and
// onAudioChunk is never called. This makes it safe to call close()
// from destroy() and then have the caller drop all references — no
// zombie audio chunks can reach Exotel after the call ends.

import WebSocket from "ws";
import { env } from "../../config/env";

const ELEVENLABS_WS_BASE = "wss://api.elevenlabs.io/v1/text-to-speech";

/**
 * Output format requested from ElevenLabs. pcm_16000 = raw 16-bit PCM,
 * 16kHz mono, no container — the easiest format to resample down to
 * Exotel's required 8kHz slin16, and avoids paying MP3 decode cost on
 * the hot path of every phrase.
 */
const OUTPUT_FORMAT = "pcm_16000";

export interface ElevenLabsClientOptions {
  /** Called for each decoded audio chunk as it streams in. Base64 PCM,
   *  16-bit, 16kHz, mono — caller is responsible for resampling to
   *  whatever the downstream sink (Exotel) needs. */
  onAudioChunk: (base64Pcm16k: string) => void;
  /** Called once ElevenLabs reports isFinal:true for the phrase most
   *  recently flushed — i.e. that phrase's audio is fully generated.
   *  Used by TurnStateManager for mark/bookkeeping. */
  onPhraseAudioComplete?: () => void;
  /**
   * Called on any connection error or unexpected close during a live
   * call. The bridge uses this to trigger graceful call termination
   * (close OpenAI session → let Exotel's normal hangup flow complete).
   * This class does not attempt reconnection on its own.
   */
  onError?: (err: Error) => void;
}

type ConnectionState = "idle" | "connecting" | "open" | "closed";

export class ElevenLabsClient {
  private ws: WebSocket | null = null;
  private state: ConnectionState = "idle";
  private readonly voiceId: string;
  private readonly options: ElevenLabsClientOptions;

  /** Phrases queued because the socket wasn't open yet when send() was
   *  called (e.g. the very first phrase of the call, racing connect()). */
  private readonly pendingPhrases: string[] = [];

  constructor(options: ElevenLabsClientOptions) {
    this.voiceId = env.elevenLabs.voiceId;
    this.options = options;
  }

  /** Open the persistent connection. Call exactly once per call, at
   *  call start. Does NOT wait for an explicit ack from ElevenLabs —
   *  the API has none; text queued before open fires is buffered in
   *  pendingPhrases and flushed in the "open" handler. */
  connect(): void {
    if (this.state === "connecting" || this.state === "open") {
      console.warn(
        "[ElevenLabsClient] connect() called while already connecting/open — ignoring"
      );
      return;
    }
    if (!this.voiceId) {
      this.options.onError?.(
        new Error(
          "[ElevenLabsClient] ELEVENLABS_VOICE_ID is not set. Pick an Indian male voice from " +
          "the ElevenLabs Voice Library, add it to My Voices, copy its voice_id, and set it as " +
          "the ELEVENLABS_VOICE_ID environment variable."
        )
      );
      return;
    }

    this.state = "connecting";

    const url =
      `${ELEVENLABS_WS_BASE}/${this.voiceId}/stream-input` +
      `?model_id=${env.elevenLabs.modelId}` +
      `&output_format=${OUTPUT_FORMAT}` +
      `&auto_mode=true` +          // complete phrases, not tokens — lower latency
      `&inactivity_timeout=180`;   // call-length sessions; default 20s drops mid-call

    this.ws = new WebSocket(url);

    // Capture ws in a local so the event handlers below refer to the
    // socket that was current when connect() was called, not to
    // this.ws (which may be null by the time events fire after close()).
    const capturedWs = this.ws;

    capturedWs.on("open", () => {
      // Guard: if close() was called before the socket finished opening,
      // do nothing and let the socket close itself.
      if (this.state === "closed") {
        capturedWs.close(1000, "closed before open");
        return;
      }
      this.state = "open";
      console.log("[ElevenLabsClient] connected — sending init message");

      this.sendRaw({
        text: " ",  // required first message per ElevenLabs API — a single space, not empty
        voice_settings: {
          speed: 1.0,             // natural conversational speed
          stability: 0.45,        // healthcare-professional tone: steady, not over-expressive
          similarity_boost: 0.8,
        },
        xi_api_key: env.elevenLabs.apiKey,
      });

      // Flush anything queued while connecting.
      while (this.pendingPhrases.length > 0) {
        const phrase = this.pendingPhrases.shift()!;
        this.sendRaw({ text: phrase });
      }
    });

    capturedWs.on("message", (raw: WebSocket.RawData) => {
      // ── Post-destroy guard ─────────────────────────────────────────
      // After close() is called, in-flight messages already in Node's
      // event loop queue will still fire this handler. Check state here
      // and silently discard — this prevents onAudioChunk from reaching
      // Exotel after the call has ended or after a bridge destroy().
      if (this.state === "closed") {
        return;
      }

      let msg: { audio?: string; isFinal?: boolean; error?: string };
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        console.warn("[ElevenLabsClient] non-JSON message, ignoring");
        return;
      }

      if (msg.audio) {
        this.options.onAudioChunk(msg.audio);
      }
      if (msg.isFinal) {
        this.options.onPhraseAudioComplete?.();
      }
      if (msg.error) {
        console.error("[ElevenLabsClient] error message from server:", msg.error);
      }
    });

    capturedWs.on("close", (code: number, reason: Buffer) => {
      // Only update state if this is still the active socket (not a
      // stale socket from before a reconnect attempt — though we never
      // reconnect in this design, the guard is cheap insurance).
      if (capturedWs === this.ws || this.state !== "closed") {
        console.log(
          `[ElevenLabsClient] closed — code=${code} reason=${reason.toString() || "(none)"}`
        );
        this.state = "closed";
        this.ws = null;
      }
    });

    capturedWs.on("error", (err: Error) => {
      console.error("[ElevenLabsClient] connection error:", err.message);
      // Only surface the error if we're not already in a deliberate
      // close — a close() call followed by a delayed error event is
      // expected and should not trigger the bridge's error handler.
      if (this.state !== "closed") {
        this.options.onError?.(err);
      }
    });
  }

  /** Send one completed phrase down the existing socket. If the socket
   *  isn't open yet (rare race at call start), the phrase is queued and
   *  flushed automatically once connect() finishes opening. */
  sendPhrase(phrase: string): void {
    const trimmed = phrase.trim();
    if (!trimmed) return;

    if (this.state === "open") {
      this.sendRaw({ text: trimmed + " " }); // trailing space per ElevenLabs convention
    } else if (this.state === "connecting") {
      this.pendingPhrases.push(trimmed + " ");
    } else {
      console.warn(
        `[ElevenLabsClient] sendPhrase() called while state="${this.state}" — phrase dropped: ` +
        `"${trimmed.slice(0, 40)}..."`
      );
    }
  }

  /**
   * Interruption support: discard anything queued locally that hasn't
   * been sent yet. Does NOT close or reconnect the socket — the
   * persistent connection must survive interruptions for the rest of
   * the call. The actual stop-the-audio work is the Exotel `clear`
   * event (sent by TurnStateManager) and the epoch guard in the bridge's
   * onAudioChunk closure. This only prevents queued-but-unsent text.
   */
  discardPending(): void {
    if (this.pendingPhrases.length > 0) {
      console.log(
        `[ElevenLabsClient] discarding ${this.pendingPhrases.length} queued phrase(s) on interruption`
      );
      this.pendingPhrases.length = 0;
    }
  }

  /**
   * Close the persistent connection. Call exactly once, at call end.
   * Safe to call multiple times — second and subsequent calls are
   * no-ops (guarded by the `if (!this.ws) return` check).
   */
  close(): void {
    // Mark closed immediately — this is what the post-destroy guard in
    // the "message" handler checks. Any audio chunks that arrive after
    // this point in the event loop will see state==="closed" and be
    // discarded before reaching onAudioChunk.
    this.state = "closed";
    this.pendingPhrases.length = 0;

    if (!this.ws) return;
    try {
      if (this.ws.readyState === WebSocket.OPEN) {
        // Empty-string text message is ElevenLabs' documented graceful
        // close signal — distinct from closing the raw WebSocket, and
        // lets any final phrase finish synthesizing if needed.
        this.sendRaw({ text: "" });
      }
      this.ws.close(1000, "call ended");
    } catch {
      // socket may already be closing — safe to ignore
    }
    this.ws = null;
  }

  isOpen(): boolean {
    return this.state === "open";
  }

  private sendRaw(obj: unknown): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
    }
  }
}
