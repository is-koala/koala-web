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

export const notificationCategoryValues = [
  "ACCOUNT_SECURITY",
  "APPLICATION_UPDATES",
  "IDENTITY_VERIFICATION",
  "MARKETINGS",
  "COMPANY_UPDATES",
  "JOB_ALERTS",
  "NEWSLETTER",
] as const;

export type NotificationCategory = (typeof notificationCategoryValues)[number];

export const notificationChannelValues = ["EMAIL", "PUSH", "IN_APP"] as const;

export type NotificationChannel = (typeof notificationChannelValues)[number];

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

export const notificationCategoryLabels = {
  ACCOUNT_SECURITY: "Hesap güvenliği",
  APPLICATION_UPDATES: "Başvuru güncellemeleri",
  IDENTITY_VERIFICATION: "Kimlik doğrulama",
  MARKETINGS: "Kampanya ve duyurular",
  COMPANY_UPDATES: "Şirket güncellemeleri",
  JOB_ALERTS: "İş alarmları",
  NEWSLETTER: "Bülten",
} satisfies Record<NotificationCategory, string>;

export const notificationChannelLabels = {
  EMAIL: "E-posta",
  PUSH: "Anlık bildirim",
  IN_APP: "Uygulama içi",
} satisfies Record<NotificationChannel, string>;

function hasText(value: string | null): boolean {
  return Boolean(value?.trim());
}
