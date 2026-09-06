"use server";

import { revalidatePath } from "next/cache";

import type { FormState } from "@/lib/form-state";
import {
  employmentTypeOptions,
  gradeTypeOptions,
  type AcademicReference,
  type EmploymentType,
  type GradeType,
  type NotificationCategory,
  type NotificationChannel,
} from "@/lib/profile";
import { failureState, failureView, textField, validationState } from "@/server/form";
import {
  createEducation,
  createExperience,
  deleteEducation,
  deleteExperience,
  getDepartments,
  getFaculties,
  updateEducation,
  updateExperience,
  updateNotificationPreferences,
  updateProfile,
  uploadProfilePicture,
  type EducationWrite,
  type ExperienceWrite,
  type NotificationPreferenceWrite,
} from "@/server/profile/profile";
import { requireSessionForCurrentPath } from "@/server/session/guard";

const profilePath = "/panel/profil";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const employmentTypes = new Set<EmploymentType>(employmentTypeOptions.map(({ value }) => value));
const gradeTypes = new Set<GradeType>(gradeTypeOptions.map(({ value }) => value));
const notificationCategories = new Set<NotificationCategory>([
  "ACCOUNT_SECURITY",
  "APPLICATION_UPDATES",
  "IDENTITY_VERIFICATION",
  "MARKETINGS",
  "COMPANY_UPDATES",
  "JOB_ALERTS",
  "NEWSLETTER",
]);
const notificationChannels = new Set<NotificationChannel>(["EMAIL", "PUSH", "IN_APP"]);
const allowedImageExtensions = new Set(["png", "jpg", "jpeg", "webp"]);
const maximumImageBytes = 10 * 1024 * 1024;

export async function updateProfileAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  void _state;
  await requireSessionForCurrentPath();

  const namesLocked = textField(formData, "namesLocked") === "true";
  const firstName = textField(formData, "firstName").trim();
  const lastName = textField(formData, "lastName").trim();
  const fieldErrors: Record<string, string> = {};
  if (!namesLocked && !firstName) fieldErrors.firstName = "Adını yazmalısın.";
  if (!namesLocked && !lastName) fieldErrors.lastName = "Soyadını yazmalısın.";
  if (Object.keys(fieldErrors).length > 0) return validationState(fieldErrors);

  return mutate(async () => {
    await updateProfile({
      ...(namesLocked ? {} : { firstName, lastName }),
      jobTitle: textField(formData, "jobTitle").trim(),
      about: textField(formData, "about").trim(),
      qualifications: textField(formData, "qualifications").trim(),
      interests: textField(formData, "interests").trim(),
    });
  });
}

export async function uploadProfilePictureAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  void _state;
  await requireSessionForCurrentPath();

  const image = formData.get("image");
  if (!(image instanceof File) || image.size === 0) {
    return validationState({ image: "Bir fotoğraf seçmelisin." });
  }
  if (image.size > maximumImageBytes) {
    return validationState({ image: "Fotoğraf en fazla 10 MB olabilir." });
  }
  const extension = image.name.split(".").pop()?.toLocaleLowerCase("tr");
  if (!extension || !allowedImageExtensions.has(extension)) {
    return validationState({ image: "PNG, JPG, JPEG veya WEBP biçiminde bir fotoğraf seç." });
  }

  return mutate(() => uploadProfilePicture(image));
}

export async function createExperienceAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireSessionForCurrentPath();
  const parsed = experienceFrom(formData);
  if ("status" in parsed) return parsed;
  return mutate(() => createExperience(parsed));
}

export async function updateExperienceAction(
  id: string,
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireSessionForCurrentPath();
  if (!uuidPattern.test(id)) return invalidRecord();
  const parsed = experienceFrom(formData);
  if ("status" in parsed) return parsed;
  return mutate(() => updateExperience(id, parsed));
}

export async function deleteExperienceAction(
  id: string,
  _state: FormState,
  _formData: FormData,
): Promise<FormState> {
  void _state;
  void _formData;

  await requireSessionForCurrentPath();
  if (!uuidPattern.test(id)) return invalidRecord();
  return mutate(() => deleteExperience(id));
}

export async function createEducationAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireSessionForCurrentPath();
  const parsed = educationFrom(formData);
  if ("status" in parsed) return parsed;
  return mutate(() => createEducation(parsed));
}

export async function updateEducationAction(
  id: string,
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireSessionForCurrentPath();
  if (!uuidPattern.test(id)) return invalidRecord();
  const parsed = educationFrom(formData);
  if ("status" in parsed) return parsed;
  return mutate(() => updateEducation(id, parsed));
}

export async function deleteEducationAction(
  id: string,
  _state: FormState,
  _formData: FormData,
): Promise<FormState> {
  void _state;
  void _formData;

  await requireSessionForCurrentPath();
  if (!uuidPattern.test(id)) return invalidRecord();
  return mutate(() => deleteEducation(id));
}

export async function updateNotificationPreferencesAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireSessionForCurrentPath();
  const preferences = preferenceRows(formData.getAll("preferences"));
  if (preferences === null || preferences.length === 0) {
    return validationState({ preferences: "Güncellenecek iletişim tercihi bulunamadı." });
  }
  return mutate(() => updateNotificationPreferences(preferences));
}

export type ReferenceActionResult =
  | { status: "done"; items: readonly AcademicReference[] }
  | { status: "error"; errorCode: string; httpStatus: number };

export async function loadFacultiesAction(universityId: string): Promise<ReferenceActionResult> {
  await requireSessionForCurrentPath();
  if (!uuidPattern.test(universityId)) return referenceValidationFailure;
  try {
    return { status: "done", items: await getFaculties(universityId) };
  } catch (error) {
    return { status: "error", ...failureView(error) };
  }
}

export async function loadDepartmentsAction(facultyId: string): Promise<ReferenceActionResult> {
  await requireSessionForCurrentPath();
  if (!uuidPattern.test(facultyId)) return referenceValidationFailure;
  try {
    return { status: "done", items: await getDepartments(facultyId) };
  } catch (error) {
    return { status: "error", ...failureView(error) };
  }
}

async function mutate(operation: () => Promise<unknown>): Promise<FormState> {
  try {
    await operation();
    revalidatePath(profilePath);
    return { status: "done" };
  } catch (error) {
    return failureState(error);
  }
}

function experienceFrom(formData: FormData): ExperienceWrite | FormState {
  const title = textField(formData, "title").trim();
  const startDate = textField(formData, "startDate");
  const endDate = textField(formData, "endDate");
  const rawEmploymentType = textField(formData, "employmentType") as EmploymentType;
  const fieldErrors: Record<string, string> = {};

  if (!title) fieldErrors.title = "Pozisyon adı zorunludur.";
  if (!datePattern.test(startDate)) fieldErrors.startDate = "Geçerli bir başlangıç tarihi seç.";
  if (endDate && !datePattern.test(endDate)) fieldErrors.endDate = "Geçerli bir bitiş tarihi seç.";
  if (endDate && startDate && endDate < startDate) {
    fieldErrors.endDate = "Bitiş tarihi başlangıç tarihinden önce olamaz.";
  }
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

function educationFrom(formData: FormData): EducationWrite | FormState {
  const universityId = textField(formData, "universityId");
  const facultyId = textField(formData, "facultyId");
  const departmentId = textField(formData, "departmentId");
  const type = textField(formData, "type") as GradeType;
  const rawGpa = textField(formData, "gpa");
  const gpa = Number(rawGpa);
  const startDate = textField(formData, "startDate");
  const endDate = textField(formData, "endDate");
  const fieldErrors: Record<string, string> = {};

  if (!uuidPattern.test(universityId)) fieldErrors.universityId = "Bir üniversite seç.";
  if (!uuidPattern.test(facultyId)) fieldErrors.facultyId = "Bir fakülte seç.";
  if (!uuidPattern.test(departmentId)) fieldErrors.departmentId = "Bir bölüm seç.";
  if (!gradeTypes.has(type)) fieldErrors.type = "Geçerli bir eğitim durumu seç.";
  if (!rawGpa || !Number.isFinite(gpa) || gpa < 0 || gpa > 4) {
    fieldErrors.gpa = "Not ortalaması 0 ile 4 arasında olmalıdır.";
  }
  if (!datePattern.test(startDate)) fieldErrors.startDate = "Geçerli bir başlangıç tarihi seç.";
  if (endDate && !datePattern.test(endDate)) fieldErrors.endDate = "Geçerli bir bitiş tarihi seç.";
  if (endDate && startDate && endDate < startDate) {
    fieldErrors.endDate = "Bitiş tarihi başlangıç tarihinden önce olamaz.";
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

function preferenceRows(values: readonly FormDataEntryValue[]): NotificationPreferenceWrite[] | null {
  const decisions = new Map<string, NotificationPreferenceWrite>();

  for (const value of values) {
    if (typeof value !== "string") return null;
    const [category, channel, enabled, extra] = value.split("|");
    if (
      extra !== undefined ||
      !notificationCategories.has(category as NotificationCategory) ||
      !notificationChannels.has(channel as NotificationChannel) ||
      (enabled !== "true" && enabled !== "false")
    ) {
      return null;
    }
    decisions.set(`${category}|${channel}`, {
      category: category as NotificationCategory,
      channel: channel as NotificationChannel,
      enabled: enabled === "true",
    });
  }

  return [...decisions.values()];
}

function nullableText(formData: FormData, name: string): string | null {
  return textField(formData, name).trim() || null;
}

function invalidRecord(): FormState {
  return validationState({ record: "Kayıt kimliği geçerli değil." });
}

const referenceValidationFailure: ReferenceActionResult = {
  status: "error",
  errorCode: "VALIDATION_FAILED",
  httpStatus: 400,
};
