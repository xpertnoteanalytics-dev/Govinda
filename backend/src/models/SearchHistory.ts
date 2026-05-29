import mongoose, { Schema, Document, Model, Types } from "mongoose";
import type { PlaceCategory } from "../types/places";

export interface ISearchHistory extends Document {
  tenantId: Types.ObjectId;
  userId: Types.ObjectId;
  category: PlaceCategory;
  city?: string;
  locationLabel: string;
  lat: number;
  lng: number;
  radius: number;
  resultCount: number;
  topResultName?: string;
  createdAt: Date;
  updatedAt: Date;
}

const searchHistorySchema = new Schema<ISearchHistory>(
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
    category: {
      type: String,
      enum: ["pharmacy", "hospital", "ngo", "polyclinic"],
      required: true,
    },
    city: { type: String, trim: true },
    locationLabel: { type: String, required: true, trim: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    radius: { type: Number, required: true, min: 500, max: 50000 },
    resultCount: { type: Number, default: 0 },
    topResultName: { type: String, trim: true },
  },
  { timestamps: true }
);

searchHistorySchema.index({ tenantId: 1, userId: 1, createdAt: -1 });

export const SearchHistory: Model<ISearchHistory> =
  mongoose.models.SearchHistory ??
  mongoose.model<ISearchHistory>("SearchHistory", searchHistorySchema);
