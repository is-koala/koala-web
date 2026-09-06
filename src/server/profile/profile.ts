import "server-only";

import type {
  AcademicReference,
  Education,
  EmploymentType,
  Experience,
  GradeType,
  NotificationCategory,
  NotificationChannel,
  NotificationPreference,
} from "@/lib/profile";
import { apiRequest } from "@/server/session/session";

export type ProfileUpdate = {
  firstName?: string;
  lastName?: string;
  jobTitle: string;
  about: string;
  qualifications: string;
  interests: string;
};

export type ExperienceWrite = {
  title: string;
  companyName: string | null;
  employmentType: EmploymentType | null;
  cityName: string | null;
  startDate: string;
  endDate: string | null;
  description: string | null;
};

export type EducationWrite = {
  universityId: string;
  facultyId: string;
  departmentId: string;
  type: GradeType;
  gpa: number;
  startDate: string;
  endDate: string | null;
};

export type NotificationPreferenceWrite = {
  category: NotificationCategory;
  channel: NotificationChannel;
  enabled: boolean;
};

export type PendingVerification = {
  id: string;
  type: "EMAIL" | "PHONE" | string;
  sentTo: string;
};

export type ContactChange = { email: string } | { phoneNumber: string };

type ContactUpdate = {
  pendingVerifications?: readonly (PendingVerification & { message?: string })[] | null;
};

export async function updateProfile(input: ProfileUpdate): Promise<void> {
  await apiRequest("/users/me", { method: "PATCH", body: input });
}

export function requestContactVerification(change: ContactChange): Promise<ContactUpdate> {
  return apiRequest("/users/me", { method: "PATCH", body: change });
}

export async function uploadProfilePicture(image: File): Promise<void> {
  const body = new FormData();
  body.set("image", image);
  await apiRequest("/users/me/profile-picture", { method: "PUT", body });
}

export function createExperience(input: ExperienceWrite): Promise<Experience> {
  return apiRequest("/users/me/experiences", { method: "POST", body: input });
}

export function updateExperience(id: string, input: ExperienceWrite): Promise<Experience> {
  return apiRequest(`/users/me/experiences/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: input,
  });
}

export async function deleteExperience(id: string): Promise<void> {
  await apiRequest(`/users/me/experiences/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function createEducation(input: EducationWrite): Promise<Education> {
  return apiRequest("/users/me/educations", { method: "POST", body: input });
}

export function updateEducation(id: string, input: EducationWrite): Promise<Education> {
  return apiRequest(`/users/me/educations/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: input,
  });
}

export async function deleteEducation(id: string): Promise<void> {
  await apiRequest(`/users/me/educations/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function getNotificationPreferences(): Promise<NotificationPreference[]> {
  return apiRequest("/users/me/notification-preferences");
}

export function updateNotificationPreferences(
  preferences: readonly NotificationPreferenceWrite[],
): Promise<NotificationPreference[]> {
  return apiRequest("/users/me/notification-preferences", {
    method: "PUT",
    body: { preferences },
  });
}

export function getUniversities(): Promise<AcademicReference[]> {
  return apiRequest("/reference/universities");
}

export function getFaculties(universityId: string): Promise<AcademicReference[]> {
  return apiRequest(`/reference/universities/${encodeURIComponent(universityId)}/faculties`);
}

export function getDepartments(facultyId: string): Promise<AcademicReference[]> {
  return apiRequest(`/reference/faculties/${encodeURIComponent(facultyId)}/departments`);
}
