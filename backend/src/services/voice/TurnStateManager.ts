// src/services/voice/TurnStateManager.ts
//
// Responsibility: the ONE place that knows what state a call turn is in,
// and what to do when the caller interrupts.
//
// Why this class has to exist: before this integration, OpenAI was the
// sole audio producer, and OpenAI's own server VAD (interrupt_response:
// true) auto-cancelled its in-flight audio the instant the caller spoke.
// That gave barge-in "for free." Now ElevenLabs produces the audio the
// caller actually hears, and OpenAI's VAD has no idea ElevenLabs or
// Exotel's playback buffer exist. Something has to manually:
//   1. Stop new ElevenLabs audio chunks from being forwarded to Exotel
//   2. Tell Exotel to discard audio it has already buffered but not
//      yet played (the `clear` event — confirmed in Exotel's official
//      Voicebot Applet / AgentStream docs as the bot-to-Exotel message
//      for exactly this purpose)
//   3. Tell OpenAI to stop generating further text for the interrupted
//      response (response.cancel)
//   4. Discard whatever's sitting in PhraseBuffer / ElevenLabsClient's
//      queue so stale text doesn't get spoken after the fact
//
// This class owns that coordination. It does NOT open sockets itself —
// it's handed small callback functions by realtimeBridge.ts for each
// side-effect, so it has zero direct dependency on the ws library, on
// OpenAI's wire format, or on Exotel's wire format. That keeps it
// independently testable and prevents realtimeBridge.ts from becoming
// a monolith.
//
// ── Generation/epoch mechanism ────────────────────────────────────────
//
// `generation` is a monotonically increasing integer. It increments
// once per caller-speech-detected event (i.e. once per barge-in, plus
// the defensive call when the caller speaks during idle). Every phrase
// sent to ElevenLabs is tagged with the generation number current at
// the moment of send. When an ElevenLabs audio chunk arrives, the
// bridge compares its phrase's generation against the current generation:
// if they differ, the chunk is dropped without reaching Exotel.
//
// This guarantees correctness under any network timing: the comparison
// is a local synchronous integer check — it does not depend on the
// `clear` event reaching Exotel before the in-flight chunk does.
// The `clear` event is a best-effort fast path; the epoch guard is the
// hard guarantee. Together they eliminate the stale-audio race entirely.
//
// Memory: one integer, no Maps or arrays. Zero unbounded growth.

export type TurnState = "idle" | "generating" | "speaking" | "interrupted";

export interface TurnStateManagerCallbacks {
  /** Send response.cancel to OpenAI — stop generating further text for
   *  the current response. No-op safe to call even if nothing is
   *  in-flight; the bridge's sendToOpenAi() already no-ops on closed
   *  sockets. */
  cancelOpenAiResponse: () => void;
  /** Send the Exotel `clear` event for the active stream — discards
   *  audio Exotel has buffered but not yet played. Best-effort fast
   *  path; correctness is guaranteed by the epoch guard, not by this. */
  clearExotelPlayback: () => void;
  /** Discard text sitting in PhraseBuffer that hasn't been flushed to
   *  ElevenLabs yet. */
  discardPhraseBuffer: () => void;
  /** Discard phrases queued in ElevenLabsClient that haven't been sent
   *  down the socket yet (does not close the socket). */
  discardElevenLabsQueue: () => void;
}

export class TurnStateManager {
  private state: TurnState = "idle";
  private readonly callbacks: TurnStateManagerCallbacks;

  /**
   * Monotonically increasing generation counter. Incremented on every
   * onCallerSpeechDetected() call — which fires once per barge-in, and
   * defensively once when the caller speaks during idle. Never wraps;
   * a 32-bit integer supports ~4 billion interruptions per call, which
   * is not a real constraint.
   *
   * Read externally via getGeneration() so the bridge can tag each
   * outgoing phrase before send, then compare on audio chunk arrival.
   */
  private generation = 0;

  constructor(callbacks: TurnStateManagerCallbacks) {
    this.callbacks = callbacks;
  }

  getState(): TurnState {
    return this.state;
  }

  /**
   * Returns the current generation number. The bridge reads this
   * immediately before calling elevenLabs.sendPhrase() to tag the
   * phrase, and reads it again inside onAudioChunk to check if the
   * chunk's phrase generation still matches. If not, the chunk is
   * stale (the caller interrupted after that phrase was sent) and
   * must be dropped.
   *
   * This is the only public addition to the API surface vs. the
   * original TurnStateManager — all existing methods are unchanged.
   */
  getGeneration(): number {
    return this.generation;
  }

  /** Call when OpenAI starts generating a new response
   *  (response.created). */
  onResponseStarted(): void {
    if (this.state === "interrupted") {
      // A new turn naturally supersedes the interrupted state.
      console.log(
        "[TurnStateManager] new response started after interruption — resetting to generating"
      );
    }
    this.state = "generating";
  }

  /** Call when the first ElevenLabs audio chunk for this turn has been
   *  forwarded to Exotel — i.e. the caller has started actually hearing
   *  something. */
  onAudioStartedPlaying(): void {
    if (this.state === "generating") {
      this.state = "speaking";
    }
  }

  /** Call when OpenAI signals response.done — text generation for this
   *  turn is fully complete. Does not by itself mean playback is done;
   *  ElevenLabs may still be synthesizing/streaming the final phrase. */
  onResponseDone(): void {
    if (this.state !== "interrupted") {
      this.state = "idle";
    }
  }

  /**
   * Call when OpenAI's input_audio_buffer.speech_started fires — the
   * caller has started talking. This is the single entry point for all
   * barge-in handling. Safe to call even when state is "idle" (e.g.
   * the caller speaks during a natural silence) — every callback below
   * is safe to invoke regardless of prior state.
   *
   * Generation increment MUST happen first, before any callback. This
   * guarantees that any audio chunk that arrives after this point
   * (even nanoseconds later in the JS event loop) will see the new
   * generation number and be dropped.
   */
  onCallerSpeechDetected(): void {
    // ── INCREMENT FIRST — before callbacks, before anything else ──────
    // This is the atomic "invalidate all prior phrases" operation.
    // Any audio chunk that arrives after this line carries a stale
    // generation tag and will be dropped by the bridge's epoch check.
    this.generation += 1;
    const currentGen = this.generation;

    const previousState = this.state;
    this.state = "interrupted";

    if (previousState === "idle") {
      // Nothing was being generated or played — still worth clearing
      // defensively in case a very-last chunk is mid-flight to Exotel,
      // but this is the common "normal turn-taking" case, not a real
      // barge-in. Log at a lower noise level.
      console.log(
        `[TurnStateManager] caller spoke during idle — defensive clear (gen=${currentGen})`
      );
    } else {
      console.log(
        `[TurnStateManager] BARGE-IN — interrupting turn ` +
        `(was: ${previousState}, gen=${currentGen})`
      );
    }

    this.callbacks.cancelOpenAiResponse();
    this.callbacks.clearExotelPlayback();
    this.callbacks.discardPhraseBuffer();
    this.callbacks.discardElevenLabsQueue();
  }

  /** Reset to idle. Called at the start of each fresh listen→respond
   *  cycle if needed, or defensively after a hangup-adjacent error. */
  reset(): void {
    this.state = "idle";
  }
}
