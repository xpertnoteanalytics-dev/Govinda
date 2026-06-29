// src/services/voice/PhraseBuffer.ts
//
// Responsibility: turn a stream of small text fragments (OpenAI's
// response.output_text.delta events) into complete, naturally-sized
// phrases ready to hand to a TTS engine.
//
// Why this exists: feeding ElevenLabs single tokens or sub-word fragments
// produces worse prosody — ElevenLabs' own docs note the model needs a
// minimum amount of text to "deduce context." This buffer is the thing
// that decides when enough text has accumulated to flush.
//
// Pure text accumulation. No WebSocket, no HTTP, no knowledge of
// ElevenLabs or Exotel. Fully unit-testable in isolation.

export interface PhraseBufferOptions {
  /**
   * Once the buffer reaches this many characters without hitting a
   * sentence-boundary punctuation mark, flush anyway. Prevents a long
   * run-on (or a rare malformed response with no punctuation) from
   * stalling all audio output indefinitely.
   *
   * Default: 80 — short enough to keep latency low, long enough that
   * ElevenLabs has real context to work with.
   */
  maxBufferChars?: number;

  /**
   * Minimum characters required before a sentence-boundary punctuation
   * mark is allowed to trigger a flush. Prevents flushing on things like
   * "Dr." or "No." where the period isn't really a sentence end, by
   * requiring at least a few words of context first.
   *
   * Default: 8.
   */
  minFlushChars?: number;
}

const DEFAULT_MAX_BUFFER_CHARS = 80;
const DEFAULT_MIN_FLUSH_CHARS = 8;

/** Sentence-boundary punctuation. Comma is intentionally excluded from
 *  the primary boundary set — commas are too frequent and would flush
 *  too eagerly, fragmenting prosody. Comma is used only as a fallback
 *  boundary once maxBufferChars is exceeded (see flush logic below). */
const SENTENCE_BOUNDARY = /[.!?]+[\s"')\]]*$/;
const SOFT_BOUNDARY = /[,;:][\s"')\]]*$/;

export class PhraseBuffer {
  private buffer = "";
  private readonly maxBufferChars: number;
  private readonly minFlushChars: number;

  constructor(options: PhraseBufferOptions = {}) {
    this.maxBufferChars = options.maxBufferChars ?? DEFAULT_MAX_BUFFER_CHARS;
    this.minFlushChars = options.minFlushChars ?? DEFAULT_MIN_FLUSH_CHARS;
  }

  /**
   * Feed one text delta fragment into the buffer.
   *
   * Returns the phrase to flush immediately if a flush condition was
   * met, or null if the fragment was only buffered and nothing should be
   * sent yet. Callers should send the returned phrase to TTS and
   * continue calling push() for subsequent deltas.
   */
  push(delta: string): string | null {
    if (!delta) return null;
    this.buffer += delta;

    if (this.buffer.length < this.minFlushChars) {
      return null;
    }

    if (SENTENCE_BOUNDARY.test(this.buffer)) {
      return this.flush();
    }

    if (this.buffer.length >= this.maxBufferChars) {
      // Prefer to break at the most recent soft boundary (comma, etc.)
      // inside the buffer if one exists past the minimum length, rather
      // than cutting mid-word. Otherwise just flush everything.
      const softMatch = this.findLastSoftBoundary();
      if (softMatch !== -1 && softMatch >= this.minFlushChars) {
        const phrase = this.buffer.slice(0, softMatch);
        this.buffer = this.buffer.slice(softMatch);
        return phrase.trim().length > 0 ? phrase : null;
      }
      return this.flush();
    }

    return null;
  }

  /**
   * Force-flush whatever remains in the buffer, regardless of boundary
   * state. Called when the model signals response.output_text.done (the
   * turn is over) — any trailing fragment without terminal punctuation
   * still needs to be spoken.
   */
  flushRemaining(): string | null {
    if (this.buffer.trim().length === 0) {
      this.buffer = "";
      return null;
    }
    return this.flush();
  }

  /** Discard any buffered, not-yet-flushed text without returning it.
   *  Used on interruption — text the model was mid-generating when the
   *  caller barged in should not be spoken after the fact. */
  discard(): void {
    this.buffer = "";
  }

  private flush(): string | null {
    const phrase = this.buffer;
    this.buffer = "";
    const trimmed = phrase.trim();
    return trimmed.length > 0 ? phrase : null;
  }

  private findLastSoftBoundary(): number {
    // Search from the end for the last comma/semicolon/colon boundary.
    for (let i = this.buffer.length - 1; i >= this.minFlushChars; i--) {
      const slice = this.buffer.slice(0, i + 1);
      if (SOFT_BOUNDARY.test(slice)) {
        return i + 1;
      }
    }
    return -1;
  }
}
