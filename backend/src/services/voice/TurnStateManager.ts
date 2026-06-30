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
//      response (response.cancel) — but ONLY when a response is
//      actually active; see hasActiveResponse below
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
// ── Two independent kinds of "interruption" ─────────────────────────
//
// This class draws a hard line between two effects that used to be
// bundled into a single performInterruption() call:
//
//   • Cancelling OpenAI's in-flight text generation (response.cancel).
//     This is cheap, safe to attempt against a response that's already
//     finishing, and should happen as soon as we know the caller is
//     talking AND a response is actually active — there's no reason to
//     wait for audio to start playing before telling OpenAI to stop
//     producing more text nobody will hear.
//
//   • The audio-pipeline interruption: bumping the generation epoch,
//     telling Exotel to clear its buffer, and discarding
//     PhraseBuffer/ElevenLabs queues. These only matter once assistant
//     audio has actually reached (or is about to reach) the caller's
//     ear. Running them with nothing audible in flight has no effect to
//     protect and would only burn a generation number for no reason.
//
// Splitting these lets us cancel OpenAI immediately (fixing the race
// where server VAD's create_response fires while a stale response is
// still generating) without re-introducing the old bug where the
// audio-side effects fired too early and killed a greeting that hadn't
// played yet.
//
// ── hasActiveResponse ──────────────────────────────────────────────
//
// response.cancel must never be sent against a response OpenAI already
// considers finished — doing so is unnecessary traffic at best and, in
// the "speaking"/"interrupted" case (where assistant audio may still be
// finishing playback well after response.done arrived), would be a
// cancel call with literally nothing on the other end to cancel.
// `hasActiveResponse` is a boolean mirror of "does OpenAI currently
// believe a response is in flight," driven purely off lifecycle events
// the bridge forwards from OpenAI (response.created → true,
// response.done → false, covering every terminal status — completed,
// cancelled, and failed — since GA delivers all of them through
// response.done). It gates every response.cancel call this class makes,
// in both the "generating" path and the "speaking"/"interrupted" path.
//
// IMPORTANT — single-response assumption: this is one boolean, not a
// set or map, because this state machine guarantees at most one OpenAI
// response is ever in flight at a time (a new response is only started
// after the previous turn reached "idle" or "interrupted" — see
// onResponseStarted). If overlapping/concurrent responses are ever
// introduced, this boolean MUST be replaced with response-ID-keyed
// state (e.g. a Set<string> of active response IDs, or
// activeResponseId: string | null compared against the ID on each
// terminal event) — otherwise an out-of-order or overlapping
// response.done could clobber the flag for a different, still-active
// response. Do not extend this boolean's usage past the single-response
// model without making that change first.
//
// ── Generation/epoch mechanism ────────────────────────────────────────
//
// `generation` is a monotonically increasing integer. It increments
// once per CONFIRMED audio-side interruption (see
// performAudioInterruption() below) — never on response.cancel alone,
// and never just on speech_started in isolation. Every phrase sent to
// ElevenLabs is tagged with the generation number current at the moment
// of send. When an ElevenLabs audio chunk arrives, the bridge compares
// its phrase's generation against the current generation: if they
// differ, the chunk is dropped without reaching Exotel.
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
//   WRONG FIX A — treat every speech_started as a real audio-side
//     barge-in regardless of state. This is the original bug: a VAD
//     false positive (or startup-queued caller audio being flushed into
//     OpenAI) cancels the greeting's audio pipeline before the caller
//     ever heard it.
//
//   WRONG FIX B — simply ignore speech_started whenever
//     state === "generating". This fixes the false-positive case but
//     creates two new bugs: (a) a REAL human talking over the bot
//     mid-generation has their barge-in silently dropped, and (b) if a
//     response is genuinely still active, OpenAI's server VAD may
//     attempt create_response on speech_stopped while the old response
//     is still generating — the documented GA caveat — because nothing
//     ever told OpenAI to stop it.
//
// CORRECT FIX — split the two effects and defer only the audio side. If
// speech_started arrives during "generating":
//   - If hasActiveResponse is true, send response.cancel immediately.
//     This costs nothing if the response was about to finish anyway,
//     and is required if it wasn't.
//   - Set pendingInterruption = true regardless, and wait. There's no
//     audio playing yet to interrupt, so clearExotelPlayback/buffer
//     discards/generation bump all stay deferred.
// The moment onAudioStartedPlaying() fires (i.e. the first real audio
// chunk has reached Exotel and the caller could now actually be hearing
// the assistant), we check the flag: if true, we run the audio-side
// interruption immediately, then clear the flag. response.cancel is
// NOT resent at that point — it was already sent (or correctly skipped,
// if there was nothing active) the moment speech_started fired.
//
// This means a caller who starts talking mid-generation is never
// ignored on either axis: OpenAI is told to stop generating as soon as
// that's meaningful, and the audio pipeline is cleared at the earliest
// moment doing so actually protects something audible.
//
// Memory: three scalars (generation: number, pendingInterruption:
// boolean, hasActiveResponse: boolean), no Maps or arrays. Zero
// unbounded growth.

export type TurnState = "idle" | "generating" | "speaking" | "interrupted";

export interface TurnStateManagerCallbacks {
  /** Send response.cancel to OpenAI — stop generating further text for
   *  the current response. Only ever called by this class when
   *  hasActiveResponse is true, so callers can assume there is
   *  something genuinely active to cancel. Still safe to be a no-op
   *  against a response that finishes in the same tick. */
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
   * once per CONFIRMED audio-side interruption, inside
   * performAudioInterruption() — never on a response.cancel call alone.
   * Read externally via getGeneration() so the bridge can tag each
   * outgoing phrase before send, then compare on audio chunk arrival.
   */
  private generation = 0;

  /**
   * True when a speech_started event arrived while state === "generating"
   * (no assistant audio has reached Exotel yet) and the audio-side
   * interruption has not yet been resolved. Cleared the moment
   * performAudioInterruption() runs for it, and also defensively cleared
   * whenever a turn completes normally (onResponseDone) or is reset, so
   * a stale flag from one turn can never leak into the next.
   */
  private pendingInterruption = false;

  /**
   * True from the moment response.created fires until response.done
   * fires for that response (response.done covers every terminal
   * status — completed, cancelled, failed — under the GA schema, so a
   * single event is sufficient to clear this). This is the single gate
   * for every response.cancel call this class makes — both the
   * "generating"-state speech_started path and the
   * "speaking"/"interrupted" live barge-in path — so we never send
   * response.cancel against a response OpenAI already considers
   * finished. Defensively reset to false in reset() so it can never
   * leak between calls.
   *
   * See the file header for why this is a single boolean rather than
   * response-ID-keyed state, and what would need to change if that
   * single-response assumption is ever broken.
   */
  private hasActiveResponse = false;

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
    this.hasActiveResponse = true;
  }

  /**
   * Call when the first ElevenLabs audio chunk for this turn has been
   * forwarded to Exotel — i.e. the caller has started actually hearing
   * something.
   *
   * STATE TRANSITION: "generating" → "speaking".
   *
   * This is also the resolution point for any audio-side interruption
   * that arrived too early to act on. If the caller spoke while we were
   * still "generating" (pendingInterruption === true), the OpenAI-side
   * cancel was already sent at that moment (if there was anything
   * active to cancel) — only the audio-pipeline side was deferred.
   * Audio is now actually reaching the caller's ear for the first time
   * this turn, so we perform the audio-side interruption immediately,
   * exactly once, and clear the flag so it can't fire again for this
   * turn.
   */
  onAudioStartedPlaying(): void {
    if (this.state === "generating") {
      this.state = "speaking";

      if (this.pendingInterruption) {
        this.pendingInterruption = false;
        console.log(
          "[TurnStateManager] resolving deferred interruption — caller spoke " +
          "during generation (response.cancel already handled at that time); " +
          "assistant audio just started, performing audio-side barge-in now"
        );
        this.performAudioInterruption("deferred (caller spoke during generation)");
      }
    }
  }

  /** Call when OpenAI signals response.done — text generation for this
   *  turn is fully complete, regardless of whether it completed
   *  normally, was cancelled, or failed (GA delivers all three terminal
   *  statuses through this single event). Does not by itself mean
   *  playback is done; ElevenLabs may still be synthesizing/streaming
   *  the final phrase. */
  onResponseDone(): void {
    this.hasActiveResponse = false;

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
   *     to interrupt. Ignored — this is normal turn-taking (the caller
   *     talking into silence), not a barge-in.
   *
   *   - "generating": text may be being produced but no audio has
   *     reached Exotel yet.
   *       - If hasActiveResponse is true, send response.cancel
   *         immediately — this is the fix for OpenAI's server VAD
   *         otherwise attempting create_response while the old response
   *         is still generating. If hasActiveResponse is false, there
   *         is nothing to cancel; skip it, matching prior behavior.
   *       - Either way, set pendingInterruption = true. The audio-side
   *         effects (Exotel clear, buffer discards, generation bump)
   *         still wait for actual playback — there is nothing audible
   *         yet to protect.
   *
   *   - "speaking": assistant audio is actively reaching Exotel. This
   *     is a real, immediate barge-in. Send response.cancel only if
   *     hasActiveResponse is true (the response may have already
   *     completed while audio was still finishing playback), and
   *     always perform the audio-side interruption.
   *
   *   - "interrupted": a barge-in is already in effect for this turn;
   *     treat a further speech_started the same as "speaking" would
   *     have, since the caller is still talking — re-running
   *     performAudioInterruption() is safe/idempotent (it bumps the
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
        if (this.hasActiveResponse) {
          this.cancelOpenAiResponseNow("caller spoke during generation");
          console.log(
            "[TurnStateManager] caller speech detected during generation — " +
            "active response found, response.cancel sent immediately; " +
            "audio-side interruption deferred until playback actually starts"
          );
        } else {
          console.log(
            "[TurnStateManager] caller speech detected during generation — " +
            "no active OpenAI response to cancel; deferring audio-side " +
            "interruption until playback actually starts"
          );
        }
        this.pendingInterruption = true;
        return;

      case "speaking":
      case "interrupted":
        if (this.hasActiveResponse) {
          this.cancelOpenAiResponseNow("live barge-in");
        } else {
          console.log(
            "[TurnStateManager] live barge-in — response already completed " +
            "(audio still finishing playback), skipping response.cancel"
          );
        }
        this.performAudioInterruption("live barge-in");
        return;
    }
  }

  /**
   * Cancels the in-progress OpenAI response. Only ever invoked when
   * hasActiveResponse is true (see call sites in
   * onCallerSpeechDetected), so this never fires against a response
   * OpenAI already considers finished. Does not touch `state`,
   * `generation`, or any of the audio-pipeline callbacks — it only
   * ever stops OpenAI from continuing to generate text for a response
   * that's about to be superseded or abandoned.
   */
  private cancelOpenAiResponseNow(reason: string): void {
    console.log(
      `[TurnStateManager] response.cancel (${reason}) — state=${this.state}`
    );
    this.callbacks.cancelOpenAiResponse();
  }

  /**
   * Performs the audio-pipeline side of a real barge-in: bumps the
   * generation epoch, clears Exotel's buffered playback, and discards
   * PhraseBuffer/ElevenLabs queues. This must only run when assistant
   * audio has actually reached (or is actively reaching) Exotel —
   * either a live "speaking"/"interrupted" barge-in, or the deferred
   * resolution in onAudioStartedPlaying() — since these are exactly
   * the operations that protect the stale-audio epoch guard and the
   * caller's actual listening experience. Running them with no audio
   * in flight has no effect to protect and would only bump the
   * generation counter for no reason.
   *
   * Order matters and is unchanged from the original implementation:
   * generation is incremented BEFORE any callback, so any audio chunk
   * already mid-flight is guaranteed to see the new generation number
   * and be dropped by the bridge's epoch check, regardless of which
   * path got us here.
   */
  private performAudioInterruption(reason: string): void {
    this.generation += 1;
    const currentGen = this.generation;

    const previousState = this.state;
    this.state = "interrupted";

    console.log(
      `[TurnStateManager] BARGE-IN (${reason}) — interrupting turn ` +
      `(was: ${previousState}, gen=${currentGen})`
    );

    this.callbacks.clearExotelPlayback();
    this.callbacks.discardPhraseBuffer();
    this.callbacks.discardElevenLabsQueue();
  }

  /** Reset to idle. Called at the start of each fresh listen→respond
   *  cycle if needed, or defensively after a hangup-adjacent error. */
  reset(): void {
    this.state = "idle";
    this.pendingInterruption = false;
    this.hasActiveResponse = false;
  }
}
