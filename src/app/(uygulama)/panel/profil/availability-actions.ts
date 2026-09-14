"use server";

import { maximumExceptionNoteLength, parseSlots, slotFieldNames } from "@/lib/availability";
import type { FormState } from "@/lib/form-state";
import { textField, validationState } from "@/server/form";
import {
  deleteAvailabilityException,
  saveAvailability,
  saveAvailabilityException,
} from "@/server/profile/availability";
import { requireSessionForCurrentPath } from "@/server/session/guard";

import { invalidRecord, isRecordId, nullableText, runProfileMutation } from "./action-support";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Haftalık aralıkların tamamını yazar.
 *
 * Satır alanları tekrar eden üç ad olarak geliyor (`slotDay[]`, `slotStart[]`,
 * `slotEnd[]`); boş liste de geçerli — kullanıcı bütün aralıkları silmiş demek.
 */
export async function saveAvailabilityAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireSessionForCurrentPath();

  const parsed = parseSlots(
    strings(formData, slotFieldNames.dayOfWeek),
    strings(formData, slotFieldNames.startTime),
    strings(formData, slotFieldNames.endTime),
  );
  if (parsed.error !== undefined) return validationState({ slots: parsed.error });

  return runProfileMutation(() => saveAvailability(parsed.slots));
}

export async function saveAvailabilityExceptionAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireSessionForCurrentPath();

  const date = textField(formData, "date");
  const available = textField(formData, "available");
  const note = nullableText(formData, "note");
  const fieldErrors: Record<string, string> = {};

  if (!datePattern.test(date)) fieldErrors.date = "Geçerli bir tarih seç.";
  if (available !== "true" && available !== "false") {
    fieldErrors.available = "O gün müsait olup olmadığını seç.";
  }
  if (note !== null && note.length > maximumExceptionNoteLength) {
    fieldErrors.note = `Not en fazla ${maximumExceptionNoteLength} karakter olabilir.`;
  }
  if (Object.keys(fieldErrors).length > 0) return validationState(fieldErrors);

  return runProfileMutation(() =>
    saveAvailabilityException({ date, available: available === "true", note }),
  );
}

export async function deleteAvailabilityExceptionAction(
  exceptionId: string,
  _state: FormState,
  _formData: FormData,
): Promise<FormState> {
  void _state;
  void _formData;

  await requireSessionForCurrentPath();
  if (!isRecordId(exceptionId)) return invalidRecord();
  return runProfileMutation(() => deleteAvailabilityException(exceptionId));
}

function strings(formData: FormData, name: string): string[] {
  return formData.getAll(name).filter((value): value is string => typeof value === "string");
}
