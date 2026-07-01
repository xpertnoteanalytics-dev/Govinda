// src/services/voice/TurnStateManager.ts
//
// Responsibility: the ONE place that knows what state a call turn is in,
// and what to do when the caller interrupts.
//
// Two independent state machines combined by a single gate:
//   - responseLifecycle: enforces "at most one active response, ever"
//   - callerState: enforces "never answer until the caller has fully finished"
//
// create_response is false at the session level. The only two call sites
// that ever request a response are requestGreeting() and onBufferCommitted(),
// and both route through the single gate in maybeCreateResponse().

export type ResponseLifecycle = "idle" | "creating" | "active" | "cancelling";
export type CallerState = "idle" | "speaking" | "awaiting_commit";
export type PendingResponseKind = "greeting" | "reply" | null;
export type ResponseDoneStatus = "completed" | "cancelled" | "failed" | string;

export interface TurnStateCallbacks {
  sendResponseCreate: () => void;
  sendResponseCancel: () => void;
  discardPhraseBuffer: () => void;
  discardElevenLabsQueue: () => void;
  clearExotelPlayback: () => void;
  log: (message: string, meta?: Record<string, unknown>) => void;
}

export class TurnStateManager {
  private responseLifecycle: ResponseLifecycle = "idle";
  private callerState: CallerState = "idle";
  private pendingResponseKind: PendingResponseKind = null;
  private generation = 0;
  private currentResponseId: string | null = null;

  constructor(private readonly callbacks: TurnStateCallbacks) {}

  // ---------------------------------------------------------------------
  // Caller-side events
  // ---------------------------------------------------------------------

  onSpeechStarted(): void {
    // I3: generation bump is unconditional, synchronous, and the first action.
    this.generation++;

    // I10: discard/clear fire synchronously and unconditionally.
    this.callbacks.discardPhraseBuffer();
    this.callbacks.discardElevenLabsQueue();
    this.callbacks.clearExotelPlayback();

    // I6: any queued intent is dropped. Latest utterance wins.
    this.pendingResponseKind = null;

    // I7: a fresh speech_started always moves callerState to 'speaking',
    // regardless of what it was before (including mid awaiting_commit).
    this.callerState = "speaking";

    if (this.isResponseInFlight() && this.responseLifecycle !== "cancelling") {
      this.callbacks.sendResponseCancel();
      this.responseLifecycle = "cancelling";
      this.callbacks.log("[turnstate] speech_started: cancelling in-flight response", {
        generation: this.generation,
      });
    } else {
      this.callbacks.log("[turnstate] speech_started: no in-flight response to cancel", {
        generation: this.generation,
        responseLifecycle: this.responseLifecycle,
      });
    }
  }

  onSpeechStopped(): void {
    if (this.callerState !== "speaking") {
      this.callbacks.log("[turnstate] speech_stopped received outside 'speaking' state, ignoring", {
        callerState: this.callerState,
      });
      return;
    }
    this.callerState = "awaiting_commit";
    this.callbacks.log("[turnstate] speech_stopped: awaiting_commit");
  }

  onBufferCommitted(): void {
    this.callerState = "idle";
    this.pendingResponseKind = "reply";
    this.callbacks.log("[turnstate] buffer committed: reply pending");
    this.maybeCreateResponse();
  }

  // ---------------------------------------------------------------------
  // Assistant-side (response) events
  // ---------------------------------------------------------------------

  requestGreeting(): void {
    if (this.pendingResponseKind !== null) {
      this.callbacks.log("[turnstate] requestGreeting: intent already pending, ignoring", {
        pendingResponseKind: this.pendingResponseKind,
      });
      return;
    }
    this.pendingResponseKind = "greeting";
    this.callbacks.log("[turnstate] greeting requested");
    this.maybeCreateResponse();
  }

  onResponseCreated(responseId: string): void {
    // response.created must be accepted when lifecycle is either 'creating'
    // or 'cancelling'. A cancel can be sent locally before the
    // response.created ack for that same response arrives — if we ignore
    // the ack in that case, currentResponseId is never recorded and the
    // later response.done can never be matched, permanently stranding
    // lifecycle in 'cancelling'.
    if (this.responseLifecycle !== "creating" && this.responseLifecycle !== "cancelling") {
      this.callbacks.log("[turnstate] response.created received outside creating/cancelling, ignoring", {
        responseLifecycle: this.responseLifecycle,
        responseId,
      });
      return;
    }

    // Always record the id so the matching response.done can be correlated,
    // regardless of which of the two states we're in.
    this.currentResponseId = responseId;

    if (this.responseLifecycle === "creating") {
      this.responseLifecycle = "active";
      this.callbacks.log("[turnstate] response created, now active", { responseId });
    } else {
      // lifecycle === 'cancelling': do NOT transition to active, do NOT
      // reopen the response. Keep lifecycle cancelling and wait for
      // response.done to match this id and return lifecycle to idle.
      this.callbacks.log("[turnstate] response created while already cancelling, id recorded for correlation", {
        responseId,
      });
    }
  }

  onResponseDone(responseId: string, status: ResponseDoneStatus): void {
    if (responseId !== this.currentResponseId) {
      this.callbacks.log("[turnstate] response.done for stale/unknown responseId, ignoring", {
        responseId,
        currentResponseId: this.currentResponseId,
        status,
      });
      return;
    }

    this.callbacks.log("[turnstate] response done", { responseId, status });

    this.currentResponseId = null;
    this.responseLifecycle = "idle";

    if (status !== "completed" && status !== "cancelled") {
      // e.g. "failed" or any other non-terminal-success status: the caller's
      // utterance must not go permanently unanswered, so re-queue a reply.
      this.pendingResponseKind = "reply";
      this.callbacks.log("[turnstate] response ended with non-terminal status, re-queuing reply", {
        status,
      });
    }

    this.maybeCreateResponse();
  }

  // ---------------------------------------------------------------------
  // Text forwarding gate
  // ---------------------------------------------------------------------

  shouldForwardText(responseId: string): boolean {
    return this.responseLifecycle === "active" && responseId === this.currentResponseId;
  }

  // ---------------------------------------------------------------------
  // Gate
  // ---------------------------------------------------------------------

  private maybeCreateResponse(): void {
    if (this.responseLifecycle !== "idle") {
      this.callbacks.log("[turnstate] maybeCreateResponse: refused, response in flight", {
        responseLifecycle: this.responseLifecycle,
      });
      return;
    }
    if (this.callerState !== "idle") {
      this.callbacks.log("[turnstate] maybeCreateResponse: refused, caller not idle", {
        callerState: this.callerState,
      });
      return;
    }
    if (this.pendingResponseKind === null) {
      this.callbacks.log("[turnstate] maybeCreateResponse: refused, nothing pending");
      return;
    }

    const kind = this.pendingResponseKind;
    this.pendingResponseKind = null;
    this.responseLifecycle = "creating";
    this.callbacks.sendResponseCreate();
    this.callbacks.log("[turnstate] response.create sent", { kind });
  }

  // ---------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------

  private isResponseInFlight(): boolean {
    return this.responseLifecycle === "creating" || this.responseLifecycle === "active";
  }

  getGeneration(): number {
    return this.generation;
  }

  getResponseLifecycle(): ResponseLifecycle {
    return this.responseLifecycle;
  }

  getCallerState(): CallerState {
    return this.callerState;
  }

  getCurrentResponseId(): string | null {
    return this.currentResponseId;
  }
}
