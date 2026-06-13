// src/models/StakeholderImport.ts

import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IStakeholderImport extends Document {
  tenantId: Types.ObjectId;
  userId: Types.ObjectId;
  fileName: string;
  totalRows: number;
  imported: number;
  duplicates: number;
  errorCount: number;
  errorDetails?: string[];
  createdAt: Date;
  updatedAt: Date;
}

const stakeholderImportSchema = new Schema<IStakeholderImport>(
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
    },
    fileName: {
      type: String,
      required: true,
      trim: true,
    },
    totalRows: {
      type: Number,
      default: 0,
    },
    imported: {
      type: Number,
      default: 0,
    },
    duplicates: {
      type: Number,
      default: 0,
    },
    errorCount: {
      type: Number,
      default: 0,
    },
    errorDetails: [
      {
        type: String,
      },
    ],
  },
  {
    timestamps: true,
  }
);

stakeholderImportSchema.index({
  tenantId: 1,
  createdAt: -1,
});

export const StakeholderImport: Model<IStakeholderImport> =
  mongoose.models.StakeholderImport ||
  mongoose.model<IStakeholderImport>(
    "StakeholderImport",
    stakeholderImportSchema
  );