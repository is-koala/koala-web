"use server";

import type { FormState } from "@/lib/form-state";
import {
  gradeTypeOptions,
  type AcademicReference,
  type GradeType,
} from "@/lib/profile";
import { failureView, textField, validationState } from "@/server/form";
import {
  createEducation,
  deleteEducation,
  getDepartments,
  getFaculties,
  updateEducation,
  type EducationWrite,
} from "@/server/profile/profile";
import { requireSessionForCurrentPath } from "@/server/session/guard";

import {
  dateRangeFrom,
  invalidRecord,
  isRecordId,
  runProfileMutation,
} from "./action-support";

const gradeTypes = new Set<GradeType>(gradeTypeOptions.map(({ value }) => value));

export async function createEducationAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireSessionForCurrentPath();
  const parsed = educationFrom(formData);
  if ("status" in parsed) return parsed;
  return runProfileMutation(() => createEducation(parsed));
}

export async function updateEducationAction(
  id: string,
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireSessionForCurrentPath();
  if (!isRecordId(id)) return invalidRecord();
  const parsed = educationFrom(formData);
  if ("status" in parsed) return parsed;
  return runProfileMutation(() => updateEducation(id, parsed));
}

export async function deleteEducationAction(
  id: string,
  _state: FormState,
  _formData: FormData,
): Promise<FormState> {
  void _state;
  void _formData;

  await requireSessionForCurrentPath();
  if (!isRecordId(id)) return invalidRecord();
  return runProfileMutation(() => deleteEducation(id));
}

export type ReferenceActionResult =
  | { status: "done"; items: readonly AcademicReference[] }
  | { status: "error"; errorCode: string; httpStatus: number };

export async function loadFacultiesAction(universityId: string): Promise<ReferenceActionResult> {
  await requireSessionForCurrentPath();
  if (!isRecordId(universityId)) return referenceValidationFailure;
  try {
    return { status: "done", items: await getFaculties(universityId) };
  } catch (error) {
    return { status: "error", ...failureView(error) };
  }
}

export async function loadDepartmentsAction(facultyId: string): Promise<ReferenceActionResult> {
  await requireSessionForCurrentPath();
  if (!isRecordId(facultyId)) return referenceValidationFailure;
  try {
    return { status: "done", items: await getDepartments(facultyId) };
  } catch (error) {
    return { status: "error", ...failureView(error) };
  }
}

function educationFrom(formData: FormData): EducationWrite | FormState {
  const universityId = textField(formData, "universityId");
  const facultyId = textField(formData, "facultyId");
  const departmentId = textField(formData, "departmentId");
  const type = textField(formData, "type") as GradeType;
  const rawGpa = textField(formData, "gpa");
  const gpa = Number(rawGpa);
  const { startDate, endDate, errors: fieldErrors } = dateRangeFrom(formData);

  if (!isRecordId(universityId)) fieldErrors.universityId = "Bir üniversite seç.";
  if (!isRecordId(facultyId)) fieldErrors.facultyId = "Bir fakülte seç.";
  if (!isRecordId(departmentId)) fieldErrors.departmentId = "Bir bölüm seç.";
  if (!gradeTypes.has(type)) fieldErrors.type = "Geçerli bir eğitim durumu seç.";
  if (!rawGpa || !Number.isFinite(gpa) || gpa < 0 || gpa > 4) {
    fieldErrors.gpa = "Not ortalaması 0 ile 4 arasında olmalıdır.";
  }
  if (Object.keys(fieldErrors).length > 0) return validationState(fieldErrors);

  return {
    universityId,
    facultyId,
    departmentId,
    type,
    gpa,
    startDate,
    endDate: endDate || null,
  };
}

const referenceValidationFailure: ReferenceActionResult = {
  status: "error",
  errorCode: "VALIDATION_FAILED",
  httpStatus: 400,
};
