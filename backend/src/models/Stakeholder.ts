// src/models/Stakeholder.ts
import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type StakeholderType =
  | "patient"
  | "partner"
  | "employee"
  | "sponsor"
  | "vendor"
  | "donor"
  | "government"
  | "other";

export interface IStakeholder extends Document {
  tenantId: Types.ObjectId;
  userId: Types.ObjectId;
  name: string;
  email?: string;
  mobile: string;
  organizationName?: string;
  organizationAddress?: string;
  stakeholderType: StakeholderType;
  details?: Record<string, unknown>;
  tags?: string[];
  notes?: string;
  importBatchId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const stakeholderSchema = new Schema<IStakeholder>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    mobile: { type: String, required: true, trim: true },
    organizationName: { type: String, trim: true },
    organizationAddress: { type: String, trim: true },
    stakeholderType: {
      type: String,
      enum: ["patient", "partner", "employee", "sponsor", "vendor", "donor", "government", "other"],
      default: "other",
    },
    details: { type: Schema.Types.Mixed },
    tags: [{ type: String, trim: true }],
    notes: { type: String, maxlength: 5000 },
    importBatchId: { type: Schema.Types.ObjectId, ref: "StakeholderImport" },
  },
  { timestamps: true }
);

// Unique mobile per tenant
stakeholderSchema.index({ tenantId: 1, mobile: 1 }, { unique: true });
stakeholderSchema.index({ tenantId: 1, createdAt: -1 });
stakeholderSchema.index({ tenantId: 1, stakeholderType: 1 });

export const Stakeholder: Model<IStakeholder> =
  mongoose.models.Stakeholder ??
  mongoose.model<IStakeholder>("Stakeholder", stakeholderSchema);