// src/models/Appointment.ts
import mongoose from "mongoose";

const appointmentSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", index: true },
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

export const Appointment = mongoose.model("Appointment", appointmentSchema);