// src/models/Feedback.ts
import mongoose from "mongoose";

const feedbackSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", index: true },
    patientName: String,
    feedback: String,
    sentiment: String,
    source: String,
  },
  { timestamps: true }
);

export const Feedback = mongoose.model("Feedback", feedbackSchema);