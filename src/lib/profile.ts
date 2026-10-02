import type { NotificationCategory, NotificationChannel } from "./notification-labels";

export type EmploymentType =
  | "FULL_TIME"
  | "PART_TIME"
  | "FREELANCE"
  | "INTERNSHIP"
  | "SEASONAL";

export type GradeType =
  | "FIRST_GRADE"
  | "SECOND_GRADE"
  | "THIRD_GRADE"
  | "FOURTH_GRADE"
  | "FIFTH_GRADE"
  | "SIXTH_GRADE"
  | "GRADUATE"
  | "PREPARATORY";

export type Experience = {
  id: string;
  title: string;
  companyName: string | null;
  employmentType: EmploymentType | null;
  cityName: string | null;
  startDate: string;
  endDate: string | null;
  description: string | null;
};

export type Education = {
  id: string;
  universityId: string;
  universityName: string;
  facultyId: string;
  facultyName: string;
  departmentId: string;
  departmentName: string;
  type: GradeType;
  gpa: number;
  startDate: string;
  endDate: string | null;
};

export type AcademicReference = { id: string; name: string };

/** `BadgeFamily`; bilinmeyen değer metin olarak taşınır, gösterim bozulmaz. */
export type BadgeFamily = "GEZGIN" | "RATING" | "IDENTITY" | "PUNCTUALITY" | "OTHER" | string;

/** `BadgeTier`; `NONE` kademesiz rozet demek. */
export type BadgeTier = "BRONZE" | "SILVER" | "GOLD" | "NONE" | string;

/**
 * `BadgeDto`. Rozetler `GET /users/me` yanıtında geliyor (`badges[]`); ayrı
 * `GET /users/{id}/badges` ucu herkese açık profil için var ve kabuk onu
 * ikinci bir tur olarak çağırmıyor.
 */
export type Badge = {
  code: string;
  family: BadgeFamily;
  tier: BadgeTier;
  name: string;
  description: string | null;
  iconUrl: string | null;
  earnedAt: string | null;
};

export const badgeTierLabels: Readonly<Record<string, string>> = {
  BRONZE: "Bronz",
  SILVER: "Gümüş",
  GOLD: "Altın",
};

export function badgeTierLabel(tier: BadgeTier): string | null {
  return Object.hasOwn(badgeTierLabels, tier) ? badgeTierLabels[tier] : null;
}

// Bildirim değerleri ve etiketleri ayrı bir yaprakta: herkese açık çıkış
// sayfası (is-koala/koala-web#54) yalnız etiketleri okuyor ve bu modülün
// geri kalanını paketine taşımamalı.
export {
  notificationCategoryLabel,
  notificationCategoryLabels,
  notificationCategoryValues,
  notificationChannelLabel,
  notificationChannelLabels,
  notificationChannelValues,
} from "./notification-labels";
export type { NotificationCategory, NotificationChannel } from "./notification-labels";

export type NotificationPreference = {
  category: NotificationCategory;
  kind: "TRANSACTIONAL" | "ALERT" | "COMMERCIAL";
  channel: NotificationChannel;
  enabled: boolean;
  editable: boolean;
};

export type ProfileSummary = {
  firstName: string | null;
  lastName: string | null;
  profilePictureUrl: string | null;
  jobTitle: string | null;
  about: string | null;
  qualifications: string | null;
  interests: string | null;
  experiences: readonly Pick<Experience, "id">[];
  educations: readonly Pick<Education, "id">[];
};

export type EditableProfile = Omit<ProfileSummary, "experiences" | "educations"> & {
  id: string;
  email: string;
  phoneNumber: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  identityVerified: boolean;
  experiences: readonly Experience[];
  educations: readonly Education[];
  badges: readonly Badge[];
};

export type ProfileCompletion = {
  percentage: number;
  missing: readonly string[];
};

const completionChecks = [
  { missing: "Ad ve soyadını tamamla", complete: (profile: ProfileSummary) => hasText(profile.firstName) && hasText(profile.lastName) },
  { missing: "Profil fotoğrafı ekle", complete: (profile: ProfileSummary) => hasText(profile.profilePictureUrl) },
  { missing: "Meslek başlığını ekle", complete: (profile: ProfileSummary) => hasText(profile.jobTitle) },
  { missing: "Hakkında alanını doldur", complete: (profile: ProfileSummary) => hasText(profile.about) },
  { missing: "Yetkinliklerini ekle", complete: (profile: ProfileSummary) => hasText(profile.qualifications) },
  { missing: "İlgi alanlarını ekle", complete: (profile: ProfileSummary) => hasText(profile.interests) },
  { missing: "Deneyim ekle", complete: (profile: ProfileSummary) => profile.experiences.length > 0 },
  { missing: "Eğitim ekle", complete: (profile: ProfileSummary) => profile.educations.length > 0 },
] as const;

export function profileCompletion(profile: ProfileSummary): ProfileCompletion {
  const missing = completionChecks
    .filter((check) => !check.complete(profile))
    .map((check) => check.missing);
  const completeCount = completionChecks.length - missing.length;

  return {
    percentage: Math.round((completeCount / completionChecks.length) * 100),
    missing,
  };
}

export const employmentTypeOptions: readonly { value: EmploymentType; label: string }[] = [
  { value: "FULL_TIME", label: "Tam zamanlı" },
  { value: "PART_TIME", label: "Yarı zamanlı" },
  { value: "FREELANCE", label: "Serbest" },
  { value: "INTERNSHIP", label: "Staj" },
  { value: "SEASONAL", label: "Dönemsel" },
];

export const gradeTypeOptions: readonly { value: GradeType; label: string }[] = [
  { value: "PREPARATORY", label: "Hazırlık" },
  { value: "FIRST_GRADE", label: "1. sınıf" },
  { value: "SECOND_GRADE", label: "2. sınıf" },
  { value: "THIRD_GRADE", label: "3. sınıf" },
  { value: "FOURTH_GRADE", label: "4. sınıf" },
  { value: "FIFTH_GRADE", label: "5. sınıf" },
  { value: "SIXTH_GRADE", label: "6. sınıf" },
  { value: "GRADUATE", label: "Mezun" },
];

function hasText(value: string | null): boolean {
  return Boolean(value?.trim());
}
