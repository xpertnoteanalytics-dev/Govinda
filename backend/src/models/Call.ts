import mongoose, { Schema, Document, Model, Types } from "mongoose";
import type { CallObjectiveType, CallTool } from "../types/callRequest";

export type CallStatus =
  | "queued"
  | "initiated"
  | "ringing"
  | "in-progress"
  | "completed"
  | "failed"
  | "busy"
  | "no-answer";

/**
 * ICall — a stored outbound call.
 *
 * No `script` / `scriptType` fields. The resolved call context (objective,
 * organization, recipient, business context, notes, enabled tools) is
 * stored directly. RealtimeBridge's GuideResolver (in index.ts) reads these
 * fields and calls promptBuilder.buildRealtimePrompt() to render the prompt
 * at call time — nothing pre-rendered or serialized is stored.
 *
 * `notes` is user-authored business context (e.g. "Ask for Dr. Mehta") and
 * is read by promptBuilder. It must never be overwritten by anything the
 * system generates — provider/telephony failures go in `providerError`
 * instead.
 *
 * Post-call extraction fields are intentionally GENERIC ONLY: `summary`,
 * `sentiment`, `extractedData`. This Call document is not where appointment
 * or feedback outcomes live — Appointment and Feedback already have their
 * own collections and remain the single source of truth for that data. A
 * future Universal Extraction Engine dispatches structured results INTO
 * those existing collections; it does not duplicate their fields here.
 * `extractedData` (Mixed) exists only as a generic, schema-less landing
 * spot for whatever the extraction engine produces before/while it routes
 * pieces of that data to the appropriate collection — it is a transit
 * field, not a parallel store of appointment/feedback state.
 */
export interface ICall extends Document {
  tenantId: Types.ObjectId;
  userId: Types.ObjectId;

  placeId?: string;
  placeName: string;
  phoneNumber: string;
  category?: string;

  // Resolved call context — the single source of truth for prompt rendering.
  organizationName: string;
  objectiveType: CallObjectiveType;
  customObjectiveText?: string;
  businessContext?: string;
  notes?: string;
  enabledTools?: CallTool[];

  status: CallStatus;
  direction: "outbound" | "inbound";
  exotelCallSid?: string;
  recordingUrl?: string;
  durationSeconds?: number;

  /**
   * Telephony/provider failure reason (e.g. Exotel credentials missing,
   * provider error message). Distinct from `notes` — this is system-written
   * diagnostic text, never business context.
   */
  providerError?: string;

  // ── Future-ready: generic post-call extraction (inert until that layer
  // ships). Deliberately NOT appointment- or feedback-shaped — see the
  // interface doc comment above for why.
  summary?: string;
  sentiment?: "positive" | "neutral" | "negative";
  extractedData?: Record<string, unknown>;

  createdAt: Date;
  updatedAt: Date;
}

const callSchema = new Schema<ICall>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },

    placeId: { type: String, trim: true },
    placeName: { type: String, required: true, trim: true },
    phoneNumber: { type: String, required: true, trim: true },
    category: { type: String, trim: true },

    organizationName: { type: String, required: true, trim: true },
    objectiveType: { type: String, required: true, trim: true },
    customObjectiveText: { type: String, maxlength: 500, trim: true },
    businessContext: { type: String, maxlength: 500, trim: true },
    notes: { type: String, maxlength: 200, trim: true },
    enabledTools: { type: [String], default: undefined },

    status: {
      type: String,
      enum: ["queued", "initiated", "ringing", "in-progress", "completed", "failed", "busy", "no-answer"],
      default: "queued",
    },
    direction: { type: String, enum: ["outbound", "inbound"], default: "outbound" },
    exotelCallSid: { type: String, trim: true },
    recordingUrl: { type: String, trim: true },
    durationSeconds: { type: Number, min: 0 },

    providerError: { type: String, maxlength: 500, trim: true },

    // Generic extraction fields only. Not written or read by any current
    // code path. Kept optional with no defaults so they stay absent on
    // existing documents until the extraction layer is built.
    summary: { type: String, maxlength: 2000, trim: true },
    sentiment: { type: String, enum: ["positive", "neutral", "negative"] },
    extractedData: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

callSchema.index({ tenantId: 1, userId: 1, createdAt: -1 });
callSchema.index({ tenantId: 1, createdAt: -1 });

export const Call: Model<ICall> =
  mongoose.models.Call ?? mongoose.model<ICall>("Call", callSchema);
