import "server-only";

import type { WorkerAssignmentPage } from "@/assignments/contract";
import { backendPaths } from "@/server/contract";
import { apiRequest } from "@/server/session/session";
import {
  projectWorkerAssignment,
  type AssignmentPageDto,
} from "@/server/assignments/backend-contract";

type AssignmentJobDetailDto = {
  addressPrecision?: string | null;
  address?: { displayAddress?: string | null } | null;
};

export async function readWorkerAssignments(
  pageNumber = 0,
  pageSize = 20,
): Promise<WorkerAssignmentPage> {
  const page = await apiRequest<AssignmentPageDto | null>(
    `${backendPaths.workerAssignments}&page=${pageNumber}&size=${pageSize}`,
  );
  if (page === null) return emptyPage;

  return {
    content: page.content.map(projectWorkerAssignment),
    page: page.page,
    size: page.size,
    totalElements: page.totalElements,
    totalPages: page.totalPages,
    first: page.first,
    last: page.last,
  };
}

export async function readAssignmentAddress(jobId: string): Promise<string> {
  const job = await apiRequest<AssignmentJobDetailDto>(`/jobs/${jobId}`);
  const displayAddress = job.address?.displayAddress?.trim();
  if (job.addressPrecision !== "EXACT" || !displayAddress) {
    throw new Error("Assignment address is unavailable");
  }
  return displayAddress;
}

export async function respondToWorkerAssignment(
  assignmentId: string,
  accepted: boolean,
): Promise<void> {
  await apiRequest(`${backendPaths.jobAssignments}/${assignmentId}/respond`, {
    method: "POST",
    body: { accepted },
  });
}

const emptyPage: WorkerAssignmentPage = {
  content: [],
  page: 0,
  size: 20,
  totalElements: 0,
  totalPages: 0,
  first: true,
  last: true,
};
