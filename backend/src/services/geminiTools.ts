import { SchemaType, type Tool } from "@google/generative-ai";

export const AI_TOOLS: Tool[] = [
  {
    functionDeclarations: [
      {
        name: "create_appointment",
        description:
          "Create a new appointment. Call this ONLY when you have collected ALL required fields " +
          "(patientName, phone, service, appointmentDate, appointmentTime) AND the user has " +
          "explicitly confirmed they want to proceed.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            patientName: {
              type: SchemaType.STRING,
              description: "Full name of the patient",
            },
            phone: {
              type: SchemaType.STRING,
              description: "Patient's contact phone number",
            },
            service: {
              type: SchemaType.STRING,
              description: "Service or test to be booked (e.g. blood test, X-ray, general consultation)",
            },
            appointmentDate: {
              type: SchemaType.STRING,
              description: "Date of the appointment in YYYY-MM-DD format",
            },
            appointmentTime: {
              type: SchemaType.STRING,
              description: "Time of the appointment in HH:MM format (24-hour)",
            },
            notes: {
              type: SchemaType.STRING,
              description: "Any additional notes (optional)",
            },
          },
          required: ["patientName", "phone", "service", "appointmentDate", "appointmentTime"],
        },
      },
      {
        name: "create_feedback",
        description:
          "Save patient feedback. Call this ONLY when you have collected the feedback text " +
          "and determined its sentiment, AND the user has confirmed they want to submit.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            patientName: {
              type: SchemaType.STRING,
              description: "Name of the patient providing feedback (optional)",
            },
            feedback: {
              type: SchemaType.STRING,
              description: "The actual feedback text",
            },
            sentiment: {
              type: SchemaType.STRING,
              enum: ["positive", "negative", "neutral"],
              description: "Sentiment of the feedback",
            },
          },
          required: ["feedback", "sentiment"],
        },
      },
    ],
  },
];

export type CreateAppointmentArgs = {
  patientName: string;
  phone: string;
  service: string;
  appointmentDate: string;
  appointmentTime: string;
  notes?: string;
};

export type CreateFeedbackArgs = {
  patientName?: string;
  feedback: string;
  sentiment: "positive" | "negative" | "neutral";
};