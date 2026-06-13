// src/models/StakeholderInteraction.ts
import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type InteractionChannel = "chat" | "call" | "email" | "whatsapp" | "manual";
export type InteractionSentiment = "positive" | "neutral" | "negative";

export interface IStakeholderInteraction extends Document {
  tenantId: Types.ObjectId;
  userId: Types.ObjectId;
  stakeholderId: Types.ObjectId;
  channel: InteractionChannel;
  summary: string;
  conversation?: { role: "user" | "assistant"; content: string; createdAt: Date }[];
  sentiment: InteractionSentiment;
  feedback?: string;
  suggestions?: string[];
  actionItems?: string[];
  topics?: string[];
  createdAt: Date;
  updatedAt: Date;
}

const interactionSchema = new Schema<IStakeholderInteraction>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    stakeholderId: { type: Schema.Types.ObjectId, ref: "Stakeholder", required: true, index: true },
    channel: {
      type: String,
      enum: ["chat", "call", "email", "whatsapp", "manual"],
      default: "chat",
    },
    summary: { type: String, required: true, trim: true },
    conversation: [
      {
        role: { type: String, enum: ["user", "assistant"] },
        content: { type: String },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    sentiment: {
      type: String,
      enum: ["positive", "neutral", "negative"],
      default: "neutral",
    },
    feedback: { type: String, trim: true },
    suggestions: [{ type: String, trim: true }],
    actionItems: [{ type: String, trim: true }],
    topics: [{ type: String, trim: true }],
  },
  { timestamps: true }
);

interactionSchema.index({ tenantId: 1, stakeholderId: 1, createdAt: -1 });

export const StakeholderInteraction: Model<IStakeholderInteraction> =
  mongoose.models.StakeholderInteraction ??
  mongoose.model<IStakeholderInteraction>("StakeholderInteraction", interactionSchema);