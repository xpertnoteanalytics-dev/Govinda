// src/models/ImportedPlace.ts
import mongoose, { Schema, Document, Model, Types } from "mongoose";
import type { PlaceCategory } from "../types/places";

export interface IImportedPlace extends Document {
  tenantId: Types.ObjectId;
  userId: Types.ObjectId;
  name: string;
  category: PlaceCategory;
  phone?: string;
  address?: string;
  lat: number;
  lng: number;
  source: "csv_import";
  createdAt: Date;
  updatedAt: Date;
}

const importedPlaceSchema = new Schema<IImportedPlace>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: [
        "pharmacy", "hospital", "ngo", "polyclinic", "clinic",
        "diagnostic_center", "medical_lab", "blood_bank", "school",
        "college", "university", "community_center", "government_office",
        "corporate_office",
      ],
      required: true,
    },
    phone: { type: String, trim: true },
    address: { type: String, trim: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    source: { type: String, default: "csv_import" },
  },
  { timestamps: true }
);

importedPlaceSchema.index({ tenantId: 1, lat: 1, lng: 1, name: 1 });

export const ImportedPlace: Model<IImportedPlace> =
  mongoose.models.ImportedPlace ??
  mongoose.model<IImportedPlace>("ImportedPlace", importedPlaceSchema);