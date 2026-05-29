import { apiFetch } from "./api";

export interface CompanyOutreachConfig {
  companySupportEmail: string | null;
  companyWhatsAppNumber: string | null;
  email: {
    from: string | null;
    provider: string;
    configured: boolean;
  };
  whatsapp: {
    from: string | null;
    provider: string;
    apiConfigured: boolean;
    companySendAvailable: boolean;
  };
}

export async function getCompanyOutreachConfig(): Promise<CompanyOutreachConfig> {
  return apiFetch<CompanyOutreachConfig>("/v1/operations/outreach-config");
}
