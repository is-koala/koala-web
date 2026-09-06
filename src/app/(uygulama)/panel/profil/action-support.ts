import "server-only";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";

import type { FormState } from "@/lib/form-state";
import { isUuid } from "@/lib/identifiers";
import { failureState, textField, validationState } from "@/server/form";

const profilePath = "/panel/profil";
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export async function runProfileMutation(
  operation: () => Promise<unknown>,
): Promise<FormState> {
  try {
    await operation();
    revalidatePath(profilePath);
    return { status: "done" };
  } catch (error) {
    unstable_rethrow(error);
    return failureState(error);
  }
}

export function isRecordId(value: string): boolean {
  return isUuid(value);
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
