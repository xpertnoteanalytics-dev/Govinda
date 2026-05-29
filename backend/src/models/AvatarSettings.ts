import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type AvatarPersona = "govinda" | "durga";

export interface IAvatarSettings extends Document {
  tenantId: Types.ObjectId;
  userId: Types.ObjectId;
  persona: AvatarPersona;
  elevenLabsVoiceId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const avatarSettingsSchema = new Schema<IAvatarSettings>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    persona: { type: String, enum: ["govinda", "durga"], default: "govinda" },
    elevenLabsVoiceId: { type: String, trim: true },
  },
  { timestamps: true }
);

avatarSettingsSchema.index({ tenantId: 1, userId: 1 }, { unique: true });

export const AvatarSettings: Model<IAvatarSettings> =
  mongoose.models.AvatarSettings ??
  mongoose.model<IAvatarSettings>("AvatarSettings", avatarSettingsSchema);
