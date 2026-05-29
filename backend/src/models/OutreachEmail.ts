import mongoose, { Schema, Document, Model, Types } from "mongoose";
import type { OutreachType } from "../types/outreach";

export type EmailStatus =
  | "queued"
  | "sent"
  | "delivered"
  | "failed"
  | "bounced";

export interface IOutreachEmail extends Document {
  tenantId: Types.ObjectId;
  userId: Types.ObjectId;
  placeId?: string;
  placeName: string;
  category?: string;
  toEmail: string;
  fromEmail?: string;
  subject: string;
  body: string;
  outreachType: OutreachType;
  status: EmailStatus;
  provider?: string;
  providerMessageId?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const outreachEmailSchema = new Schema<IOutreachEmail>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    placeId: { type: String, trim: true },
    placeName: { type: String, required: true, trim: true },
    category: { type: String, trim: true },
    toEmail: { type: String, required: true, trim: true, lowercase: true },
    fromEmail: { type: String, trim: true, lowercase: true },
    subject: { type: String, required: true, trim: true, maxlength: 500 },
    body: { type: String, required: true, maxlength: 32000 },
    outreachType: {
      type: String,
      enum: [
        "pharmacy_inquiry",
        "appointment_scheduling",
        "healthcare_coordination",
        "partnership_outreach",
        "follow_up",
      ],
      required: true,
    },
    status: {
      type: String,
      enum: ["queued", "sent", "delivered", "failed", "bounced"],
      default: "queued",
    },
    provider: { type: String, trim: true },
    providerMessageId: { type: String, trim: true },
    notes: { type: String, maxlength: 2000 },
  },
  { timestamps: true }
);

outreachEmailSchema.index({ tenantId: 1, userId: 1, createdAt: -1 });
outreachEmailSchema.index({ tenantId: 1, createdAt: -1 });

export const OutreachEmail: Model<IOutreachEmail> =
  mongoose.models.OutreachEmail ??
  mongoose.model<IOutreachEmail>("OutreachEmail", outreachEmailSchema);
