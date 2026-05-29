export type OutreachType =
  | "pharmacy_inquiry"
  | "appointment_scheduling"
  | "healthcare_coordination"
  | "partnership_outreach"
  | "follow_up";

export const OUTREACH_OPTIONS: {
  id: OutreachType;
  label: string;
  hint: string;
}[] = [
  {
    id: "pharmacy_inquiry",
    label: "Pharmacy inquiry",
    hint: "Stock, delivery, coordination",
  },
  {
    id: "appointment_scheduling",
    label: "Appointments",
    hint: "Scheduling & callbacks",
  },
  {
    id: "healthcare_coordination",
    label: "Care coordination",
    hint: "Referrals & follow-up",
  },
  {
    id: "partnership_outreach",
    label: "Partnership",
    hint: "Collaboration outreach",
  },
  {
    id: "follow_up",
    label: "Follow-up",
    hint: "Prior outreach recap",
  },
];
