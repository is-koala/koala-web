import type { AssignmentStatus, PaymentStatus } from "@/assignments/contract";
import type { PricingBreakdown } from "@/lib/job-posting";
import type { MessagingAvailability } from "@/messaging/contract";

export type EmployerType = "INDIVIDUAL" | "COMPANY" | "UNKNOWN";

export type EmployerAssignment = {
  readonly id: string;
  readonly jobId: string;
  readonly title: string;
  readonly position: string | null;
  readonly employerType: EmployerType;
  /** `MyAssignmentDto.worker.id`; işverenin konuşma açarken göndermek zorunda olduğu kimlik. */
  readonly workerId: string;
  readonly workerName: string;
  /** `SafeUserDto.profilePictureUrl`, `safeImageUrl` kapısından; yoksa baş harf. */
  readonly workerPictureUrl: string | null;
  /** `job.companyName`; bireysel ilanda `null`. Liste satırı ilanın kime ait olduğunu buradan yazıyor. */
  readonly companyName: string | null;
  readonly cityName: string | null;
  readonly districtName: string | null;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly status: AssignmentStatus;
  readonly paymentStatus: PaymentStatus;
  readonly pricing: PricingBreakdown | null;
  /** `MyAssignmentDto.assignmentDateTime`; zaman çizelgesinin ilk adımı. */
  readonly assignedAt: string | null;
  /**
   * İşçinin onay anı, ödemenin emanete alındığı an ve iptal anı.
   *
   * Üçü de is-koala/koala-backend#282 ile satıra geliyor (`confirmedAt`,
   * `paymentSecuredAt`, `cancellation.cancelledAt`); gelene kadar `null` ve
   * çizelge adımı zamansız çiziliyor. Ödeme anı için ayrıntı sayfası ödeme
   * denemelerinden de türetebiliyor (`paymentSecuredAt`, `server/payments`).
   */
  readonly confirmedAt: string | null;
  readonly paymentSecuredAt: string | null;
  readonly cancelledAt: string | null;
  /** `MyAssignmentDto.actualCompletionDateTime`; yalnız tamamlanmışta dolu. */
  readonly completedAt: string | null;
  /**
   * `MyAssignmentDto.workHours` — backend'in saat cinsinden tam sayısı.
   *
   * Puantaj oturumlarından yeniden hesaplanmıyor: liste ekranında oturum
   * uçlarına satır başına bir tur atmak gerekirdi ve backend bu sayıyı zaten
   * satırda taşıyor.
   */
  readonly workHours: number;
  /**
   * `messagingAvailable` + `messagingAvailableReason`; alan yoksa `null` ve
   * ekran mesaj bağlantısını hiç çizmez (`MessagingGate`).
   */
  readonly messaging: MessagingAvailability | null;
};

export type EmployerAssignmentPage = {
  readonly content: readonly EmployerAssignment[];
  readonly page: number;
  readonly size: number;
  readonly totalElements: number;
  readonly totalPages: number;
  readonly first: boolean;
  readonly last: boolean;
};

export type PaymentAttempt = {
  readonly id: string;
  readonly status: PaymentAttemptStatus;
  readonly currency: string;
  readonly workerPayout: string;
  readonly serviceFeeRate: string;
  readonly serviceFeeAmount: string;
  readonly employerTotal: string;
  readonly completedAt: string | null;
  readonly createdAt: string;
  readonly failureMessage: string | null;
};

export type PaymentAttemptStatus =
  | "INITIATED"
  | "IN_REVIEW"
  | "VERIFY_PENDING"
  | "SUCCEEDED"
  | "FAILED"
  | "UNKNOWN";

export type PaymentSession = {
  readonly paymentPageUrl: string;
  readonly pricing: PricingBreakdown;
};

export type PaymentResolution = "held" | "released" | "failed" | "pending";

export type PaymentReconciliation = {
  readonly assignment: EmployerAssignment | null;
  readonly attempts: readonly PaymentAttempt[];
  readonly resolution: PaymentResolution;
  readonly hasActiveDispute: boolean;
};

export type EmployerPaymentCompany = {
  readonly companyId: string;
  /** `null`: şirket okunamadı (403/404); kapı bilinmiyor sayılır ve uyarı çizmez. */
  readonly hasAddress: boolean | null;
};
