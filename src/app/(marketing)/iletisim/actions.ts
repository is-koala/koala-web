"use server";

import { headers } from "next/headers";

import type { FormState } from "@/lib/form-state";
import { ingressClientIpHeader } from "@/server/contract";
import { textField } from "@/server/form";
import { postSupportContact } from "@/server/support/contact";
import { takeSupportQuota } from "@/server/support/rate-limit";
import { submitSupportRequest } from "@/server/support/submit";

/**
 * Destek formunun BFF eylemi. Tarayıcı ve Next SMTP ile konuşmaz; gönderim
 * `POST /public/contact` üzerinden backend kuyruğuna düşer.
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
      submit: postSupportContact,
      takeQuota: takeSupportQuota,
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
