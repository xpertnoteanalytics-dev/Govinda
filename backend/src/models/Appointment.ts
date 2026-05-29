import mongoose from "mongoose";

const appointmentSchema = new mongoose.Schema(
  {
    patientName: String,
    phone: String,
    service: String,
    appointmentDate: String,
    appointmentTime: String,
    source: String,
    notes: String,
  },
  { timestamps: true }
);

export const Appointment = mongoose.model(
  "Appointment",
  appointmentSchema
);