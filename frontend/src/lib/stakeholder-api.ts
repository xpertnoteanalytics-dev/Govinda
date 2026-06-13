// src/lib/stakeholder-api.ts
import { apiFetch } from "./api";

export type StakeholderType =
  | "patient" | "partner" | "employee" | "sponsor"
  | "vendor" | "donor" | "government" | "other";

export interface Stakeholder {
  _id: string;
  name: string;
  email?: string;
  mobile: string;
  organizationName?: string;
  organizationAddress?: string;
  stakeholderType: StakeholderType;
  notes?: string;
  tags?: string[];
  createdAt: string;
}

export interface StakeholderInteraction {
  _id: string;
  stakeholderId: string;
  channel: string;
  summary: string;
  sentiment: "positive" | "neutral" | "negative";
  feedback?: string;
  suggestions?: string[];
  actionItems?: string[];
  topics?: string[];
  createdAt: string;
}

export interface StakeholderImport {
  _id: string;
  fileName: string;
  totalRows: number;
  imported: number;
  duplicates: number;
  errors: number;
  errorDetails?: string[];
  createdAt: string;
}

export interface StakeholderAnalytics {
  total: number;
  byType: Record<string, number>;
  totalInteractions: number;
  sentiments: Record<string, number>;
}

export interface ImportRecord {
  name: string;
  email?: string;
  mobile: string;
  organizationName?: string;
  organizationAddress?: string;
  stakeholderType?: string;
}

export interface ImportResult {
  imported: number;
  duplicates: number;
  errors: number;
  errorDetails: string[];
  batchId: string;
}

export async function fetchStakeholders(params?: {
  type?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<{ stakeholders: Stakeholder[]; total: number }> {
  const qs = new URLSearchParams();
  if (params?.type) qs.set("type", params.type);
  if (params?.search) qs.set("search", params.search);
  if (params?.page) qs.set("page", String(params.page));
  if (params?.limit) qs.set("limit", String(params.limit));
  return apiFetch<{ stakeholders: Stakeholder[]; total: number }>(
    `/v1/stakeholders?${qs.toString()}`
  );
}

export async function fetchStakeholderAnalytics(): Promise<StakeholderAnalytics> {
  return apiFetch<StakeholderAnalytics>("/v1/stakeholders/analytics");
}

export async function fetchImportHistory(): Promise<StakeholderImport[]> {
  const data = await apiFetch<{ imports: StakeholderImport[] }>("/v1/stakeholders/imports");
  return data.imports;
}

export async function createStakeholder(data: Partial<Stakeholder>): Promise<Stakeholder> {
  const res = await apiFetch<{ stakeholder: Stakeholder }>("/v1/stakeholders", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return res.stakeholder;
}

export async function deleteStakeholder(id: string): Promise<void> {
  await apiFetch(`/v1/stakeholders/${id}`, { method: "DELETE" });
}

export async function bulkImportStakeholders(
  records: ImportRecord[],
  fileName: string
): Promise<ImportResult> {
  return apiFetch<ImportResult>("/v1/stakeholders/import/bulk", {
    method: "POST",
    body: JSON.stringify({ records, fileName }),
  });
}

export function parseStakeholderCsv(text: string): ImportRecord[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];

  function splitLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') { inQuotes = !inQuotes; }
      else if (char === "," && !inQuotes) { result.push(current.trim()); current = ""; }
      else { current += char; }
    }
    result.push(current.trim());
    return result;
  }

  const headers = splitLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, "_"));

  const idx = (key: string) => headers.indexOf(key);
  const nameIdx = idx("name");
  const mobileIdx = idx("mobile") !== -1 ? idx("mobile") : idx("mobile_number");
  const emailIdx = idx("email");
  const orgIdx = idx("organization_name");
  const addrIdx = idx("organization_address");
  const typeIdx = idx("stakeholder_type");

  if (nameIdx === -1 || mobileIdx === -1) {
    throw new Error("CSV must have columns: Name, Mobile");
  }

  return lines.slice(1)
    .filter((l) => l.trim())
    .map((line) => {
      const cols = splitLine(line);
      return {
        name: cols[nameIdx] ?? "",
        mobile: cols[mobileIdx] ?? "",
        email: emailIdx !== -1 ? cols[emailIdx] || undefined : undefined,
        organizationName: orgIdx !== -1 ? cols[orgIdx] || undefined : undefined,
        organizationAddress: addrIdx !== -1 ? cols[addrIdx] || undefined : undefined,
        stakeholderType: typeIdx !== -1 ? cols[typeIdx] || undefined : undefined,
      };
    });
}