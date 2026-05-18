import mongoose, { Schema, Document, Model } from "mongoose";

export interface ITenant extends Document {
  name: string;
  slug: string;
  domain?: string;
  plan: "free" | "starter" | "professional" | "enterprise";
  isActive: boolean;
  settings: {
    timezone: string;
    locale: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const tenantSchema = new Schema<ITenant>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    },
    domain: {
      type: String,
      trim: true,
      lowercase: true,
    },
    plan: {
      type: String,
      enum: ["free", "starter", "professional", "enterprise"],
      default: "free",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    settings: {
      timezone: { type: String, default: "UTC" },
      locale: { type: String, default: "en-US" },
    },
  },
  { timestamps: true }
);

tenantSchema.index({ isActive: 1 });

export const Tenant: Model<ITenant> =
  mongoose.models.Tenant ?? mongoose.model<ITenant>("Tenant", tenantSchema);
