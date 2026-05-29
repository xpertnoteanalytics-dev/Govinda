export const OUTREACH_TYPES = [
  "pharmacy_inquiry",
  "appointment_scheduling",
  "healthcare_coordination",
  "partnership_outreach",
  "follow_up",
] as const;

export type OutreachType = (typeof OUTREACH_TYPES)[number];

export type OutreachChannel = "email" | "whatsapp";
