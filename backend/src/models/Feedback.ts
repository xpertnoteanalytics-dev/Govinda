import mongoose from "mongoose";

const feedbackSchema = new mongoose.Schema(
  {
    patientName: String,
    feedback: String,
    sentiment: String,
    source: String,
  },
  { timestamps: true }
);

export const Feedback = mongoose.model(
  "Feedback",
  feedbackSchema
);