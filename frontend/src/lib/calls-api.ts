import { apiFetch } from "./api";

export type ObjectiveType =
  | "appointment_booking"
  | "feedback_collection"
  | "pharmacy_inquiry"
  | "doctor_verification"
  | "hospital_onboarding"
  | "sales_outreach"
  | "insurance_verification"
  | "lab_result_followup"
  | "patient_reminder"
  | "custom";

export type EnabledTool =
  | "appointment_booking"
  | "crm_update"
  | "human_transfer"
  | "whatsapp_followup"
  | "callback_schedule"
  | "post_call_extraction";

export interface CallRecord {
  id: string;
  recipientName: string;
  phoneNumber: string;
  recipientCategory?: string;
  objectiveType?: ObjectiveType;
  customObjectiveText?: string;
  businessContext?: string;
  status: string;
  direction: string;
  exotelCallSid?: string;
  recordingUrl?: string;
  durationSeconds?: number;
  notes?: string;
  enabledTools?: EnabledTool[];
  initiatedBy?: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
}

export interface CallAnalytics {
  totalCalls: number;
  completedCalls: number;
  failedCalls: number;
  successRate: number;
  recent: Array<{
    recipientName: string;
    status: string;
    createdAt: string;
    durationSeconds?: number;
    initiatedBy?: { id: string; name: string };
  }>;
}

export interface InitiateCallInput {
  recipientName: string;
  phoneNumber: string;
  recipientCategory?: string;
  objectiveType?: ObjectiveType;
  customObjectiveText?: string;
  businessContext?: string;
  notes?: string;
  enabledTools?: EnabledTool[];
}

export async function listCalls(): Promise<CallRecord[]> {
  const data = await apiFetch<{ calls: CallRecord[] }>("/v1/calls");
  return data.calls;
}

export async function getCallAnalytics(): Promise<CallAnalytics> {
  return apiFetch<CallAnalytics>("/v1/calls/analytics");
}

export async function initiateCall(input: InitiateCallInput): Promise<CallRecord> {
  const data = await apiFetch<{ call: CallRecord }>("/v1/calls/initiate", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return data.call;
}
