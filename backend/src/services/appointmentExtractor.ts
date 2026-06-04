// src/services/appointmentExtractor.ts
import { Appointment } from "../models/Appointment";

export async function extractAppointmentAndSave(
  userMessage: string,
  aiResponse: string,
  tenantId: string
): Promise<void> {
  try {
    const combined = (userMessage + " " + aiResponse).toLowerCase();

    const appointmentKeywords = [
      "appointment",
      "book",
      "schedule",
      "booked",
      "scheduled",
      "confirmed",
    ];

    const hasAppointment = appointmentKeywords.some((k) => combined.includes(k));
    if (!hasAppointment) return;

    const nameMatch =
      userMessage.match(/(?:for|patient|name)[:\s]+([A-Za-z\s]+)/i) ??
      aiResponse.match(/(?:for|patient|name)[:\s]+([A-Za-z\s]+)/i);

    const dateMatch =
      userMessage.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i) ??
      aiResponse.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i);

    const timeMatch =
      userMessage.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm))/i) ??
      aiResponse.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm))/i);

    const serviceMatch =
      userMessage.match(/(?:for|service|consultation|test)[:\s]+([A-Za-z\s]+)/i) ??
      aiResponse.match(/(?:service|consultation|test)[:\s]+([A-Za-z\s]+)/i);

    await Appointment.create({
      tenantId,
      patientName: nameMatch?.[1]?.trim() ?? "Unknown",
      service: serviceMatch?.[1]?.trim() ?? "General consultation",
      appointmentDate: dateMatch?.[1]?.trim() ?? "TBD",
      appointmentTime: timeMatch?.[1]?.trim() ?? "TBD",
      source: "ai_chat",
      notes: `Auto-extracted.\nUser: ${userMessage.slice(0, 200)}`,
    });

    console.log("[appointment] saved from chat");
  } catch (err) {
    console.error("[appointment] failed to save:", err);
  }
}