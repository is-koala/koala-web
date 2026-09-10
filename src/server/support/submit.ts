import "server-only";

import { supportContent } from "@/content/support";
import type { FormState } from "@/lib/form-state";
import { validationState } from "@/server/form";

type SupportTopic = (typeof supportContent.topics)[number]["value"];

export type SupportMail = {
  to: string;
  replyTo: string;
  subject: string;
  text: string;
};

export type SupportMailer = {
  send(mail: SupportMail): Promise<void>;
};

export type SupportRequestInput = {
  topic: string;
  name: string;
  email: string;
  message: string;
  consent: boolean;
  honeypot: string;
  clientKey: string;
};

export type SubmitSupportDependencies = {
  mailer: SupportMailer;
  takeQuota: (clientKey: string) => { allowed: boolean };
  mailbox: string;
};

const nameLimit = 100;
const messageLimit = 4_000;

export async function submitSupportRequest(
  input: SupportRequestInput,
  deps: SubmitSupportDependencies,
): Promise<FormState> {
  if (input.honeypot.trim() !== "") return { status: "done" };

  const fieldErrors = requestErrors(input);
  if (fieldErrors) return validationState(fieldErrors);

  if (!deps.takeQuota(input.clientKey).allowed) {
    return { status: "error", errorCode: "TOO_MANY_REQUESTS", httpStatus: 429 };
  }

  const topic = input.topic as SupportTopic;
  const name = input.name.trim();
  const email = input.email.trim();
  const message = input.message.trim();

  try {
    await deps.mailer.send({
      to: deps.mailbox,
      replyTo: email,
      subject: `[Koala] ${topicLabel(topic)} — ${name}`,
      text: [
        `Konu: ${topicLabel(topic)}`,
        `Ad: ${name}`,
        `E-posta: ${email}`,
        "",
        message,
      ].join("\n"),
    });
  } catch {
    // Posta gövdesi ve alıcı adresi hata nesnesine hiç girmez: Sentry ve
    // log, başvuru metnini taşıyamasın.
    return { status: "error", errorCode: "EMAIL_SEND_FAILED", httpStatus: 502 };
  }

  return { status: "done" };
}

function requestErrors(input: SupportRequestInput): Record<string, string> | null {
  const errors: Record<string, string> = {};
  if (!isSupportTopic(input.topic)) errors.topic = "Konu seçmen gerekiyor.";

  const name = input.name.trim();
  if (!name) errors.name = "Adını yaz.";
  else if (name.length > nameLimit) errors.name = `En fazla ${nameLimit} karakter olabilir.`;

  const email = input.email.trim();
  if (!email) errors.email = "Geçerli bir e-posta adresi yaz.";
  else if (!isEmail(email)) errors.email = "Geçerli bir e-posta adresi yaz.";

  const message = input.message.trim();
  if (!message) errors.message = "Mesajını yaz.";
  else if (message.length > messageLimit) {
    errors.message = `En fazla ${messageLimit} karakter olabilir.`;
  }

  if (!input.consent) {
    errors.consent = "Aydınlatma metnini okuduğunu onaylaman gerekiyor.";
  }

  return Object.keys(errors).length > 0 ? errors : null;
}

function isSupportTopic(value: string): value is SupportTopic {
  return supportContent.topics.some((topic) => topic.value === value);
}

function topicLabel(topic: SupportTopic): string {
  return supportContent.topics.find((item) => item.value === topic)?.label ?? topic;
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
