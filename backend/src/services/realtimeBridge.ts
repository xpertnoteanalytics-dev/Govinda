// src/services/realtimeBridge.ts
//
// Responsibility: stream audio between Exotel and the voice pipeline.
//
// This file contains ZERO business logic and ZERO prompt-writing code.
// It receives a fully-formed instructions string from outside (via the
// GuideResolver) and forwards it to OpenAI as-is.
//
// Turn ownership (who may speak, when, and whether a given response's
// output is still valid) is owned entirely by TurnStateManager. This file
// only wires raw events to it and moves bytes between sockets.

import WebSocket from "ws";
import { TurnStateManager } from "./voice/TurnStateManager";
import { PhraseBuffer } from "./voice/PhraseBuffer";
import { ElevenLabsClient } from "./voice/ElevenLabsClient";
import { pcm16kBase64To8kBase64 } from "./voice/pcmResample";
import { resolveGuideInstructions } from "./voice/GuideResolver";

const COMMIT_FALLBACK_MS = 1200;
const MAX_QUEUED_AUDIO_CHUNKS = 500;

interface RealtimeBridgeOptions {
  exotelWs: WebSocket;
  openAiApiKey: string;
  openAiModel: string;
  elevenLabsApiKey: string;
  elevenLabsVoiceId: string;
  callSid: string;
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

  // Tracks whether we are waiting on a deterministic OpenAI acknowledgement
  // for audio that was flushed from the pre-session queue, before the
  // greeting may be requested.
  //
  // CORRELATION NOTE: the Realtime API echoes a client-supplied event_id
  // back on error events, but does NOT echo it back on
  // input_audio_buffer.committed (that event only carries its own
  // server-generated event_id and an item_id). This means a "committed"
  // ack cannot be positively correlated to the specific commit request
  // that caused it. The only sound guarantee available given that gap is
  // to ensure at most one manual commit is ever outstanding at a time —
  // WebSocket delivery on a single connection is ordered, so under that
  // constraint the next committed event is unambiguously the answer to
  // whichever commit is currently outstanding. See scheduleCommitFallback().
  private awaitingFlushCommitAck = false;

  // Tracks whether speech_started fired for the flushed pre-session audio
  // at any point while we were waiting on its commit acknowledgement. Used
  // only as one input into resolveStartupIntent() — never trusted alone,
  // see that method for why.
  private flushSpeechDetected = false;

  // The event_id we attach to the forced commit for the flushed pre-session
  // audio. Correlation via this id is only valid against error events
  // (documented echo-back behavior) — NOT against input_audio_buffer.committed.
  private pendingFlushCommitEventId: string | null = null;

  // Liveness backstop: if OpenAI never acknowledges the flush commit
  // (lost committed event, lost error event, socket blip), this guarantees
  // awaitingFlushCommitAck does not stay true forever, which would
  // otherwise permanently block both greeting and reply for the call.
  private flushCommitWatchdog: NodeJS.Timeout | null = null;
  private static readonly FLUSH_COMMIT_WATCHDOG_MS = 6000;

  constructor(private readonly options: RealtimeBridgeOptions) {
    this.phraseBuffer = new PhraseBuffer();

    this.elevenLabs = new ElevenLabsClient({
      apiKey: options.elevenLabsApiKey,
      voiceId: options.elevenLabsVoiceId,
      onAudioChunk: (base64Pcm16k, generation) => this.onElevenLabsAudioChunk(base64Pcm16k, generation),
    });

    this.turnState = new TurnStateManager({
      sendResponseCreate: () => this.sendToOpenAi({ type: "response.create" }),
      sendResponseCancel: () => this.sendToOpenAi({ type: "response.cancel" }),
      discardPhraseBuffer: () => this.phraseBuffer.reset(),
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
        "OpenAI-Beta": "realtime=v1",
      },
    });

    this.openAiWs.on("open", () => {
      this.log("[bridge] openai socket open");
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
        const instructions = await resolveGuideInstructions(this.options.callSid);
        this.sendToOpenAi({
          type: "session.update",
          session: {
            instructions,
            turn_detection: {
              type: "server_vad",
              threshold: 0.4,
              silence_duration_ms: 600,
              create_response: false,
              interrupt_response: true,
            },
          },
        });
        break;
      }

      case "session.updated": {
        this.sessionReady = true;
        this.elevenLabs.connect();

        const hadQueuedAudio = this.flushAudioQueue();

        if (!hadQueuedAudio) {
          // Nothing was buffered before the session was ready, so there is
          // no caller speech that could have raced the greeting. Safe to
          // request immediately.
          this.turnState.requestGreeting();
        } else {
          // Caller audio arrived before we were ready. Force a commit of
          // exactly that audio and wait for OpenAI's deterministic
          // acknowledgement of it before deciding what to do next. This is
          // the only manual commit permitted to be outstanding at this
          // point — see scheduleCommitFallback() for how the fallback timer
          // avoids racing it.
          this.awaitingFlushCommitAck = true;
          this.flushSpeechDetected = false;
          this.pendingFlushCommitEventId = `flush-commit-${this.options.callSid}-${Date.now()}`;
          this.sendToOpenAi({
            type: "input_audio_buffer.commit",
            event_id: this.pendingFlushCommitEventId,
          });

          // Liveness guarantee only: if OpenAI never acknowledges this
          // commit (lost committed event, lost error event, socket blip),
          // awaitingFlushCommitAck must not stay true forever — that would
          // permanently block both greeting and reply. This does not
          // change normal-path behavior; it only fires if no ack arrives
          // within a generous window, and even then it defers to the same
          // shared resolution logic as the normal-path acks.
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
          // The flushed pre-session audio actually contained caller speech.
          // Remember this so the eventual resolution treats it as a reply,
          // not a greeting.
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
          // No event_id correlation is available for this event type (see
          // class-level note). This is sound only because
          // scheduleCommitFallback() guarantees no second manual commit is
          // ever sent while awaitingFlushCommitAck is true, so this is
          // necessarily the ack for the flush commit.
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
          this.phraseBuffer.push(event.delta ?? "");
          const phrase = this.phraseBuffer.maybeFlush();
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
        // event_id IS documented to be echoed back on error events, so
        // this correlation (unlike the committed-event case above) is
        // sound. Only treat this as resolving the flush commit if it is
        // positively correlated to the specific commit request we sent.
        const errorEventId = event.error?.event_id ?? event.event_id;
        if (
          this.awaitingFlushCommitAck &&
          this.pendingFlushCommitEventId !== null &&
          errorEventId === this.pendingFlushCommitEventId
        ) {
          this.clearFlushCommitWatchdog();
          this.resolveStartupIntent();
        }
        this.log("[bridge] openai error event", { error: event.error });
        break;
      }

      default:
        break;
    }
  }

  // ---------------------------------------------------------------------
  // Startup resolution (shared by committed ack, error ack, and watchdog)
  // ---------------------------------------------------------------------

  private resolveStartupIntent(): void {
    this.awaitingFlushCommitAck = false;
    this.pendingFlushCommitEventId = null;

    if (this.flushSpeechDetected) {
      // Speech was positively observed for the flushed audio at some point
      // — always a reply, regardless of how this resolution was triggered.
      this.turnState.onBufferCommitted();
      return;
    }

    // No speech was observed as of this exact moment. Re-check current
    // caller state through the existing gate rather than trusting a
    // point-in-time flag: if the caller has since started speaking (e.g.
    // speech_started arrives just as/after this resolution fires),
    // callerState will no longer be 'idle', and requestGreeting()'s
    // internal gate (maybeCreateResponse) will correctly refuse to fire
    // until the caller finishes. This avoids a stale "no speech yet"
    // snapshot forcing a greeting over a caller who has since started
    // talking.
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
        // The Realtime API does not echo the requesting event_id back on
        // input_audio_buffer.committed, so a committed ack cannot be
        // positively correlated to a specific commit request. The only
        // sound guarantee available is to never have two manual commits
        // outstanding at once. Skip this fallback commit rather than risk
        // its eventual ack being misattributed as the flush ack.
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
    this.elevenLabs.synthesize(phrase, this.chunkGeneration);
  }

  private onElevenLabsAudioChunk(base64Pcm16k: string, generation: number): void {
    if (generation !== this.turnState.getGeneration()) {
      // Epoch guard: this audio belongs to a generation that's since been
      // superseded by a barge-in. Drop it before it reaches Exotel.
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
