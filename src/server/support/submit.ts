import "server-only";

import { supportContent } from "@/content/support";
import type { FormState } from "@/lib/form-state";
import { ApiError } from "@/server/api/errors";
import { failureState, validationState } from "@/server/form";

import type { SupportContactPayload } from "./contact";

type SupportTopic = (typeof supportContent.topics)[number]["value"];

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
  submit: (payload: SupportContactPayload) => Promise<void>;
  takeQuota: (clientKey: string) => { allowed: boolean };
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

  try {
    await deps.submit({
      topic: input.topic,
      name: input.name.trim(),
      email: input.email.trim(),
      message: input.message.trim(),
      consent: input.consent,
    });
  } catch (error) {
    if (error instanceof ApiError) return failureState(error);
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

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
