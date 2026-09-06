import "server-only";

import { revalidatePath } from "next/cache";

import type { FormState } from "@/lib/form-state";
import { failureState, textField, validationState } from "@/server/form";

const profilePath = "/panel/profil";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export async function runProfileMutation(
  operation: () => Promise<unknown>,
): Promise<FormState> {
  try {
    await operation();
    revalidatePath(profilePath);
    return { status: "done" };
  } catch (error) {
    return failureState(error);
  }
}

export function isRecordId(value: string): boolean {
  return uuidPattern.test(value);
}

export function invalidRecord(): FormState {
  return validationState({ record: "Kayıt kimliği geçerli değil." });
}

export function nullableText(formData: FormData, name: string): string | null {
  return textField(formData, name).trim() || null;
}

export function dateRangeFrom(formData: FormData): {
  startDate: string;
  endDate: string;
  errors: Record<string, string>;
} {
  const startDate = textField(formData, "startDate");
  const endDate = textField(formData, "endDate");
  const errors: Record<string, string> = {};

  if (!datePattern.test(startDate)) errors.startDate = "Geçerli bir başlangıç tarihi seç.";
  if (endDate && !datePattern.test(endDate)) errors.endDate = "Geçerli bir bitiş tarihi seç.";
  if (endDate && startDate && endDate < startDate) {
    errors.endDate = "Bitiş tarihi başlangıç tarihinden önce olamaz.";
  }

  return { startDate, endDate, errors };
}
