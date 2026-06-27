// src/types/conversationGuide.ts
//
// The single internal representation of all call knowledge.
//
// Both use cases (AI-generated guide and user-written script) must produce
// exactly this structure before anything is sent to OpenAI. This type is the
// contract between the guide layer and the prompt builder layer.
//
// OpenAI NEVER receives raw scripts. It ONLY receives a rendered version of
// this structure, framed explicitly as knowledge to reason over.

// ---------------------------------------------------------------------------
// Sub-types
// ---------------------------------------------------------------------------

/** A single objection the customer might raise and how to handle it. */
export interface ObjectionHandler {
  /** Short label, e.g. "Not interested", "Busy right now", "Need pricing" */
  objection: string;
  /** Concise handling guidance — NOT scripted wording. Strategy only. */
  approach: string;
}

/** A question the customer might ask and how to answer it. */
export interface AnticipatedQuestion {
  /** The question, e.g. "Why are you calling?" */
  question: string;
  /** The answer approach — NOT a scripted line. Key facts and tone. */
  answerGuidance: string;
}

/** A piece of information to collect from the customer during the call. */
export interface CollectionField {
  /** What is being collected, e.g. "preferred delivery time" */
  field: string;
  /** Whether it is mandatory for the call to succeed */
  required: boolean;
  /** Hint about how to ask for it naturally */
  collectionHint?: string;
}

/**
 * A logical branch in the conversation based on a customer response.
 * Used to guide the AI through conditional paths without scripting dialogue.
 */
export interface ConversationBranch {
  /** The condition that triggers this branch, e.g. "Customer says yes" */
  condition: string;
  /** What the AI should focus on next, e.g. "Move to scheduling" */
  nextFocus: string;
}

// ---------------------------------------------------------------------------
// Main type
// ---------------------------------------------------------------------------

/**
 * ConversationGuide — the single internal format for ALL call knowledge.
 *
 * Produced by:
 *   • conversationGuideService.generateGuide()  (AI-generated)
 *   • conversationGuideService.convertScriptToGuide()  (user script → guide)
 *
 * Consumed ONLY by:
 *   • promptBuilder.buildRealtimePrompt()  (renders to OpenAI instructions)
 *
 * Never sent to OpenAI directly. Always rendered through the prompt builder.
 */
export interface ConversationGuide {
  // ── Identity ──────────────────────────────────────────────────────────────

  /** Who is making this call. e.g. "Govinda AI, on behalf of RKG Labs" */
  callerIdentity: string;

  /** The name of the person or business being called. */
  recipientName: string;

  // ── Purpose ───────────────────────────────────────────────────────────────

  /**
   * Single-sentence statement of why this call is happening.
   * The AI must remember this for the entire call and return to it
   * after any diversion.
   * e.g. "Determine whether Medplus Pharmacy has paracetamol 500mg in stock
   *       and arrange a same-day delivery if available."
   */
  callObjective: string;

  /**
   * Category of call — used to tune tone and strategy.
   * e.g. "pharmacy_inquiry" | "appointment_scheduling" | "healthcare_coordination"
   */
  callType: string;

  // ── Context ───────────────────────────────────────────────────────────────

  /**
   * Business background the AI should know but NOT recite.
   * e.g. "Patient requires medication urgently. Previous pharmacy was out of stock."
   */
  businessContext?: string;

  /**
   * What is already known about the recipient before the call starts.
   * The AI should use this to personalise without asking for info
   * it already has.
   * e.g. "Pharmacy is open until 9pm. Contact is Ramesh Kumar."
   */
  knownInformation?: string;

  /**
   * Profile of the person being called.
   * Helps the AI calibrate formality, terminology, and approach.
   * e.g. "Pharmacist at a retail chain. Likely busy. Prefers short calls."
   */
  recipientProfile?: string;

  // ── Strategy ──────────────────────────────────────────────────────────────

  /**
   * Overall conversation strategy.
   * e.g. "Lead with the patient need. Build rapport. Ask one thing at a time.
   *       If stock is unavailable, explore alternatives before closing."
   */
  conversationStrategy?: string;

  /**
   * The intended outcome if the call succeeds fully.
   * e.g. "Confirmed stock, delivery arranged, confirmation number obtained."
   */
  successCriteria?: string;

  /**
   * How to close the call gracefully.
   * e.g. "Confirm next step, thank the recipient, and repeat contact info."
   */
  closingStrategy?: string;

  /**
   * What happens after the call.
   * e.g. "Send confirmation SMS to patient. Update pharmacy record in CRM."
   */
  nextAction?: string;

  // ── Content ───────────────────────────────────────────────────────────────

  /**
   * Key topics to cover — NOT lines to say.
   * The AI decides how and when to raise each topic based on the conversation.
   * e.g. ["Medication name and dosage", "Stock availability", "Delivery options"]
   */
  talkingPoints: string[];

  /**
   * Information the AI must collect from the customer.
   * The AI tracks what has and hasn't been collected and avoids re-asking.
   */
  informationToCollect: CollectionField[];

  // ── Q&A and Objections ────────────────────────────────────────────────────

  /**
   * Questions the customer is likely to ask, with answer guidance.
   * The AI uses this to answer naturally without inventing facts.
   */
  anticipatedQuestions: AnticipatedQuestion[];

  /**
   * Common objections the customer might raise and how to handle them.
   * The AI uses these as strategic guidance, not scripted responses.
   */
  objectionHandlers: ObjectionHandler[];

  // ── Branching ─────────────────────────────────────────────────────────────

  /**
   * Conditional branches that guide the AI through different paths.
   * e.g. [{ condition: "Stock available", nextFocus: "Discuss delivery" }]
   */
  decisionTree?: ConversationBranch[];

  /**
   * What the AI should say/do if something unexpected happens.
   * e.g. "If the call drops: call back within 2 minutes."
   *      "If no one answers: leave a voicemail if possible."
   */
  fallbackResponses?: string[];

  // ── Rules ─────────────────────────────────────────────────────────────────

  /**
   * Specific rules for this call beyond the global conversation rules.
   * e.g. ["Do not mention competitor pricing", "Do not promise next-day delivery"]
   */
  callSpecificRules?: string[];

  /**
   * Language to use by default. Defaults to "English" if not set.
   * The AI will still mirror the customer's language dynamically.
   */
  defaultLanguage?: string;
}
