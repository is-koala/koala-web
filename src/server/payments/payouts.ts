import "server-only";

import { unstable_rethrow } from "next/navigation";

import type { PayoutStatus, WorkerPayout } from "@/payments/payouts";
import { clean } from "@/server/api/dto";
import { ApiError } from "@/server/api/errors";
import type { AssignmentPageDto } from "@/server/assignments/backend-contract";
import { backendPaths } from "@/server/contract";
import { apiRequest } from "@/server/session/session";

type PayoutDto = {
  id: string;
  jobAssignmentId: string;
  amount: string;
  currency: string;
  status: string;
  failureReason?: string | null;
  completedAt?: string | null;
  createdAt: string;
  /** is-koala/koala-backend#282 ile geliyor; yoksa atama listesinden eşleniyor. */
  jobTitle?: string | null;
  companyName?: string | null;
};

type PayoutJob = { jobTitle: string | null; employerName: string | null };

const payoutStatuses = new Set<PayoutStatus>([
  "PENDING",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
]);

const assignmentPageSize = 100;

/** Aynı zaman damgalı kayıtları istemcide yeniden sıralayıp kararsızlaştırmamak için sunucu sırası korunur. */
export async function readWorkerPayouts(): Promise<readonly WorkerPayout[]> {
  const payouts = await apiRequest<readonly PayoutDto[] | null>(backendPaths.currentUserPayouts, {
    cache: "no-store",
  });
  const rows = (payouts ?? []).map(projectPayout);
  const jobs = await readPayoutJobs(rows);
  return rows.map((payout) => {
    const job = jobs.get(payout.assignmentId);
    return job ? { ...payout, ...job } : payout;
  });
}

/**
 * Satırların iş adı ve işvereni.
 *
 * Backend satıra `jobTitle` yazıyorsa atama listesi hiç okunmuyor. Yazmıyorsa
 * çalışanın atamaları sayfa sayfa gezilip `jobAssignmentId` ile eşleniyor;
 * atama listesi okunamazsa kazançlar yine çiziliyor, yalnız iş adı düşüyor —
 * kullanıcının asıl geldiği şey tutarı ve durumu, başlık onun süsü.
 */
async function readPayoutJobs(rows: readonly WorkerPayout[]): Promise<ReadonlyMap<string, PayoutJob>> {
  const jobs = new Map<string, PayoutJob>();
  const missing = new Set<string>();
  for (const row of rows) {
    if (row.jobTitle !== null) continue;
    missing.add(row.assignmentId);
  }
  if (missing.size === 0) return jobs;

  try {
    let pageNumber = 0;
    while (missing.size > 0) {
      const page = await apiRequest<AssignmentPageDto | null>(
        `${backendPaths.workerAssignments}&page=${pageNumber}&size=${assignmentPageSize}`,
        { cache: "no-store" },
      );
      if (!page) break;
      for (const assignment of page.content ?? []) {
        if (!missing.delete(assignment.id)) continue;
        jobs.set(assignment.id, {
          jobTitle: clean(assignment.job.title),
          employerName: clean(assignment.job.companyName),
        });
      }
      if (page.last || pageNumber + 1 >= page.totalPages) break;
      pageNumber += 1;
    }
  } catch (error) {
    unstable_rethrow(error);
    if (!(error instanceof ApiError)) throw error;
  }
  return jobs;
}

function projectPayout(dto: PayoutDto): WorkerPayout {
  const reason = dto.failureReason?.trim();
  const status = payoutStatuses.has(dto.status as PayoutStatus)
    ? (dto.status as PayoutStatus)
    : "UNKNOWN";
  return {
    id: dto.id,
    assignmentId: dto.jobAssignmentId,
    amount: exactDecimal(dto.amount),
    currency: dto.currency,
    status,
    failureMessage: reason ? safeFailureMessage(status) : null,
    completedAt: dto.completedAt ?? null,
    createdAt: dto.createdAt,
    jobTitle: clean(dto.jobTitle),
    employerName: clean(dto.companyName),
  };
}

function safeFailureMessage(status: PayoutStatus): string {
  return status === "FAILED"
    ? "Banka aktarımı tamamlanamadı. Ödeme hesabını kontrol edip destekten yardım alabilirsin."
    : "Banka aktarımının güncel durumu doğrulanıyor. Biraz sonra yeniden kontrol edebilirsin.";
}

function exactDecimal(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("payout.amount must be an exact decimal string");
  }
  return value;
}
