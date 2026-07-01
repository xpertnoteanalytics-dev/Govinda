// src/services/realtimeBridge.ts
//
// Streams audio between Exotel and the voice pipeline. No business logic
// or prompt-writing here — instructions come in via
// options.resolveInstructions, injected by index.ts.
//
// Turn ownership is owned by TurnStateManager; this file wires raw events
// to it and moves bytes between sockets.

import WebSocket from "ws";
import { TurnStateManager } from "./voice/TurnStateManager";
import { PhraseBuffer } from "./voice/PhraseBuffer";
import { ElevenLabsClient } from "./voice/ElevenLabsClient";
import { pcm16kBase64To8kBase64 } from "./voice/pcmResample";

const COMMIT_FALLBACK_MS = 1200;
const MAX_QUEUED_AUDIO_CHUNKS = 500;

interface RealtimeBridgeOptions {
  exotelWs: WebSocket;
  openAiApiKey: string;
  openAiModel: string;
  elevenLabsApiKey: string;
  elevenLabsVoiceId: string;
  callSid: string;
  resolveInstructions: (callSid: string) => Promise<string>;
}

export class RealtimeBridge {
  private openAiWs: WebSocket | null = null;
  private openAiConnectStarted = false;
  private sessionReady = false;

  private audioQueue: string[] = [];

  private turnState: TurnStateManager;
  private phraseBuffer: PhraseBuffer;
  private elevenLabs: ElevenLabsClient;

  private transcriptLines: string[] = [];
  private chunkGeneration = 0;

  private commitFallbackTimer: NodeJS.Timeout | null = null;

  private awaitingFlushCommitAck = false;
  private flushSpeechDetected = false;
  private pendingFlushCommitEventId: string | null = null;

  private flushCommitWatchdog: NodeJS.Timeout | null = null;
  private static readonly FLUSH_COMMIT_WATCHDOG_MS = 6000;
  private static readonly FLUSH_EMPTY_COMMIT_GRACE_MS = 400;

  constructor(private readonly options: RealtimeBridgeOptions) {
    this.phraseBuffer = new PhraseBuffer();

    this.elevenLabs = new ElevenLabsClient({
      onAudioChunk: (base64Pcm16k) => this.onElevenLabsAudioChunk(base64Pcm16k),
      onPhraseAudioComplete: () => {
        this.sendToExotel({
          event: "mark",
          stream_sid: this.options.callSid,
          mark: { name: "elevenlabs_phrase_done" },
        });
      },
      onError: (err) => {
        this.log("[bridge] elevenlabs fatal error — terminating session", { err: err.message });
        if (this.openAiWs && this.openAiWs.readyState === WebSocket.OPEN) {
          this.openAiWs.close(1011, "elevenlabs disconnect");
        }
      },
    });

    this.turnState = new TurnStateManager({
      sendResponseCreate: () => this.sendToOpenAi({ type: "response.create" }),
      sendResponseCancel: () => this.sendToOpenAi({ type: "response.cancel" }),
      discardPhraseBuffer: () => this.phraseBuffer.discard(),
      discardElevenLabsQueue: () => this.elevenLabs.discardPending(),
      clearExotelPlayback: () => this.sendToExotel({ event: "clear", stream_sid: this.options.callSid }),
      log: (message, meta) => this.log(message, meta),
    });

    this.connectOpenAi();
  }

  // ---------------------------------------------------------------------
  // Exotel -> pipeline
  // ---------------------------------------------------------------------

  handleExotelMessage(raw: string): void {
    let event: any;
    try {
      event = JSON.parse(raw);
    } catch (err) {
      this.log("[bridge] failed to parse Exotel message", { err: String(err) });
      return;
    }

    switch (event.event) {
      case "start":
        this.log("[bridge] exotel stream started", { callSid: this.options.callSid });
        break;
      case "media":
        this.onExotelMedia(event.media?.payload);
        break;
      case "stop":
        this.log("[bridge] exotel stream stopped");
        this.destroy();
        break;
      default:
        break;
    }
  }

  private onExotelMedia(payloadBase64: string | undefined): void {
    if (!payloadBase64) return;

    if (!this.sessionReady) {
      if (this.audioQueue.length >= MAX_QUEUED_AUDIO_CHUNKS) {
        this.audioQueue.shift();
      }
      this.audioQueue.push(payloadBase64);
      return;
    }

    this.sendToOpenAi({
      type: "input_audio_buffer.append",
      audio: payloadBase64,
    });
  }

  private flushAudioQueue(): boolean {
    if (this.audioQueue.length === 0) return false;
    for (const payloadBase64 of this.audioQueue) {
      this.sendToOpenAi({
        type: "input_audio_buffer.append",
        audio: payloadBase64,
      });
    }
    this.log("[bridge] flushed queued caller audio", { count: this.audioQueue.length });
    this.audioQueue = [];
    return true;
  }

  // ---------------------------------------------------------------------
  // OpenAI connection
  // ---------------------------------------------------------------------

  private connectOpenAi(): void {
    if (this.openAiConnectStarted) return;
    this.openAiConnectStarted = true;

    const url = `wss://api.openai.com/v1/realtime?model=${this.options.openAiModel}`;
    this.openAiWs = new WebSocket(url, {
      headers: {
        Authorization: `Bearer ${this.options.openAiApiKey}`,
      },
    });

    this.openAiWs.on("open", () => {
      this.log("[bridge] openai socket open", { model: this.options.openAiModel });
    });

    this.openAiWs.on("message", (data) => this.onOpenAiMessage(data.toString()));

    this.openAiWs.on("close", () => {
      this.log("[bridge] openai socket closed");
      this.openAiWs = null;
      this.sessionReady = false;
      this.audioQueue = [];
    });

    this.openAiWs.on("error", (err) => {
      this.log("[bridge] openai socket error", { err: String(err) });
    });
  }

  private async onOpenAiMessage(raw: string): Promise<void> {
    let event: any;
    try {
      event = JSON.parse(raw);
    } catch (err) {
      this.log("[bridge] failed to parse OpenAI message", { err: String(err) });
      return;
    }

    switch (event.type) {
      case "session.created": {
        const instructions = await this.options.resolveInstructions(this.options.callSid);
        this.log("[bridge] session.created — instructions resolved", {
          instructionsLength: instructions.length,
        });

        // Reverted from semantic_vad back to server_vad: semantic_vad's
        // turn-completion classifier was unreliable on this 8kHz μ-law
        // telephony stream, causing inconsistent "sometimes hears you,
        // sometimes doesn't" behavior. server_vad is a simple
        // energy/silence threshold, more predictable on lossy audio.
        // Tuned for Hindi/Hinglish's longer natural pauses vs. English.
        const sessionConfig = {
          type: "realtime" as const,
          instructions,
          output_modalities: ["text"],
          audio: {
            input: {
              format: {
                type: "audio/pcmu", // confirm vs Exotel's actual encoding
              },
              turn_detection: {
                type: "server_vad" as const,
                threshold: 0.5,
                prefix_padding_ms: 300,
                silence_duration_ms: 900,
                create_response: false,
                interrupt_response: true,
              },
            },
          },
        };

        // Logged explicitly so it's verifiable from Render logs which
        // VAD type/settings are actually live on a given deploy, instead
        // of having to infer it from behavior.
        this.log("[bridge] sending session.update", {
          turnDetectionType: sessionConfig.audio.input.turn_detection.type,
          silenceDurationMs: sessionConfig.audio.input.turn_detection.silence_duration_ms,
          threshold: sessionConfig.audio.input.turn_detection.threshold,
        });

        this.sendToOpenAi({
          type: "session.update",
          session: sessionConfig,
        });
        break;
      }

      case "session.updated": {
        this.sessionReady = true;
        this.elevenLabs.connect();

        const hadQueuedAudio = this.flushAudioQueue();

        if (!hadQueuedAudio) {
          this.turnState.requestGreeting();
        } else {
          this.awaitingFlushCommitAck = true;
          this.flushSpeechDetected = false;
          this.pendingFlushCommitEventId = `flush-commit-${this.options.callSid}-${Date.now()}`;
          this.sendToOpenAi({
            type: "input_audio_buffer.commit",
            event_id: this.pendingFlushCommitEventId,
          });

          this.clearFlushCommitWatchdog();
          this.flushCommitWatchdog = setTimeout(() => {
            if (!this.awaitingFlushCommitAck) return;
            this.log("[bridge] flush commit ack watchdog fired, forcing resolution", {
              flushSpeechDetected: this.flushSpeechDetected,
              callerState: this.turnState.getCallerState(),
            });
            this.resolveStartupIntent();
          }, RealtimeBridge.FLUSH_COMMIT_WATCHDOG_MS);
        }
        break;
      }

      case "input_audio_buffer.speech_started":
        if (this.awaitingFlushCommitAck) {
          this.flushSpeechDetected = true;
        }
        this.turnState.onSpeechStarted();
        break;

      case "input_audio_buffer.speech_stopped":
        this.turnState.onSpeechStopped();
        this.scheduleCommitFallback();
        break;

      case "input_audio_buffer.committed":
        this.clearCommitFallback();
        if (this.awaitingFlushCommitAck) {
          this.clearFlushCommitWatchdog();
          this.resolveStartupIntent();
          break;
        }
        this.turnState.onBufferCommitted();
        break;

      case "response.created": {
        const responseId = event.response?.id;
        if (!responseId) {
          this.log("[bridge] response.created missing response.id, ignoring", { event });
          break;
        }
        this.turnState.onResponseCreated(responseId);
        break;
      }

      case "response.output_text.delta":
        if (this.turnState.shouldForwardText(event.response_id)) {
          const phrase = this.phraseBuffer.push(event.delta ?? "");
          if (phrase) {
            this.flushPhraseToElevenLabs(phrase);
          }
        }
        break;

      case "response.output_text.done":
        if (this.turnState.shouldForwardText(event.response_id)) {
          const remaining = this.phraseBuffer.flushRemaining();
          if (remaining) {
            this.flushPhraseToElevenLabs(remaining);
          }
        }
        break;

      case "response.done": {
        const responseId = event.response?.id;
        if (!responseId) {
          this.log("[bridge] response.done missing response.id, ignoring", { event });
          break;
        }
        this.turnState.onResponseDone(responseId, event.response?.status);
        break;
      }

      case "error": {
        const errorEventId = event.error?.event_id ?? event.event_id;
        const isFlushCommitError =
          this.awaitingFlushCommitAck &&
          this.pendingFlushCommitEventId !== null &&
          errorEventId === this.pendingFlushCommitEventId;

        if (isFlushCommitError) {
          this.clearFlushCommitWatchdog();

          if (event.error?.code === "input_audio_buffer_commit_empty") {
            setTimeout(() => this.resolveStartupIntent(), RealtimeBridge.FLUSH_EMPTY_COMMIT_GRACE_MS);
          } else {
            this.resolveStartupIntent();
          }
        }
        this.log("[bridge] openai error event", { error: event.error });
        break;
      }

      default:
        break;
    }
  }

  // ---------------------------------------------------------------------
  // Startup resolution
  // ---------------------------------------------------------------------

  private resolveStartupIntent(): void {
    this.awaitingFlushCommitAck = false;
    this.pendingFlushCommitEventId = null;

    if (this.flushSpeechDetected) {
      this.turnState.onBufferCommitted();
      return;
    }

    if (this.turnState.getCallerState() === "idle") {
      this.turnState.requestGreeting();
    } else {
      this.log("[bridge] startup resolution: caller no longer idle, skipping greeting request", {
        callerState: this.turnState.getCallerState(),
      });
    }
  }

  private scheduleCommitFallback(): void {
    this.clearCommitFallback();
    this.commitFallbackTimer = setTimeout(() => {
      if (this.awaitingFlushCommitAck) {
        this.log("[bridge] skipping commit fallback: flush commit still outstanding");
        return;
      }
      this.log("[bridge] sending manual commit fallback");
      this.sendToOpenAi({ type: "input_audio_buffer.commit" });
    }, COMMIT_FALLBACK_MS);
  }

  private clearCommitFallback(): void {
    if (this.commitFallbackTimer) {
      clearTimeout(this.commitFallbackTimer);
      this.commitFallbackTimer = null;
    }
  }

  private clearFlushCommitWatchdog(): void {
    if (this.flushCommitWatchdog) {
      clearTimeout(this.flushCommitWatchdog);
      this.flushCommitWatchdog = null;
    }
  }

  // ---------------------------------------------------------------------
  // Text -> ElevenLabs -> Exotel
  // ---------------------------------------------------------------------

  private flushPhraseToElevenLabs(phrase: string): void {
    this.transcriptLines.push(phrase);
    this.chunkGeneration = this.turnState.getGeneration();
    this.elevenLabs.sendPhrase(phrase);
  }

  private onElevenLabsAudioChunk(base64Pcm16k: string): void {
    if (this.chunkGeneration !== this.turnState.getGeneration()) {
      return;
    }
    const base64Pcm8k = pcm16kBase64To8kBase64(base64Pcm16k);
    this.sendToExotel({
      event: "media",
      stream_sid: this.options.callSid,
      media: { payload: base64Pcm8k },
    });
  }

  // ---------------------------------------------------------------------
  // Low-level send helpers
  // ---------------------------------------------------------------------

  private sendToOpenAi(payload: Record<string, unknown>): void {
    if (!this.openAiWs || this.openAiWs.readyState !== WebSocket.OPEN) return;
    this.openAiWs.send(JSON.stringify(payload));
  }

  private sendToExotel(payload: Record<string, unknown>): void {
    if (this.options.exotelWs.readyState !== WebSocket.OPEN) return;
    this.options.exotelWs.send(JSON.stringify(payload));
  }

  // ---------------------------------------------------------------------
  // Public accessors
  // ---------------------------------------------------------------------

  getTranscript(): string {
    return this.transcriptLines.join("\n");
  }

  // ---------------------------------------------------------------------
  // Teardown
  // ---------------------------------------------------------------------

  destroy(): void {
    this.clearCommitFallback();
    this.clearFlushCommitWatchdog();
    if (this.openAiWs) {
      this.openAiWs.close();
      this.openAiWs = null;
    }
    this.elevenLabs.close();
    this.audioQueue = [];
    this.sessionReady = false;
  }

  private log(message: string, meta?: Record<string, unknown>): void {
    console.log(message, { callSid: this.options.callSid, ...meta });
  }
}
