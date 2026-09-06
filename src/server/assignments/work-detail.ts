import "server-only";

import type {
  CancellationPreview,
  CheckpointKind,
  WorkAssignment,
  WorkDetail,
  WorkSession,
} from "@/assignments/work-detail";
import { backendPaths } from "@/server/contract";
import { apiRequest } from "@/server/session/session";
import {
  projectWorkerAssignment,
  type AssignmentDto,
  type AssignmentPageDto,
} from "@/server/assignments/backend-contract";

type JobDetailDto = {
  description?: string | null;
  duties?: string | null;
  dressCode?: string | null;
  addressPrecision?: string | null;
  address?: { displayAddress?: string | null } | null;
};

type WorkSessionDto = {
  id: string;
  checkInAt: string;
  checkOutAt?: string | null;
  minutes?: number | null;
};

type CancellationPreviewDto = {
  feeRate: string | number;
  feeAmount: string | number;
  refundAmount: string | number;
  noticeMinutes: number;
  cancellableNow: boolean;
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

  const [job, sessionDtos, cancellation] = await Promise.all([
    apiRequest<JobDetailDto>(`/jobs/${assignment.job.id}`, { cache: "no-store" }),
    apiRequest<readonly WorkSessionDto[]>(
      `${backendPaths.jobAssignments}/${assignmentId}/work-sessions`,
      { cache: "no-store" },
    ),
    shouldReadCancellationPreview(assignment.status)
      ? apiRequest<CancellationPreviewDto>(
          `${backendPaths.jobAssignments}/${assignmentId}/cancellation-preview`,
          { cache: "no-store" },
        )
      : Promise.resolve(null),
  ]);

  const displayAddress = job.address?.displayAddress?.trim();
  return {
    observedAt: Date.now(),
    assignment: toWorkAssignment(assignment),
    description: cleanText(job.description),
    duties: cleanText(job.duties),
    dressCode: cleanText(job.dressCode),
    fullAddress:
      job.addressPrecision === "EXACT" && displayAddress ? displayAddress : null,
    sessions: sessionDtos.map(toWorkSession),
    cancellationPreview: cancellation ? toCancellationPreview(cancellation) : null,
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

export async function cancelAssignment(assignmentId: string, reason: string): Promise<void> {
  await apiRequest(`${backendPaths.jobAssignments}/${assignmentId}/cancel`, {
    method: "POST",
    body: { reason },
  });
}

export async function createAssignmentDispute(
  assignmentId: string,
  reason: string,
): Promise<void> {
  await apiRequest(`${backendPaths.jobAssignments}/${assignmentId}/disputes`, {
    method: "POST",
    body: { reason },
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

function toWorkAssignment(dto: AssignmentDto): WorkAssignment {
  return {
    ...projectWorkerAssignment(dto),
    assignedAt: dto.assignmentDateTime ?? null,
    completedAt: dto.actualCompletionDateTime ?? null,
  };
}

function toWorkSession(dto: WorkSessionDto): WorkSession {
  return {
    id: dto.id,
    checkInAt: dto.checkInAt,
    checkOutAt: dto.checkOutAt ?? null,
    minutes: dto.minutes ?? null,
  };
}

function toCancellationPreview(dto: CancellationPreviewDto): CancellationPreview {
  return {
    feeRate: String(dto.feeRate),
    feeAmount: String(dto.feeAmount),
    refundAmount: String(dto.refundAmount),
    noticeMinutes: dto.noticeMinutes,
    cancellableNow: dto.cancellableNow,
  };
}

function shouldReadCancellationPreview(status: string) {
  return status === "CONFIRMED" || status === "IN_PROGRESS";
}

function cleanText(value: string | null | undefined): string | null {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}
