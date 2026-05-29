import { apiFetch } from "./api";

export type CallScriptType =
  | "pharmacy_inquiry"
  | "appointment_scheduling"
  | "healthcare_coordination";

export interface CallRecord {
  id: string;
  placeId?: string;
  placeName: string;
  phoneNumber: string;
  category?: string;
  status: string;
  direction: string;
  script?: string;
  scriptType?: CallScriptType;
  exotelCallSid?: string;
  recordingUrl?: string;
  durationSeconds?: number;
  notes?: string;
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
    placeName: string;
    status: string;
    createdAt: string;
    durationSeconds?: number;
    initiatedBy?: { id: string; name: string };
  }>;
}

export async function listCalls(): Promise<CallRecord[]> {
  const data = await apiFetch<{ calls: CallRecord[] }>("/v1/calls");
  return data.calls;
}

export async function getCallAnalytics(): Promise<CallAnalytics> {
  return apiFetch<CallAnalytics>("/v1/calls/analytics");
}

export async function generateCallScript(input: {
  placeName: string;
  category: string;
  purpose?: string;
  scriptType?: CallScriptType;
}): Promise<string> {
  const data = await apiFetch<{ script: string }>("/v1/calls/script", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return data.script;
}

export async function initiateCall(input: {
  placeName: string;
  phoneNumber: string;
  placeId?: string;
  category?: string;
  script?: string;
  scriptType?: CallScriptType;
  /** Your staff phone — Exotel connects this leg first, then the facility. */
  agentPhone?: string;
}): Promise<CallRecord> {
  const data = await apiFetch<{ call: CallRecord }>("/v1/calls/initiate", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return data.call;
}
