"use server";

import { headers } from "next/headers";

import { homeContent } from "@/content/marketing";
import type { FormState } from "@/lib/form-state";
import { ingressClientIpHeader } from "@/server/contract";
import { textField } from "@/server/form";
import { postSupportContact } from "@/server/support/contact";
import { takeSupportQuota } from "@/server/support/rate-limit";
import { submitSupportRequest } from "@/server/support/submit";

/**
 * Ana sayfadaki erken erişim formunun BFF eylemi.
 *
 * Ayrı bir liste ucu yok; kayıt, `/iletisim` ile aynı yoldan
 * (`POST /public/contact`) destek kutusuna düşer. Konu ve mesaj sabit, böylece
 * kutuda "erken erişim" kayıtları tek satırla süzülebiliyor. Bal küpü, hız
 * sınırı ve KVKK onayı destek formuyla aynı kurallara tabi.
 */
export async function submitEarlyAccessAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  return submitSupportRequest(
    {
      topic: homeContent.earlyAccess.submission.topic,
      name: textField(formData, "name"),
      email: textField(formData, "email"),
      message: homeContent.earlyAccess.submission.message,
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
