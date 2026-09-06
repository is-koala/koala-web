"use server";

import type { FormState } from "@/lib/form-state";
import { employmentTypeOptions, type EmploymentType } from "@/lib/profile";
import { textField, validationState } from "@/server/form";
import {
  createExperience,
  deleteExperience,
  updateExperience,
  type ExperienceWrite,
} from "@/server/profile/profile";
import { requireSessionForCurrentPath } from "@/server/session/guard";

import {
  dateRangeFrom,
  invalidRecord,
  isRecordId,
  nullableText,
  runProfileMutation,
} from "./action-support";

const employmentTypes = new Set<EmploymentType>(employmentTypeOptions.map(({ value }) => value));

export async function createExperienceAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireSessionForCurrentPath();
  const parsed = experienceFrom(formData);
  if ("status" in parsed) return parsed;
  return runProfileMutation(() => createExperience(parsed));
}

export async function updateExperienceAction(
  id: string,
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireSessionForCurrentPath();
  if (!isRecordId(id)) return invalidRecord();
  const parsed = experienceFrom(formData);
  if ("status" in parsed) return parsed;
  return runProfileMutation(() => updateExperience(id, parsed));
}

export async function deleteExperienceAction(
  id: string,
  _state: FormState,
  _formData: FormData,
): Promise<FormState> {
  void _state;
  void _formData;

  await requireSessionForCurrentPath();
  if (!isRecordId(id)) return invalidRecord();
  return runProfileMutation(() => deleteExperience(id));
}

function experienceFrom(formData: FormData): ExperienceWrite | FormState {
  const title = textField(formData, "title").trim();
  const rawEmploymentType = textField(formData, "employmentType") as EmploymentType;
  const { startDate, endDate, errors: fieldErrors } = dateRangeFrom(formData);

  if (!title) fieldErrors.title = "Pozisyon adı zorunludur.";
  if (rawEmploymentType && !employmentTypes.has(rawEmploymentType)) {
    fieldErrors.employmentType = "Geçerli bir çalışma türü seç.";
  }
  if (Object.keys(fieldErrors).length > 0) return validationState(fieldErrors);

  return {
    title,
    companyName: nullableText(formData, "companyName"),
    employmentType: rawEmploymentType || null,
    cityName: nullableText(formData, "cityName"),
    startDate,
    endDate: endDate || null,
    description: nullableText(formData, "description"),
  };
}
