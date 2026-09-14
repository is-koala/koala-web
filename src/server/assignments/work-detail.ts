import "server-only";

import { unstable_rethrow } from "next/navigation";

import type {
  CheckpointKind,
  WorkDetail,
  WorkEmployer,
  WorkSession,
} from "@/assignments/work-detail";
import type { JobEmployerType } from "@/jobs/employer-jobs";
import { safeExternalUrl, safeImageUrl } from "@/lib/urls";
import { messagingAvailabilityFrom } from "@/messaging/contract";
import { backendPaths } from "@/server/contract";
import { ApiError } from "@/server/api/errors";
import { apiRequest } from "@/server/session/session";
import {
  personName,
  projectWorkerAssignment,
  type AssignmentDto,
  type AssignmentPageDto,
  type SafeUserDto,
} from "@/server/assignments/backend-contract";
import { readWorkerAssignmentResolution } from "@/server/assignments/resolution";
import { clean, employerTypes, known, openings } from "@/server/api/dto";

export {
  cancelAssignment,
  createAssignmentDispute,
  createAssignmentDisputeWithEvidence,
  uploadAssignmentDisputeEvidence,
} from "@/server/assignments/resolution";

/**
 * `JobDetailDto`'nun bu ekranda okunan parçası.
 *
 * `address` yalnız `displayAddress` ve tarif taşıyor; koordinat ve öbür
 * bileşenler tipte yok, yani `toWorkDetail` içinde okunamıyor. İkisi de
 * `addressPrecision === "EXACT"` kapısından geçiyor: yaklaşık adresli bir
 * ilanda tarif de tam adres kadar konum ele verir.
 */
type JobDetailDto = {
  description?: string | null;
  duties?: string | null;
  dressCode?: string | null;
  employerType?: string | null;
  creator?: SafeUserDto | null;
  company?: { name?: string | null; logoUrl?: string | null; website?: string | null } | null;
  addressPrecision?: string | null;
  address?: {
    displayAddress?: string | null;
    components?: { additionalDirections?: string | null } | null;
  } | null;
  headcount?: number | null;
  hiredCount?: number | null;
  createdAt?: string | null;
};

/** `PaymentAttemptDto`'nun çalışana açılan parçası; tutarlar bilerek yok. */
type PaymentAttemptDto = {
  status?: string | null;
  completedAt?: string | null;
};

/** Ödemesi bir kez emanete girmiş atamalar; öbürlerinde deneme listesi hiç istenmiyor. */
const securedPaymentStatuses = new Set(["HELD_IN_ESCROW", "RELEASED_TO_WORKER", "REFUNDED"]);

type WorkSessionDto = {
  id: string;
  checkInAt: string;
  checkOutAt?: string | null;
  minutes?: number | null;
};

const detailPageSize = 100;

/**
 * Bir atamaya ait ekranı yalnız oturum sahibinin atama listesinden kurar.
 * Atama bulunmadan iş/adres/oturum uçlarına çıkılmaz; böylece keyfi bir UUID
 * ayrıntı okumak için kullanılamaz. Tüm okumalar sunucu gerçeğidir ve kalıcı
 * tarayıcı önbelleğine düşmez.
 */
export async function readWorkDetail(assignmentId: string): Promise<WorkDetail | null> {
  const assignment = await findOwnedAssignment(assignmentId);
  if (!assignment) return null;

  const [job, sessionDtos, paymentSecuredAt, resolution] = await Promise.all([
    apiRequest<JobDetailDto>(`/jobs/${assignment.job.id}`, { cache: "no-store" }),
    apiRequest<readonly WorkSessionDto[]>(
      `${backendPaths.jobAssignments}/${assignmentId}/work-sessions`,
      { cache: "no-store" },
    ),
    readPaymentSecuredAt(assignment),
    readWorkerAssignmentResolution(assignmentId, assignment.status),
  ]);

  const exact = job.addressPrecision === "EXACT";
  const summary = projectWorkerAssignment(assignment);
  // Liste satırı işveren tipini taşımıyorsa ilan ayrıntısı tamamlıyor.
  const employerType = summary.employerType === "UNKNOWN"
    ? known(job.employerType, employerTypes)
    : summary.employerType;
  return {
    observedAt: Date.now(),
    assignment: {
      ...summary,
      employerType,
      completedAt: assignment.actualCompletionDateTime ?? null,
      appliedAt: clean(assignment.application?.applicationDateTime),
      acceptedAt: clean(assignment.application?.answeredDateTime),
      confirmedAt: clean(assignment.confirmedAt),
      paymentSecuredAt,
      messaging: messagingAvailabilityFrom(assignment),
    },
    employer: toWorkEmployer(employerType, job, assignment),
    description: clean(job.description),
    duties: clean(job.duties),
    dressCode: clean(job.dressCode),
    fullAddress: exact ? clean(job.address?.displayAddress) : null,
    additionalDirections: exact ? clean(job.address?.components?.additionalDirections) : null,
    ...openings(job),
    createdAt: clean(job.createdAt),
    sessions: sessionDtos.map(toWorkSession),
    resolution,
  };
}

/**
 * Ödemenin emanete alındığı an.
 *
 * Backend #282 bunu `paymentSecuredAt` olarak satıra yazacak; gelene kadar
 * atamanın ödeme denemelerinden (`GET /job-assignments/{id}/payments`,
 * çalışan da taraf) ilk `SUCCEEDED` olanın `completedAt`'i okunuyor. Liste
 * yalnız ödeme bir kez emanete girmiş atamada isteniyor: `PENDING_COLLECTION`
 * ya da `FAILED` bir atamada başarılı deneme olamaz ve boş bir tur gereksiz.
 *
 * Çizelgedeki tek bir satır için sayfanın tamamı düşmüyor: backend hatası
 * satırı gizler, ayrıntıyı değil. Programlama hataları yine fırlatılıyor.
 */
async function readPaymentSecuredAt(assignment: AssignmentDto): Promise<string | null> {
  if (assignment.paymentSecuredAt) return assignment.paymentSecuredAt;
  if (!securedPaymentStatuses.has(assignment.paymentStatus)) return null;
  try {
    const attempts = await apiRequest<readonly PaymentAttemptDto[] | null>(
      `${backendPaths.jobAssignments}/${assignment.id}/payments`,
      { cache: "no-store" },
    );
    const completed = (attempts ?? [])
      .filter((attempt) => attempt.status === "SUCCEEDED")
      .map((attempt) => clean(attempt.completedAt))
      .filter((at): at is string => at !== null)
      .sort((left, right) => Date.parse(left) - Date.parse(right));
    return completed[0] ?? null;
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError) return null;
    throw error;
  }
}

/**
 * İşveren kartı: şirket ilanında şirket, bireysel ilanda ilanı açan kişi.
 *
 * İlan ayrıntısı bugün ikisini de taşıyor (`creator`, `company`); #282 aynı
 * bilgiyi atama satırına da yazacak ve ilan yanıtı eksikse oradan
 * tamamlanıyor. Tip `UNKNOWN` kalırsa eldeki veriye göre karar veriliyor:
 * şirket adı varsa şirket, yoksa kişi.
 */
function toWorkEmployer(
  type: JobEmployerType,
  job: JobDetailDto,
  assignment: AssignmentDto,
): WorkEmployer | null {
  const company = job.company ?? assignment.company;
  const companyName = clean(company?.name);
  if (type !== "INDIVIDUAL" && companyName) {
    return {
      kind: "company",
      name: companyName,
      imageUrl: safeImageUrl(clean(company?.logoUrl)),
      website: safeExternalUrl(clean(job.company?.website)),
    };
  }
  const person = job.creator ?? assignment.employer;
  const name = personName(person);
  if (type === "COMPANY" || name === null) return null;
  return {
    kind: "person",
    name,
    imageUrl: safeImageUrl(clean(person?.profilePictureUrl)),
    website: null,
  };
}

export async function checkpoint(
  assignmentId: string,
  kind: CheckpointKind,
  point: { latitude: number; longitude: number } | null,
): Promise<void> {
  await apiRequest(`${backendPaths.jobAssignments}/${assignmentId}/${kind}`, {
    method: "POST",
    ...(point ? { body: point } : {}),
  });
}

export async function createAssignmentReview(
  assignmentId: string,
  rating: number,
  comment: string,
): Promise<void> {
  await apiRequest(`${backendPaths.jobAssignments}/${assignmentId}/reviews`, {
    method: "POST",
    body: { rating, comment, anonymous: false },
  });
}

async function findOwnedAssignment(assignmentId: string): Promise<AssignmentDto | null> {
  let pageNumber = 0;
  while (true) {
    const page = await apiRequest<AssignmentPageDto | null>(
      `${backendPaths.workerAssignments}&page=${pageNumber}&size=${detailPageSize}`,
      { cache: "no-store" },
    );
    if (!page) return null;

    const assignment = page.content.find((item) => item.id === assignmentId);
    if (assignment) return assignment;
    if (page.last || pageNumber + 1 >= page.totalPages) return null;
    pageNumber += 1;
  }
}

function toWorkSession(dto: WorkSessionDto): WorkSession {
  return {
    id: dto.id,
    checkInAt: dto.checkInAt,
    checkOutAt: dto.checkOutAt ?? null,
    minutes: dto.minutes ?? null,
  };
}
