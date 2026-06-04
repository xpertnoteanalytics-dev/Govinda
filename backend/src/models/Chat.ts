import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type MessageRole = "user" | "assistant" | "system";

export interface IChatMessage {
  role: MessageRole;
  content: string;
  createdAt: Date;
}

export interface IChat extends Document {
  tenantId: Types.ObjectId;
  userId: Types.ObjectId;
  title: string;
  avatarChat: boolean;
  messages: IChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const chatMessageSchema = new Schema<IChatMessage>(
  {
    role: {
      type: String,
      enum: ["user", "assistant", "system"],
      required: true,
    },
    content: {
      type: String,
      required: true,
      maxlength: 32000,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const chatSchema = new Schema<IChat>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      default: "New conversation",
      trim: true,
      maxlength: 200,
    },
    avatarChat: {
      type: Boolean,
      default: false,
      index: true,
    },
    messages: {
      type: [chatMessageSchema],
      default: [],
    },
  },
  { timestamps: true }
);

chatSchema.index({ tenantId: 1, userId: 1, updatedAt: -1 });

export const Chat: Model<IChat> =
  mongoose.models.Chat ?? mongoose.model<IChat>("Chat", chatSchema);