// src/config/objectiveProfiles.ts
//
// Each predefined CallObjectiveType maps to an ObjectiveProfile: curated
// reasoning knowledge — what success looks like, how to strategize, what to
// collect, and what to expect. It is NOT a script and is never read verbatim.
//
// This file is exclusively about objective reasoning. Tool compatibility is
// a separate concern — see toolCompatibility.ts. Keeping them apart means
// adding a new objective never touches tool logic, and adding a new tool
// never touches objective logic.
//
// Kept deliberately small. Every field exists because it changes what the
// model does on the call; nothing here is restated prose. Two questions and
// two objections per objective is enough to seed pattern-matching — OpenAI
// extrapolates the rest from successCriteria + conversationStrategy.
//
// Adding a new objective = add one entry here. No other file changes.

import type { CallObjectiveType } from "../types/callRequest";

// ---------------------------------------------------------------------------
// Profile shape
// ---------------------------------------------------------------------------

export interface ObjectiveProfile {
  /** What must be true for this call to be considered a success. */
  successCriteria: string;

  /** How to open, sequence, and navigate the call. */
  conversationStrategy: string;

  /** Information to collect. Required items first. */
  informationToCollect: Array<{
    field: string;
    required: boolean;
    hint: string;
  }>;

  /** Up to 2–3 realistic questions this recipient type tends to ask. */
  likelyQuestions: Array<{
    question: string;
    answerGuidance: string;
  }>;

  /** Up to 2–3 realistic objections and how to navigate them. */
  likelyObjections: Array<{
    objection: string;
    approach: string;
  }>;

  /** How to close this specific type of call. */
  closingGuidance: string;

  /** Up to 2 domain-specific rules unique to this objective. */
  callRules: string[];
}

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------

const profiles: Record<Exclude<CallObjectiveType, "custom">, ObjectiveProfile> = {
  appointment_booking: {
    successCriteria:
      "A specific date and time is confirmed, the patient is registered, and pre-visit requirements are understood.",
    conversationStrategy:
      "Open with specialty and urgency, not full patient history — clinic staff triage on those first. Confirm the slot immediately once offered rather than deliberating.",
    informationToCollect: [
      { field: "Confirmed date and time", required: true, hint: "Repeat it back before closing." },
      { field: "Doctor or department", required: true, hint: "Ask early — wrong department wastes the call." },
      { field: "Pre-visit requirements (referral, documents, fasting)", required: true, hint: "Ask plainly; patients miss visits over this." },
    ],
    likelyQuestions: [
      { question: "What is the patient's condition?", answerGuidance: "Name the specialty only, not a diagnosis. One sentence." },
      { question: "Is this urgent?", answerGuidance: "Be direct about urgency and why, in one sentence." },
    ],
    likelyObjections: [
      { objection: "No slots for weeks", approach: "Ask about a cancellation list or a sooner doctor in the same specialty." },
      { objection: "Needs a referral first", approach: "Ask exactly what it must say and whether a slot can be held provisionally." },
    ],
    closingGuidance:
      "Repeat date, time, doctor, and any requirement. Confirm how the patient will be notified.",
    callRules: [
      "Never agree to a slot without confirming specialty match.",
      "Never close without a confirmed date and time.",
    ],
  },

  feedback_collection: {
    successCriteria:
      "The recipient gave a rating or qualitative feedback, and any concern raised was acknowledged and logged.",
    conversationStrategy:
      "Open with a brief, genuine acknowledgment — not a questionnaire. Ask one open question, listen fully, then follow up. Never interrupt.",
    informationToCollect: [
      { field: "Overall satisfaction", required: true, hint: "Let them phrase it; don't force a numeric scale unless they offer one." },
      { field: "Main concern or improvement area", required: false, hint: "Ask open-endedly — don't suggest issues unprompted." },
    ],
    likelyQuestions: [
      { question: "What will you do with my feedback?", answerGuidance: "It's reviewed by the team to improve service; mention escalation if relevant." },
    ],
    likelyObjections: [
      { objection: "Too busy", approach: "Ask for two minutes, or get a specific callback time." },
      { objection: "Had a bad experience", approach: "Slow down, listen fully, acknowledge sincerely before asking what resolution looks like." },
    ],
    closingGuidance:
      "Summarise the 1–2 key points they shared and what happens next. Thank them specifically, not generically.",
    callRules: [
      "Never argue with negative feedback — acknowledge and ask for specifics.",
      "Never suggest answers to leading questions.",
    ],
  },

  pharmacy_inquiry: {
    successCriteria:
      "Stock status for the specific medication is confirmed and next steps for acquisition are agreed.",
    conversationStrategy:
      "State medication name, formulation, and quantity in the opening sentence. If unavailable, pivot immediately to substitutes or delivery timelines.",
    informationToCollect: [
      { field: "Availability status", required: true, hint: "State medication and quantity upfront for a direct answer." },
      { field: "Substitute or restock date if unavailable", required: false, hint: "Ask only once primary is confirmed unavailable." },
    ],
    likelyQuestions: [
      { question: "What quantity do you need?", answerGuidance: "State the exact quantity — first thing a pharmacist needs." },
      { question: "Do you have a prescription?", answerGuidance: "Confirm status; say clearly if calling on a patient's behalf." },
    ],
    likelyObjections: [
      { objection: "Can't share stock info by phone", approach: "Ask about an online portal, WhatsApp line, or in-store check." },
      { objection: "Only certain items in stock", approach: "Ask specifically whether this medication is included — don't accept a vague answer." },
    ],
    closingGuidance:
      "Confirm the outcome — available with procurement method, or unavailable with the alternative plan. End within seconds of confirming.",
    callRules: [
      "Never claim clinical authority on substitutions — defer to the patient's doctor.",
      "Never share more patient history than necessary.",
    ],
  },

  doctor_verification: {
    successCriteria:
      "The doctor's active status, specialty, and hospital affiliation are confirmed by an authorised source.",
    conversationStrategy:
      "Open with the doctor's name and exactly what is being verified. Be direct — staff respond better to specificity than a vague inquiry.",
    informationToCollect: [
      { field: "Active status", required: true, hint: "Lead with this — most critical item." },
      { field: "Specialty and current affiliation", required: true, hint: "Doctors move between facilities; confirm current institution." },
      { field: "Accepting new patients", required: false, hint: "Ask before arranging a referral." },
    ],
    likelyQuestions: [
      { question: "Why do you need to verify?", answerGuidance: "For a patient referral — the care team needs confirmed credentials." },
    ],
    likelyObjections: [
      { objection: "Cannot share over the phone", approach: "Ask about an official verification channel — portal, HR, or written inquiry." },
      { objection: "Doctor no longer here", approach: "Ask for their new affiliation or a forwarding contact." },
    ],
    closingGuidance:
      "Read back the confirmed details. Get the contact's name for the record.",
    callRules: [
      "Never imply this is an official government verification.",
      "Never share the referring patient's details.",
    ],
  },

  hospital_onboarding: {
    successCriteria:
      "Interest is confirmed, a decision-maker is identified, and a next step with a specific date is agreed.",
    conversationStrategy:
      "Open with a likely challenge, not a product pitch. Build around their needs. Move to next steps only once a genuine need surfaces.",
    informationToCollect: [
      { field: "Decision-maker name and role", required: true, hint: "Identify early — wrong contact is a dead end." },
      { field: "Agreed next step with date", required: true, hint: "Never close without a concrete action on the calendar." },
      { field: "Best follow-up contact", required: true, hint: "Collect before closing." },
    ],
    likelyQuestions: [
      { question: "What exactly do you offer?", answerGuidance: "One-sentence category description, then ask which part of their operations it affects." },
      { question: "What does it cost?", answerGuidance: "Don't commit to pricing on a first call — say it depends on scale; the goal now is fit." },
    ],
    likelyObjections: [
      { objection: "Already have a vendor", approach: "Ask what they'd want a future vendor to do differently; position as complementary." },
      { objection: "Need management approval", approach: "Ask about the decision timeline and offer to present to the committee." },
    ],
    closingGuidance:
      "Confirm the next step, date, and attendee. Repeat contact details. Thank them by name.",
    callRules: [
      "Never make outcome claims without evidence.",
      "Never commit to custom pricing on the call.",
    ],
  },

  sales_outreach: {
    successCriteria:
      "The prospect heard the value proposition, expressed a level of interest, and a next step or clear reason for disinterest is noted.",
    conversationStrategy:
      "Open with a problem statement relevant to their role, not a product name. Validate the problem before mentioning the solution. Listen more than you speak early on.",
    informationToCollect: [
      { field: "Level of interest", required: true, hint: "Infer from tone — never ask directly." },
      { field: "Decision-maker or influencer", required: true, hint: "Identify early to calibrate pitch depth." },
      { field: "Agreed next step and timeline", required: true, hint: "Secure a specific action before closing." },
    ],
    likelyQuestions: [
      { question: "How is this different from what we use?", answerGuidance: "One or two specific differentiators relevant to their context — not a feature list." },
    ],
    likelyObjections: [
      { objection: "Too expensive", approach: "Ask what outcome would justify the investment; anchor to ROI, not price." },
      { objection: "Not the decision maker", approach: "Ask who is and whether an introduction or three-way call is possible." },
    ],
    closingGuidance:
      "Confirm the next action with a date. Recap the core benefit in one sentence. Close promptly.",
    callRules: [
      "Never push for an immediate yes on long-cycle decisions.",
      "Never make unsubstantiated competitive claims.",
    ],
  },

  insurance_verification: {
    successCriteria:
      "Coverage status for the specific treatment is confirmed, including any pre-authorisation requirement.",
    conversationStrategy:
      "Open with the policy number and the specific treatment being verified. Confirm each element in order before moving to the next.",
    informationToCollect: [
      { field: "Policy active status", required: true, hint: "Confirm first — everything else depends on it." },
      { field: "Coverage for the specific treatment", required: true, hint: "Name the procedure precisely." },
      { field: "Pre-authorisation requirement and process", required: true, hint: "Ask immediately after coverage is confirmed." },
    ],
    likelyQuestions: [
      { question: "What is the patient's policy number?", answerGuidance: "State it clearly and slowly." },
    ],
    likelyObjections: [
      { objection: "Cannot share over the phone", approach: "Clarify you represent the treating provider with consent; offer the policy number to verify identity." },
    ],
    closingGuidance:
      "Repeat back all confirmed details and get a reference number before closing.",
    callRules: [
      "Never share more patient information than required.",
      "Always get a reference number before ending the call.",
    ],
  },

  lab_result_followup: {
    successCriteria:
      "The lab result's status is confirmed, and if ready, the delivery method and timeline are established.",
    conversationStrategy:
      "Be specific from the first sentence: patient name, test name, sample date. Lab staff handle volume — specificity gets faster answers.",
    informationToCollect: [
      { field: "Report status", required: true, hint: "State patient name and test name clearly at the start." },
      { field: "Delivery method and timeline", required: true, hint: "Ask once status is confirmed." },
    ],
    likelyQuestions: [
      { question: "What is the patient's name?", answerGuidance: "Give name, date of birth, and test date to speed up the lookup." },
    ],
    likelyObjections: [
      { objection: "Not ready yet", approach: "Ask for a specific estimate and whether an automated notification is possible." },
    ],
    closingGuidance:
      "Confirm status and delivery method. Thank them by name if known.",
    callRules: [
      "Never discuss result content or interpretation by phone.",
      "Never share medical history beyond what locates the record.",
    ],
  },

  patient_reminder: {
    successCriteria:
      "The patient confirms awareness of the appointment or schedule, and any conflict is noted.",
    conversationStrategy:
      "Warm and brief. State the reminder in the first sentence, confirm attendance, address one concern if any, close quickly.",
    informationToCollect: [
      { field: "Confirms attendance or compliance", required: true, hint: "Ask directly but warmly after the reminder." },
      { field: "Rescheduling need and preferred alternative", required: false, hint: "If they can't make it, get an alternative time immediately." },
    ],
    likelyQuestions: [
      { question: "What do I need to bring?", answerGuidance: "State documents, fasting requirements, ID clearly." },
    ],
    likelyObjections: [
      { objection: "Can't make it", approach: "Accept without frustration; get a preferred alternative time." },
    ],
    closingGuidance:
      "Repeat the appointment details once more and close warmly.",
    callRules: [
      "Keep the call under three minutes where possible.",
      "Never mention sensitive diagnoses — the patient may not be alone.",
    ],
  },
};

// ---------------------------------------------------------------------------
// Accessors
// ---------------------------------------------------------------------------

/**
 * Returns the curated reasoning profile for a predefined objective.
 * Returns null for "custom" — the prompt builder handles custom objectives
 * using the raw customObjectiveText instead.
 */
export function getObjectiveProfile(type: CallObjectiveType): ObjectiveProfile | null {
  if (type === "custom") return null;
  return profiles[type] ?? null;
}

const LABELS: Record<CallObjectiveType, string> = {
  appointment_booking: "Appointment Booking",
  feedback_collection: "Feedback Collection",
  pharmacy_inquiry: "Pharmacy Inquiry",
  doctor_verification: "Doctor Verification",
  hospital_onboarding: "Hospital Onboarding",
  sales_outreach: "Sales Outreach",
  insurance_verification: "Insurance Verification",
  lab_result_followup: "Lab Result Follow-up",
  patient_reminder: "Patient Reminder",
  custom: "Custom Objective",
};

/** Human-readable label for an objective type. Used in logging and UI. */
export function objectiveLabel(type: CallObjectiveType): string {
  return LABELS[type] ?? type;
}
