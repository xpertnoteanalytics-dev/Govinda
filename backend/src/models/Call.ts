import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type CallStatus =
  | "queued"
  | "initiated"
  | "ringing"
  | "in-progress"
  | "completed"
  | "failed"
  | "busy"
  | "no-answer";

export interface ICall extends Document {
  tenantId: Types.ObjectId;
  userId: Types.ObjectId;
  placeId?: string;
  placeName: string;
  phoneNumber: string;
  category?: string;
  status: CallStatus;
  direction: "outbound" | "inbound";
  script?: string;
  scriptType?: string;
  exotelCallSid?: string;
  recordingUrl?: string;
  durationSeconds?: number;
  notes?: string;
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
    status: {
      type: String,
      enum: ["queued", "initiated", "ringing", "in-progress", "completed", "failed", "busy", "no-answer"],
      default: "queued",
    },
    direction: { type: String, enum: ["outbound", "inbound"], default: "outbound" },
    script: { type: String, maxlength: 8000 },
    scriptType: { type: String, trim: true },
    exotelCallSid: { type: String, trim: true },
    recordingUrl: { type: String, trim: true },
    durationSeconds: { type: Number, min: 0 },
    notes: { type: String, maxlength: 2000 },
  },
  { timestamps: true }
);

callSchema.index({ tenantId: 1, userId: 1, createdAt: -1 });
callSchema.index({ tenantId: 1, createdAt: -1 });

export const Call: Model<ICall> =
  mongoose.models.Call ?? mongoose.model<ICall>("Call", callSchema);
