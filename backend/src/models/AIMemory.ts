import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IAIMemory extends Document {
  tenantId: Types.ObjectId;
  userId: Types.ObjectId;
  key: string;
  value: string;
  category?: string;
  createdAt: Date;
  updatedAt: Date;
}

const aiMemorySchema = new Schema<IAIMemory>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    key: { type: String, required: true, trim: true, maxlength: 120 },
    value: { type: String, required: true, maxlength: 4000 },
    category: { type: String, trim: true, maxlength: 60 },
  },
  { timestamps: true }
);

aiMemorySchema.index({ tenantId: 1, userId: 1, key: 1 }, { unique: true });

export const AIMemory: Model<IAIMemory> =
  mongoose.models.AIMemory ?? mongoose.model<IAIMemory>("AIMemory", aiMemorySchema);
