import { env } from "../config/env";
import * as emailProvider from "./providers/emailProvider";
import * as whatsappProvider from "./providers/whatsappProvider";

/** Company-operated sender identity for healthcare outreach. */
export function getCompanySupportEmail(): string {
  return (
    env.company.supportEmail.trim() ||
    env.email.from.trim() ||
    ""
  );
}

export function getCompanyWhatsAppNumber(): string {
  return (
    env.company.whatsappNumber.trim() ||
    env.whatsapp.twilio.fromNumber.replace(/^whatsapp:/i, "").trim() ||
    ""
  );
}

export function getCompanyOutreachConfig() {
  const companySupportEmail = getCompanySupportEmail();
  const companyWhatsAppNumber = getCompanyWhatsAppNumber();

  return {
    companySupportEmail: companySupportEmail || null,
    companyWhatsAppNumber: companyWhatsAppNumber || null,
    email: {
      from: companySupportEmail || null,
      provider: env.email.provider,
      configured: Boolean(companySupportEmail) && emailProvider.isEmailProviderConfigured(),
    },
    whatsapp: {
      from: companyWhatsAppNumber || null,
      provider: env.whatsapp.provider,
      apiConfigured: whatsappProvider.isWhatsAppApiConfigured(),
      /** Log mode still sends through company workflow without personal device. */
      companySendAvailable:
        Boolean(companyWhatsAppNumber) &&
        (env.whatsapp.provider === "log" || whatsappProvider.isWhatsAppApiConfigured()),
    },
  };
}

/** Brand outbound copy as official company support outreach. */
export function applyCompanyMessageBranding(message: string, organizationName?: string): string {
  const org = organizationName?.trim() || "Healthcare Operations";
  const supportEmail = getCompanySupportEmail();
  const whatsapp = getCompanyWhatsAppNumber();

  const footerParts = [`— ${org} Support`];
  if (supportEmail) footerParts.push(supportEmail);
  if (whatsapp) footerParts.push(whatsapp);

  const footer = footerParts.join(" · ");
  if (message.includes(footer)) return message;
  return `${message.trim()}\n\n${footer}`;
}
