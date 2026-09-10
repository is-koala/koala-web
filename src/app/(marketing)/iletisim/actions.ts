"use server";

import { headers } from "next/headers";

import type { FormState } from "@/lib/form-state";
import { ingressClientIpHeader } from "@/server/contract";
import { textField } from "@/server/form";
import { smtpMailer, supportMailbox } from "@/server/support/mailer";
import { takeSupportQuota } from "@/server/support/rate-limit";
import { submitSupportRequest } from "@/server/support/submit";

/**
 * Destek formunun BFF eylemi. Tarayıcı SMTP ile konuşmaz; gönderim burada.
 */
export async function submitSupportAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  return submitSupportRequest(
    {
      topic: textField(formData, "topic"),
      name: textField(formData, "name"),
      email: textField(formData, "email"),
      message: textField(formData, "message"),
      consent: textField(formData, "consent") === "granted",
      honeypot: textField(formData, "website"),
      clientKey: supportClientKey(await headers()),
    },
    {
      mailer: smtpMailer(),
      takeQuota: takeSupportQuota,
      mailbox: supportMailbox(),
    },
  );
}

function supportClientKey(requestHeaders: Headers): string {
  const candidate = requestHeaders.get(ingressClientIpHeader)?.trim();
  if (candidate && candidate.length <= 64 && /^[0-9a-f.:]+$/i.test(candidate)) {
    return candidate;
  }
  return "unknown-client";
}
