import "server-only";

import { apiFetch } from "@/server/api/client";
import { backendPaths } from "@/server/contract";
import { anonymousCaller } from "@/server/session/session";

export type SupportContactPayload = {
  topic: string;
  name: string;
  email: string;
  message: string;
  consent: boolean;
};

/**
 * Destek formunu backend kuyruğuna bırakır.
 *
 * SMTP burada yok: `POST /public/contact` `SUPPORT_MAILBOX`'a (varsayılan
 * `info@iskoala.com`) mevcut `JavaMailSender` ile gider. Tarayıcı
 * `api.iskoala.com` ile konuşmaz.
 */
export async function postSupportContact(input: SupportContactPayload): Promise<void> {
  await apiFetch<null>(backendPaths.publicContact, {
    ...(await anonymousCaller()),
    method: "POST",
    body: input,
  });
}
