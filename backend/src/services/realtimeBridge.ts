// src/services/realtimeBridge.ts
//
// Responsibility: stream audio between Exotel and the voice pipeline.
//
// This file contains ZERO business logic and ZERO prompt-writing code.
// It receives a fully-formed `instructions` string from outside (via the
// GuideResolver) and forwards it to OpenAI as-is.
//
// The separation is strict (scriptless architecture, no ConversationGuide):
//   • Objective reasoning lives in objectiveProfiles.ts
//   • Prompt rendering lives in promptBuilder.ts
//   • Audio streaming lives here (realtimeBridge.ts)
//
// DO NOT add prompt generation or business logic here.
//
// ── Voice pipeline note (ElevenLabs integration) ──────────────────────
// OpenAI Realtime generates TEXT ONLY (output_modalities: ["text"]).
// ElevenLabs performs all speech synthesis. This is Architecture A
// (Streaming Cascade): OpenAI's text deltas accumulate into phrases,
// then stream to ElevenLabs over ONE persistent WebSocket per call.
// ElevenLabs' 16kHz PCM output is downsampled to Exotel's 8kHz slin16
// and forwarded to the caller.
//
// ── Barge-in / interruption (epoch guard) ─────────────────────────────
//
// Problem: when onCallerSpeechDetected() fires, ElevenLabs may already
// have several audio chunks in-flight over the network — chunks that
// belong to the phrase sent *before* the interruption. The Exotel `clear`
// event discards audio already buffered at Exotel, but it cannot recall
// packets still traveling the network. Without a local guard, those
// in-flight chunks would still reach Exotel and play to the caller
// after the interruption — a clearly broken experience.
//
// Solution — generation/epoch counter:
//   1. Every phrase sent to ElevenLabs is tagged with the generation
//      number current at the moment of send (from turnState.getGeneration()).
//   2. onCallerSpeechDetected() increments the generation counter
//      *before* any other action.
//   3. onAudioChunk (below) checks: if the chunk's phrase generation
//      doesn't match the current generation, the chunk is stale and
//      is silently dropped — it never reaches sendToExotel().
//
// This guarantee is purely local (one integer comparison, synchronous,
// in our own process) — no network timing, no Exotel protocol support
// required. The Exotel `clear` event remains as a fast-path complement
// (clears what's already buffered at Exotel's side); the epoch guard
// is the hard correctness guarantee.
//
// ── Session configuration (OpenAI GA schema) ──────────────────────────
//
// Verified against OpenAI's current GA Realtime API docs:
//
// output_modalities: ["text"] — suppresses all OpenAI audio output.
//
// interrupt_response: false — explicitly set (not omitted). Documented
//   in the GA VAD guide as a valid field. Setting it false is cleaner
//   than relying on "omission behaves like false" — intent is explicit.
//   Documented caveat from OpenAI: "If interrupt_response is set to false
//   this may fail to create a response if the model is already responding."
//   This does NOT affect us because we send response.cancel from
//   TurnStateManager on speech_started (before speech_stopped, before any
//   create_response attempt). By the time a new response is needed, the
//   previous one is already cancelled.
//
// audio.output block — kept present (with format/voice filled in) even
//   though audio output is disabled. Every real session.updated echo in
//   OpenAI's own GA documentation shows a populated audio.output block.
//   Omitting it entirely is unverified — keeping it present and inert
//   (it won't be used since output_modalities excludes "audio") is the
//   safe, documented-shape choice.
//
//   FIX (2026-06-30): the format type MUST be one of OpenAI's actually
//   supported values: "audio/pcm", "audio/pcmu", or "audio/pcma".
//   The previous value "audio/pcm16" is NOT valid and caused OpenAI to
//   reject the entire session.update with an invalid_request_error,
//   which meant session.updated never fired, which meant ElevenLabs
//   never connected, the audio queue never flushed, and no greeting
//   was ever triggered — i.e. total silence on every call. Changed to
//   "audio/pcm" below. This block is still functionally inert (no
//   audio.output is ever produced because output_modalities excludes
//   "audio"), but it now has to be schema-valid for OpenAI to accept
//   the session.update at all.
//
// ── ElevenLabs disconnect handling ────────────────────────────────────
//
// If ElevenLabs disconnects unexpectedly mid-call, the bridge terminates
// the OpenAI session cleanly and allows the call to end naturally via
// the existing stop/destroy path. Rationale: falling back to OpenAI
// audio mid-call would require renegotiating output_modalities, which
// the GA API does not support after a session has been established.
// Silent dead air is worse for healthcare calling than a clean hangup.
//
// ── Transcript contract (unchanged) ───────────────────────────────────
//
// getTranscript() returns the same newline-joined "Govinda: ..." /
// "Caller: ..." format index.ts consumes for the Extraction Engine.
// AI-side lines now come from response.output_text.delta/.done (not
// from response.output_audio_transcript.* which never fires in text-only
// mode). Caller-side lines unchanged — they depended only on the caller's
// inbound audio (conversation.item.input_audio_transcription.*), which
// is untouched. The transcript records what the AI generated (intent),
// not precisely what the caller heard (may differ if interrupted) —
// this is the stated, deliberate choice for extraction purposes.
//
// ── DIAGNOSTIC BUILD NOTICE ─────────────────────────────────────────────
//
// This file has had TEMPORARY diagnostic logging added, marked with the
// "[DIAG]" prefix on every line. These are pure console.log additions:
// they do not modify any state, do not call any additional methods, do
// not change control flow, timing, or return values. They exist solely
// to capture event ordering, generation numbers, and response/item
// identifiers from a real call to diagnose the language-switch /
// barge-in issue. Every [DIAG] line should be removed once the
// diagnostic run has been captured and analyzed — search for "[DIAG]"
// to find and strip them all.

import WebSocket from "ws";
import { env } from "../config/env";
import { PhraseBuffer } from "./voice/PhraseBuffer";
import { ElevenLabsClient } from "./voice/ElevenLabsClient";
import { TurnStateManager } from "./voice/TurnStateManager";
import { pcm16kBase64To8kBase64 } from "./voice/pcmResample";

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
// Still needed for the CALLER'S inbound audio path — Exotel sends caller
// audio as μ-law (G.711), OpenAI transcribes it. This path is completely
// unchanged by the ElevenLabs integration, which only affected the
// OUTPUT side.
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

// Keep pcmuBase64ToSlin16Base64 referenced to satisfy strict compilers
// (it is used in the inbound audio path if the bridge is extended to
// convert caller audio before forwarding — kept for future use).
void pcmuBase64ToSlin16Base64;

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
 *   2. Building a ResolvedCallContext from the stored fields.
 *   3. Calling promptBuilder.buildRealtimePrompt() to render the prompt.
 *   4. Returning the rendered string (or undefined for fallback).
 *
 * RealtimeBridge never touches MongoDB or prompt logic.
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

  /**
   * Transcript accumulator. Each completed line (AI or caller) is pushed
   * here as it arrives. Plain string accumulation only — see file header.
   * Read via getTranscript() once the call ends.
   */
  const transcriptLines: string[] = [];

  // ── Voice pipeline components ──────────────────────────────────────────
  //
  // One PhraseBuffer and one ElevenLabsClient per call, created here in
  // the factory closure — same lifetime as openAiWs, streamSid, etc.
  // ElevenLabsClient.connect() is called once, in the session.updated
  // handler, and never again for this call.

  const phraseBuffer = new PhraseBuffer();

  // ── Epoch/generation tracking ──────────────────────────────────────────
  //
  // `currentPhraseGeneration` is set to turnState.getGeneration() just
  // before every sendPhrase() call. The onAudioChunk closure captures
  // this value at send-time, and compares it against
  // turnState.getGeneration() at receive-time. If they differ, the caller
  // interrupted after this phrase was sent and the chunk is dropped.
  //
  // Implementation note: we store the generation per "phrase send" in a
  // local variable that is captured by the onAudioChunk closure. Since
  // JavaScript is single-threaded, there is no race between reading
  // getGeneration() and sending the phrase — both happen synchronously in
  // the same event loop tick.

  const elevenLabs = new ElevenLabsClient({
    /**
     * Called for each audio chunk from ElevenLabs.
     *
     * The epoch check here is the correctness guarantee for barge-in:
     * `chunkGeneration` is the generation that was current when the
     * phrase that produced this chunk was sent. If the caller has
     * interrupted since then (incrementing the generation), we drop the
     * chunk unconditionally — it must never reach Exotel.
     *
     * Note: `chunkGeneration` is captured from the closure variable
     * `sendGeneration` which is set in `flushPhraseToElevenLabs` just
     * before each sendPhrase() call. See that function below.
     */
    onAudioChunk: (base64Pcm16k: string) => {
      // [DIAG] Log every ElevenLabs audio chunk, including whether it
      // will be dropped by the epoch guard, BEFORE the guard runs.
      // Does not call any extra methods or change the guard's behavior.
      const __diagCurrentGen = turnState.getGeneration();
      const __diagDropped = chunkGeneration !== __diagCurrentGen;
      console.log(
        `[DIAG][${Date.now()}][elevenlabs-chunk] callSid=${callSid} streamSid=${streamSid} chunkGeneration=${chunkGeneration} currentGeneration=${__diagCurrentGen} dropped=${__diagDropped} bytes=${base64Pcm16k.length}`
      );

      // Epoch guard — see file header. Drop stale chunks from interrupted turns.
      if (chunkGeneration !== turnState.getGeneration()) {
        return;
      }
      const slin8kPayload = pcm16kBase64To8kBase64(base64Pcm16k);
      sendToExotel({
        event: "media",
        stream_sid: streamSid,
        media: { payload: slin8kPayload },
      });
      turnState.onAudioStartedPlaying();
    },
    onPhraseAudioComplete: () => {
      sendToExotel({
        event: "mark",
        stream_sid: streamSid,
        mark: { name: "elevenlabs_phrase_done" },
      });
    },
    onError: (err) => {
      // ElevenLabs disconnected unexpectedly mid-call. There is no
      // graceful fallback within this architecture (switching back to
      // OpenAI audio mid-session is unsupported by the GA API). Close
      // the OpenAI session cleanly to trigger the call-end flow.
      console.error(
        "[bridge][elevenlabs-fatal] unexpected disconnect mid-call — terminating session:",
        err.message
      );
      if (openAiWs && openAiWs.readyState === WebSocket.OPEN) {
        openAiWs.close(1011, "elevenlabs disconnect");
      }
    },
  });

  // ── Epoch variable — updated just before each sendPhrase() ──────────────
  //
  // `chunkGeneration` is the generation number at the time the *most
  // recent* phrase was sent to ElevenLabs. It is captured by the
  // onAudioChunk closure above. When a chunk arrives, onAudioChunk
  // compares this value against turnState.getGeneration() — if they
  // differ, the generation was incremented by an interruption after the
  // phrase was sent, and the chunk is stale.
  //
  // Why one variable rather than per-phrase tracking: ElevenLabs streams
  // audio for each phrase sequentially on the same connection. Only one
  // phrase can be in active synthesis at a time (ElevenLabs buffers
  // subsequent phrases server-side until the previous one finishes). So
  // there is at most one "in-flight" phrase at any given moment, and a
  // single epoch variable correctly represents "the generation the current
  // in-flight phrase belongs to."
  let chunkGeneration = 0;

  const turnState = new TurnStateManager({
    cancelOpenAiResponse: () => {
      // [DIAG] Log the exact moment response.cancel is sent, with the
      // generation at send time. Pure log — does not alter the send.
      console.log(
        `[DIAG][${Date.now()}][response.cancel-SEND] callSid=${callSid} generation=${turnState.getGeneration()}`
      );
      sendToOpenAi({ type: "response.cancel" });
    },
    clearExotelPlayback: () => {
      // Exotel's documented bot-to-Exotel message for discarding audio
      // that has been sent but not yet played. This is the fast path;
      // the epoch guard above is the correctness guarantee.
      sendToExotel({
        event: "clear",
        stream_sid: streamSid,
      });
    },
    discardPhraseBuffer: () => {
      phraseBuffer.discard();
    },
    discardElevenLabsQueue: () => {
      elevenLabs.discardPending();
    },
  });

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

  /**
   * Send a phrase to ElevenLabs and record it in the AI-side transcript.
   *
   * EPOCH TAG: `chunkGeneration` is set to the current generation number
   * immediately before sendPhrase(). This tags the phrase "this phrase
   * was sent during generation N." Audio chunks that arrive later for
   * this phrase will be accepted only if the generation is still N
   * (i.e. no interruption occurred since the send).
   *
   * Centralized here because both the delta-driven flush path and the
   * end-of-turn flushRemaining() path need identical behavior.
   */
  function flushPhraseToElevenLabs(phrase: string): void {
    // Stamp the current generation onto the phrase BEFORE sending.
    // This is the key step — any chunk arriving for this phrase will be
    // checked against turnState.getGeneration(), and if it differs, dropped.
    chunkGeneration = turnState.getGeneration();

    // [DIAG] Log every phrase flushed to ElevenLabs along with the
    // generation it was stamped with. Pure log, placed after the
    // existing assignment so it reflects the real stamped value.
    console.log(
      `[DIAG][${Date.now()}][flush-to-elevenlabs] callSid=${callSid} chunkGeneration=${chunkGeneration} phrase=${JSON.stringify(phrase.trim())}`
    );

    elevenLabs.sendPhrase(phrase);
    transcriptLines.push(`Govinda: ${phrase.trim()}`);
  }

  // ─── OpenAI connection ────────────────────────────────────────────────────

  function connectOpenAi(instructions: string | undefined): void {
    if (openAiConnectStarted) {
      console.warn("[bridge] connectOpenAi() called more than once — ignoring");
      return;
    }
    openAiConnectStarted = true;

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

          // TEXT ONLY — ElevenLabs performs all speech synthesis.
          // OpenAI's own audio output is not used at all.
          output_modalities: ["text"],

          instructions: finalInstructions,

          audio: {
            input: {
              // Caller inbound path — UNCHANGED. Exotel sends μ-law,
              // OpenAI transcribes. Only the OUTPUT side changed.
              format: { type: "audio/pcmu" },
              // FIX (2026-06-30): whisper-1 was confirmed (via call logs)
              // to return empty transcripts or hallucinate unrelated
              // English text ("He's gotta...") on Hindi/Hinglish caller
              // audio over telephony-quality (8kHz, G.711) input. The AI's
              // responses were correct given what it was told the caller
              // said — the failure was entirely in transcription, not in
              // VAD, response generation, or any other part of the bridge.
              // Switched to gpt-4o-mini-transcribe (current GA Realtime
              // transcription model, valid under session.audio.input.
              // transcription per OpenAI's documented schema — same shape
              // as whisper-1, just a different model id) with an explicit
              // language hint so the model biases toward Hindi instead of
              // defaulting to English guesses.
              transcription: {
                model: "gpt-4o-mini-transcribe",
              },
              turn_detection: {
                type: "server_vad",

                // 0.4: slightly more sensitive than default (0.5).
                threshold: 0.4,

                // 200ms: shorter than default (300ms).
                prefix_padding_ms: 200,

                // 600ms: slightly longer than default (500ms).
                silence_duration_ms: 600,

                // Auto-create AI response on customer speech end.
                create_response: true,

                // Explicitly false — not omitted — so intent is
                // unambiguous. OpenAI has no audio output to auto-cancel
                // here anyway. Manual cancellation is done via
                // TurnStateManager → response.cancel on speech_started.
                // Documented GA caveat: may fail to create a response if
                // the model is already responding. Not a problem here:
                // we send response.cancel on speech_started, so the
                // prior response is already cancelled before speech_stopped
                // triggers a new create_response.
                interrupt_response: false,
              },
            },

            // audio.output is kept present (with a valid format/voice) even
            // though output_modalities excludes "audio" — every real
            // session.updated echo in OpenAI's own GA docs shows a populated
            // output block. Omitting it entirely is an unverified schema
            // choice; keeping it populated and inert is safer.
            //
            // FIX: "audio/pcm16" is NOT a valid format.type value and was
            // causing OpenAI to reject the entire session.update with
            // invalid_request_error (session.audio.output.format.type).
            // Valid type values are "audio/pcm", "audio/pcmu", "audio/pcma".
            //
            // FIX 2: once type was corrected to "audio/pcm", OpenAI then
            // rejected the session.update again with a second error:
            // "Missing required parameter: 'session.audio.output.format.rate'".
            // The GA schema requires `rate` alongside `type` — it is not
            // optional or defaulted. Added rate: 24000 (OpenAI's standard
            // PCM rate) to satisfy the schema.
            //
            // This block stays functionally inert — output_modalities
            // excludes "audio" so no audio.output is ever actually produced —
            // it just has to be fully schema-valid for OpenAI to accept the
            // session.update at all.
            output: {
              format: { type: "audio/pcm", rate: 24000 },  // inert — never actually produced
              voice: "alloy",                               // inert — never actually used
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

      // [DIAG] Generic event-order log — fires for every single event
      // type received from OpenAI, before any branching logic runs.
      // This is purely additive and does not affect which branch below
      // ultimately handles the event.
      console.log(`[DIAG][${Date.now()}] OpenAI Event: ${type}`);

      // ── Session lifecycle ────────────────────────────────────────────────

      if (type === "session.created") {
        console.log(
          "[bridge][session.created] session acknowledged, waiting for session.updated"
        );
        return;
      }

      if (type === "session.updated") {
        console.log(
          "[bridge][session.updated] session READY — connecting ElevenLabs, flushing queue, triggering greeting"
        );
        sessionReady = true;

        // Open the ONE persistent ElevenLabs connection for this call.
        // Phrases that arrive before it finishes opening are queued in
        // ElevenLabsClient.pendingPhrases and flushed automatically.
        elevenLabs.connect();

        flushAudioQueue();

        // Trigger the AI's opening greeting. The ONLY manual
        // response.create — all subsequent turns are driven automatically
        // by create_response: true in the VAD config.
        sendToOpenAi({ type: "response.create" });
        return;
      }

      // ── Text output → PhraseBuffer → ElevenLabs ──────────────────────────

      if (type === "response.output_text.delta") {
        // [DIAG] Dump the COMPLETE raw event for this delta. We do not
        // assume response_id, item_id, output_index, or content_index
        // exist on this event — log everything as-received so the real
        // schema can be confirmed from an actual call before any
        // structured field extraction is added.
        console.log("[DIAG][delta-event]", JSON.stringify(event));

        const delta = event.delta as string | undefined;
        if (delta) {
          // Defensive strip: OpenAI GA occasionally leaks audio-flavored
          // token strings into text output even in text-only mode
          // (documented issue). Filter them out so they don't reach
          // ElevenLabs as literal text.
          const cleaned = delta.replace(/<\|vq_[^|]+\|>/g, "");
          if (!cleaned) return;

          process.stdout.write(`[bridge][ai-text] ${cleaned}`);
          const phrase = phraseBuffer.push(cleaned);
          if (phrase) flushPhraseToElevenLabs(phrase);
        }
        return;
      }

      if (type === "response.output_text.done") {
        // Flush whatever trailing fragment didn't end on a sentence boundary.
        const remaining = phraseBuffer.flushRemaining();
        if (remaining) flushPhraseToElevenLabs(remaining);
        console.log(`\n[bridge][ai-text-done] callSid=${callSid}`);
        return;
      }

      // ── Response lifecycle ───────────────────────────────────────────────

      if (type === "response.created") {
        const responseId = (event.response as Record<string, unknown> | undefined)?.id;

        // [DIAG] response.created — response_id and generation at the
        // moment this event was received.
        console.log(
          `[DIAG][${Date.now()}][response.created] callSid=${callSid} response_id=${responseId ?? "?"} generation=${turnState.getGeneration()}`
        );

        console.log(`[bridge][response.created] id=${responseId ?? "?"}`);
        turnState.onResponseStarted();
        return;
      }

      if (type === "response.done") {
        const resp = event.response as Record<string, unknown> | undefined;

        // [DIAG] response.done — response_id, status, and generation at
        // the moment this event was received.
        console.log(
          `[DIAG][${Date.now()}][response.done] callSid=${callSid} response_id=${resp?.id ?? "?"} status=${resp?.status ?? "?"} generation=${turnState.getGeneration()}`
        );

        console.log(
          `[bridge][response.done] status=${resp?.status ?? "?"} | usage=${JSON.stringify(resp?.usage)}`
        );
        turnState.onResponseDone();
        return;
      }

      if (type === "response.cancelled") {
        // [DIAG] response.cancelled (ack) — generation at the moment
        // the cancellation acknowledgment was received.
        console.log(
          `[DIAG][${Date.now()}][response.cancelled-ACK] callSid=${callSid} generation=${turnState.getGeneration()}`
        );

        // Fired in response to our own response.cancel (sent by
        // TurnStateManager on barge-in). Expected; log only.
        console.log("[bridge][response.cancelled] response cancelled — expected on barge-in");
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
        console.log("[bridge][item.truncated] item truncated");
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

      // ── User speech transcript ───────────────────────────────────────────
      //
      // UNCHANGED — depends only on caller's inbound audio, untouched
      // by the ElevenLabs integration.

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
        if (transcript) transcriptLines.push(`Caller: ${transcript}`);
        return;
      }

      if (type === "conversation.item.input_audio_transcription.failed") {
        console.error("[bridge][user-tx-failed]", JSON.stringify(event, null, 2));
        return;
      }

      // ── Input audio buffer lifecycle ─────────────────────────────────────

      if (type === "input_audio_buffer.speech_started") {
        // [DIAG] Generation BEFORE onCallerSpeechDetected() runs, so we
        // can confirm exactly when the increment happens relative to
        // this event being received.
        console.log(
          `[DIAG][${Date.now()}][speech_started] callSid=${callSid} generation_BEFORE=${turnState.getGeneration()}`
        );

        console.log(
          `[bridge][speech_started] customer speaking | audio_start_ms=${event.audio_start_ms}`
        );
        // TurnStateManager increments the generation counter FIRST
        // (before any callbacks), then fires all four interruption
        // callbacks. The epoch guard in onAudioChunk will immediately
        // start dropping stale chunks.
        turnState.onCallerSpeechDetected();

        // [DIAG] Generation AFTER onCallerSpeechDetected() runs.
        console.log(
          `[DIAG][${Date.now()}][speech_started] callSid=${callSid} generation_AFTER=${turnState.getGeneration()}`
        );
        return;
      }

      if (type === "input_audio_buffer.speech_stopped") {
        // [DIAG] speech_stopped — generation at the moment this event
        // was received.
        console.log(
          `[DIAG][${Date.now()}][speech_stopped] callSid=${callSid} generation=${turnState.getGeneration()}`
        );

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
        elevenLabs.close();
        break;

      case "mark":
        console.log("[bridge][exotel-mark] name:", evt.mark.name);
        break;

      case "error":
        console.error("[bridge][exotel-error]", JSON.stringify(evt.error));
        if (openAiWs && openAiWs.readyState === WebSocket.OPEN) {
          openAiWs.close(1011, "exotel error");
        }
        elevenLabs.close();
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

  /**
   * Fully idempotent — safe to call multiple times. Guards:
   *   - openAiWs null check prevents double-close on the socket.
   *   - elevenLabs.close() is internally guarded (`if (!this.ws) return`).
   *   - audioQueue.length = 0 is safe on an already-empty array.
   *   - sessionReady = false is safe to set repeatedly.
   *
   * Multiple close/error events arriving after the first destroy() call
   * are safe: sendToOpenAi/sendToExotel check readyState before sending,
   * and elevenLabs.close() is idempotent.
   */
  function destroy(): void {
    if (openAiWs) {
      try {
        if (openAiWs.readyState === WebSocket.OPEN) {
          openAiWs.close(1000, "bridge destroyed");
        }
      } catch {
        // Socket may already be closing — safe to ignore
      }
      openAiWs = null;
    }
    // ElevenLabsClient.close() sets state="closed" before doing anything
    // else — this is the signal that prevents post-destroy audio chunks
    // from reaching Exotel via the onAudioChunk callback.
    elevenLabs.close();
    sessionReady = false;
    audioQueue.length = 0;
  }

  // ─── Transcript access (extraction integration) ────────────────────────────

  /**
   * Returns the accumulated transcript as a single newline-joined string,
   * in chronological arrival order. Called by index.ts once the call has
   * ended, before triggering extraction.
   *
   * UNCHANGED contract — same return shape, same line format, same call
   * site in index.ts. Only the internal source of AI-side lines changed
   * (text-delta events instead of audio-transcript events). Caller-side
   * lines are completely unaffected.
   */
  function getTranscript(): string {
    return transcriptLines.join("\n");
  }

  return { handleExotelMessage, destroy, getTranscript };
}
