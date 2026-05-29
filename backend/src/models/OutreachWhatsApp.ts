import mongoose, { Schema, Document, Model, Types } from "mongoose";
import type { OutreachType } from "../types/outreach";

export type WhatsAppStatus =
  | "queued"
  | "sent"
  | "delivered"
  | "read"
  | "failed";

export interface IOutreachWhatsApp extends Document {
  tenantId: Types.ObjectId;
  userId: Types.ObjectId;
  placeId?: string;
  placeName: string;
  category?: string;
  phoneNumber: string;
  fromNumber?: string;
  message: string;
  outreachType: OutreachType;
  status: WhatsAppStatus;
  deliveryStatus?: string;
  provider?: string;
  providerMessageId?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const outreachWhatsAppSchema = new Schema<IOutreachWhatsApp>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    placeId: { type: String, trim: true },
    placeName: { type: String, required: true, trim: true },
    category: { type: String, trim: true },
    phoneNumber: { type: String, required: true, trim: true },
    fromNumber: { type: String, trim: true },
    message: { type: String, required: true, maxlength: 4096 },
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
      enum: ["queued", "sent", "delivered", "read", "failed"],
      default: "queued",
    },
    deliveryStatus: { type: String, trim: true },
    provider: { type: String, trim: true },
    providerMessageId: { type: String, trim: true },
    notes: { type: String, maxlength: 2000 },
  },
  { timestamps: true }
);

outreachWhatsAppSchema.index({ tenantId: 1, userId: 1, createdAt: -1 });
outreachWhatsAppSchema.index({ tenantId: 1, createdAt: -1 });

export const OutreachWhatsApp: Model<IOutreachWhatsApp> =
  mongoose.models.OutreachWhatsApp ??
  mongoose.model<IOutreachWhatsApp>("OutreachWhatsApp", outreachWhatsAppSchema);
