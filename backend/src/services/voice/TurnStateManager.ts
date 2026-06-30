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
// once per CONFIRMED barge-in (see performInterruption() below) — never
// just on speech_started in isolation. Every phrase sent to ElevenLabs
// is tagged with the generation number current at the moment of send.
// When an ElevenLabs audio chunk arrives, the bridge compares its
// phrase's generation against the current generation: if they differ,
// the chunk is dropped without reaching Exotel.
//
// This guarantees correctness under any network timing: the comparison
// is a local synchronous integer check — it does not depend on the
// `clear` event reaching Exotel before the in-flight chunk does.
// The `clear` event is a best-effort fast path; the epoch guard is the
// hard guarantee. Together they eliminate the stale-audio race entirely.
//
// ── Startup race / pending-interruption mechanism ──────────────────────
//
// Problem this section solves: OpenAI's server VAD can fire
// speech_started while we are still in "generating" — i.e. text for the
// greeting (or any response) is being produced, but no ElevenLabs audio
// chunk has reached Exotel yet. Two wrong fixes were considered and
// rejected:
//
//   WRONG FIX A — treat every speech_started as a real barge-in
//     regardless of state. This is the original bug: a VAD false
//     positive (or startup-queued caller audio being flushed into
//     OpenAI) cancels the greeting before the caller ever heard it.
//
//   WRONG FIX B — simply ignore speech_started whenever
//     state === "generating". This fixes the false-positive case but
//     creates a new bug: if the caller is a REAL human who starts
//     genuinely talking *while* the greeting is still being generated
//     (a very normal thing for a caller to do — talking over a bot
//     mid-sentence), that interruption is silently dropped on the
//     floor. The assistant's queued/in-flight phrases would still play
//     out in full once audio starts, ignoring a caller who has already
//     started speaking — a real regression in barge-in responsiveness.
//
// CORRECT FIX — defer, don't discard. If speech_started arrives during
// "generating", we don't cancel anything yet (there's no audio playing
// to interrupt, and cancelling OpenAI text generation while ElevenLabs
// has nothing to interrupt buys nothing but risk). Instead we set
// `pendingInterruption = true` and wait. The moment
// onAudioStartedPlaying() fires (i.e. the first real audio chunk has
// reached Exotel and the caller could now actually be hearing the
// assistant), we check the flag: if true, we immediately run the exact
// same interruption logic a normal "speaking"-state barge-in would run,
// then clear the flag.
//
// This means a caller who starts talking mid-generation is never
// ignored — their interruption is honored at the earliest moment it
// becomes meaningful to act on it (when there's actually something
// audible to clear), rather than either firing too early (when there's
// nothing to clear and no benefit) or never firing at all.
//
// Memory: two scalars (generation: number, pendingInterruption:
// boolean), no Maps or arrays. Zero unbounded growth.

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
   * Monotonically increasing generation counter. Incremented exactly
   * once per CONFIRMED barge-in, inside performInterruption() — never
   * directly inside onCallerSpeechDetected() anymore, since a
   * speech_started during "generating" may not result in an
   * interruption being performed at all (yet). Read externally via
   * getGeneration() so the bridge can tag each outgoing phrase before
   * send, then compare on audio chunk arrival.
   */
  private generation = 0;

  /**
   * True when a speech_started event arrived while state === "generating"
   * (no assistant audio has reached Exotel yet) and has not yet been
   * resolved by a real interruption. Cleared the moment
   * performInterruption() runs for it, and also defensively cleared
   * whenever a turn completes normally (onResponseDone) or is reset,
   * so a stale flag from one turn can never leak into the next.
   */
  private pendingInterruption = false;

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
   */
  getGeneration(): number {
    return this.generation;
  }

  /** Call when OpenAI starts generating a new response
   *  (response.created). */
  onResponseStarted(): void {
    if (this.state === "interrupted") {
      console.log(
        "[TurnStateManager] new response started after interruption — resetting to generating"
      );
    }
    this.state = "generating";
  }

  /**
   * Call when the first ElevenLabs audio chunk for this turn has been
   * forwarded to Exotel — i.e. the caller has started actually hearing
   * something.
   *
   * STATE TRANSITION: "generating" → "speaking".
   *
   * This is also the resolution point for any interruption that arrived
   * too early to act on. If the caller spoke while we were still
   * "generating" (pendingInterruption === true), audio is now actually
   * reaching the caller's ear for the first time this turn — which
   * means there is finally something real to cancel/clear/discard. We
   * perform the interruption immediately, exactly once, and clear the
   * flag so it can't fire again for this turn.
   */
  onAudioStartedPlaying(): void {
    if (this.state === "generating") {
      this.state = "speaking";

      if (this.pendingInterruption) {
        this.pendingInterruption = false;
        console.log(
          "[TurnStateManager] resolving deferred interruption — caller spoke " +
          "during generation, assistant audio just started; performing barge-in now"
        );
        this.performInterruption("deferred (caller spoke during generation)");
      }
    }
  }

  /** Call when OpenAI signals response.done — text generation for this
   *  turn is fully complete. Does not by itself mean playback is done;
   *  ElevenLabs may still be synthesizing/streaming the final phrase. */
  onResponseDone(): void {
    if (this.state !== "interrupted") {
      this.state = "idle";
    }
    // Defensive: if a response completed without ever reaching
    // "speaking" (e.g. an empty/near-instant response), any pending
    // interruption flag from this turn is now moot — there is no audio
    // in flight to interrupt, and carrying the flag into the next turn
    // would cause that next turn's first onAudioStartedPlaying() to
    // fire a bogus interruption for a barge-in that's no longer
    // relevant to anything currently playing.
    if (this.pendingInterruption) {
      console.log(
        "[TurnStateManager] response completed while interruption was still " +
        "pending and no audio ever played — discarding stale flag"
      );
      this.pendingInterruption = false;
    }
  }

  /**
   * Call when OpenAI's input_audio_buffer.speech_started fires — the
   * caller has started talking. This is the single entry point for all
   * barge-in handling.
   *
   * Behavior now depends on state:
   *
   *   - "idle": nothing is being generated or played. There is nothing
   *     to interrupt. Ignored (requirement 4) — this is normal
   *     turn-taking (the caller talking into silence), not a barge-in.
   *
   *   - "generating": text is being produced but no audio has reached
   *     Exotel yet. We do NOT cancel/clear/discard anything now (there
   *     is nothing audible to interrupt, and the greeting/response must
   *     be allowed to keep generating). Instead we set
   *     pendingInterruption = true and return — the interruption will
   *     be honored the instant onAudioStartedPlaying() fires. See the
   *     file header for why this is safer than ignoring outright.
   *
   *   - "speaking": assistant audio is actively reaching Exotel. This
   *     is a real, immediate barge-in. Perform the interruption now.
   *
   *   - "interrupted": a barge-in is already in effect for this turn;
   *     treat a further speech_started the same as "speaking" would
   *     have, since the caller is still talking — re-running
   *     performInterruption() is safe/idempotent (it bumps the
   *     generation again, which only further invalidates anything
   *     still stale).
   */
  onCallerSpeechDetected(): void {
    switch (this.state) {
      case "idle":
        console.log(
          "[TurnStateManager] caller speech detected during idle — no active " +
          "turn, not a barge-in, ignoring"
        );
        return;

      case "generating":
        this.pendingInterruption = true;
        console.log(
          "[TurnStateManager] caller speech detected during generation — " +
          "no assistant audio has played yet; deferring interruption until " +
          "audio actually starts"
        );
        return;

      case "speaking":
      case "interrupted":
        this.performInterruption("live barge-in");
        return;
    }
  }

  /**
   * Single source of truth for "actually perform a barge-in." Both the
   * immediate path (speech_started while "speaking") and the deferred
   * path (speech_started during "generating", resolved later in
   * onAudioStartedPlaying) funnel through here — requirement 7, no
   * duplicated interruption logic.
   *
   * Order matters and is unchanged from the original implementation:
   * generation is incremented BEFORE any callback, so any audio chunk
   * already mid-flight is guaranteed to see the new generation number
   * and be dropped by the bridge's epoch check, regardless of which
   * path got us here.
   */
  private performInterruption(reason: string): void {
    this.generation += 1;
    const currentGen = this.generation;

    const previousState = this.state;
    this.state = "interrupted";

    console.log(
      `[TurnStateManager] BARGE-IN (${reason}) — interrupting turn ` +
      `(was: ${previousState}, gen=${currentGen})`
    );

    this.callbacks.cancelOpenAiResponse();
    this.callbacks.clearExotelPlayback();
    this.callbacks.discardPhraseBuffer();
    this.callbacks.discardElevenLabsQueue();
  }

  /** Reset to idle. Called at the start of each fresh listen→respond
   *  cycle if needed, or defensively after a hangup-adjacent error. */
  reset(): void {
    this.state = "idle";
    this.pendingInterruption = false;
  }
}
