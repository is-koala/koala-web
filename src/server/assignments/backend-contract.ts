import "server-only";

import type {
  AssignmentStatus,
  PaymentStatus,
  WorkerAssignment,
} from "@/assignments/contract";
import type { AssignmentReview, AssignmentReviewState } from "@/assignments/review";
import { clean, employerTypes, known } from "@/server/api/dto";

/** `SafeUserDto`; yalnız ekranda gösterilecek ad ve fotoğraf okunuyor. */
export type SafeUserDto = {
  id?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  profilePictureUrl?: string | null;
};

/** `MyReviewDto` — görüntüleyenin kendi değerlendirmesi; `id` okunmuyor. */
export type MyReviewDto = {
  id?: string | null;
  rating?: number | null;
  comment?: string | null;
  createdAt?: string | null;
};

/**
 * `MyAssignmentDto`'nun iki kabuğun da okuduğu değerlendirme alanları
 * (backend 0.9.25, is-koala/koala-backend#293). Eski sunucuda ikisi de yok;
 * isteğe bağlı yazıldı ki `projectReviewState` `null` üretsin.
 */
export type ReviewStateDto = {
  myReview?: MyReviewDto | null;
  counterpartyReviewed?: boolean | null;
};

/**
 * Backend'in çalışan ataması liste satırı (`MyAssignmentDto`).
 *
 * `application`, `createdAt`, `confirmedAt`, `paymentSecuredAt`, `employer`,
 * `company`, `cancellation` ve `payout` is-koala/koala-backend#282 ile
 * geldi; hepsi isteğe bağlı yazıldı. Alan yoksa ekran o satırı **çizmez**,
 * uydurmaz.
 *
 * Fiyat: işçi görünümünde `pricing` ve `totalCharged` **null** (backend
 * 0.9.25, is-koala/koala-backend#294); işçinin tek fiyat alanı
 * `workerPayout`. Hizmet bedeli ve işveren toplamı bu tipe hiç yazılmadı ki
 * eski bir sunucu gönderse bile projeksiyon onları taşıyamasın.
 */
export type AssignmentDto = ReviewStateDto & {
  id: string;
  job: {
    id: string;
    title: string;
    position?: string | null;
    category?: { name?: string | null } | null;
    employerType?: string | null;
    companyName?: string | null;
    cityName?: string | null;
    districtName?: string | null;
    startDateTime: string;
    endDateTime: string;
  };
  status: string;
  paymentStatus: string;
  assignmentDateTime?: string | null;
  actualCompletionDateTime?: string | null;
  workerPayout?: string | number | null;
  pricing?: {
    workerPayout?: string | number | null;
    currency?: string | null;
  } | null;
  messagingAvailable?: boolean | null;
  messagingAvailableReason?: string | null;
  createdAt?: string | null;
  confirmedAt?: string | null;
  paymentSecuredAt?: string | null;
  application?: {
    id?: string | null;
    applicationDateTime?: string | null;
    answeredDateTime?: string | null;
  } | null;
  employer?: SafeUserDto | null;
  company?: { id?: string | null; name?: string | null; logoUrl?: string | null } | null;
  cancellation?: { cancelledByParty?: string | null; cancelledAt?: string | null } | null;
  payout?: { id?: string | null; status?: string | null; completedAt?: string | null } | null;
};

/** Backend'in sayfalı atama zarfı; liste ve sahiplik araması bunu paylaşır. */
export type AssignmentPageDto = {
  content: readonly AssignmentDto[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
};

const assignmentStatuses = new Set<AssignmentStatus>([
  "PENDING_CONFIRMATION",
  "CONFIRMED",
  "IN_PROGRESS",
  "COMPLETED",
  "REJECTED",
  "CANCELLED",
]);

const paymentStatuses = new Set<PaymentStatus>([
  "PENDING_COLLECTION",
  "HELD_IN_ESCROW",
  "RELEASED_TO_WORKER",
  "FAILED",
  "REFUNDED",
]);

/**
 * Tek para birimi. `PricingManager.CURRENCY` bugün yalnız `TRY` üretiyor ve
 * işçi görünümünde `pricing` (dolayısıyla `currency`) artık gelmiyor;
 * kazanç satırı para birimsiz kalmasın diye yedek burada. Tutar yoksa
 * birim de yazılmıyor.
 */
const defaultCurrency = "TRY";

/** Liste ve ayrıntı ekranlarının ortak, adres içermeyen atama özeti. */
export function projectWorkerAssignment(dto: AssignmentDto): WorkerAssignment {
  const payout = dto.pricing?.workerPayout ?? dto.workerPayout ?? "";
  const currency = clean(dto.pricing?.currency) ?? (payout === "" ? "" : defaultCurrency);

  return {
    id: dto.id,
    jobId: dto.job.id,
    title: dto.job.title,
    position: clean(dto.job.position),
    categoryName: clean(dto.job.category?.name),
    companyName: clean(dto.job.companyName),
    cityName: clean(dto.job.cityName),
    districtName: clean(dto.job.districtName),
    startsAt: dto.job.startDateTime,
    endsAt: dto.job.endDateTime,
    status: normalizeAssignmentStatus(dto.status),
    paymentStatus: normalizePaymentStatus(dto.paymentStatus),
    workerPayout: String(payout),
    currency,
    employerType: known(dto.job.employerType, employerTypes),
    assignedAt: dto.assignmentDateTime ?? null,
  };
}

/**
 * Satırın değerlendirme durumu. `myReview` ancak puan sayıysa değerlendirme
 * sayılır; puansız bir nesne eski sunucunun boş alanı gibi `null` okunur.
 * `counterpartyReviewed` yalnız gerçek boolean; alan yoksa `null` ve rozet
 * çizilmez.
 */
export function projectReviewState(dto: ReviewStateDto): AssignmentReviewState {
  return {
    myReview: projectMyReview(dto.myReview),
    counterpartyReviewed:
      typeof dto.counterpartyReviewed === "boolean" ? dto.counterpartyReviewed : null,
  };
}

function projectMyReview(dto: MyReviewDto | null | undefined): AssignmentReview | null {
  if (!dto || typeof dto.rating !== "number") return null;
  return {
    rating: dto.rating,
    comment: clean(dto.comment),
    createdAt: clean(dto.createdAt),
  };
}

/** `SafeUserDto`'dan görünen ad; iki parça da boşsa `null`. */
export function personName(user: SafeUserDto | null | undefined): string | null {
  return clean([user?.firstName, user?.lastName].map((part) => clean(part)).filter(Boolean).join(" "));
}

function normalizeAssignmentStatus(value: string): AssignmentStatus {
  return assignmentStatuses.has(value as AssignmentStatus)
    ? (value as AssignmentStatus)
    : "UNKNOWN";
}

function normalizePaymentStatus(value: string): PaymentStatus {
  return paymentStatuses.has(value as PaymentStatus)
    ? (value as PaymentStatus)
    : "UNKNOWN";
}
