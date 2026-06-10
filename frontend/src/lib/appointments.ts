// src/lib/api/appointments.ts
import { apiFetch } from "@/lib/api";

export interface Appointment {
  _id: string;
  patientName: string;
  phone?: string;
  service: string;
  appointmentDate: string;
  appointmentTime: string;
  source?: string;
  notes?: string;
  createdAt: string;
}

export interface CreateAppointmentInput {
  patientName: string;
  phone?: string;
  service: string;
  appointmentDate: string;
  appointmentTime: string;
  notes?: string;
}

export async function fetchAppointments(): Promise<Appointment[]> {
  return apiFetch<Appointment[]>("/v1/appointments");
}

export async function createAppointment(
  data: CreateAppointmentInput
): Promise<Appointment> {
  return apiFetch<Appointment>("/v1/appointments", {
    method: "POST",
    body: JSON.stringify(data),
  });
}