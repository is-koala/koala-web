"use server";

import { unstable_rethrow } from "next/navigation";

import type {
  ApplicationFilter,
  ApplicationMutationState,
} from "@/applications/contract";
import { isUuid } from "@/lib/identifiers";
import { ApiError } from "@/server/api/errors";
import {
  readWorkerApplications,
  withdrawWorkerApplication,
} from "@/server/applications/applications";
import { failureView, textField } from "@/server/form";
import { requireSessionForCurrentPath } from "@/server/session/guard";

const filters = new Set<ApplicationFilter>(["ALL", "APPLIED", "ACCEPTED", "REJECTED", "WITHDRAWN"]);

export async function withdrawApplicationAction(
  state: ApplicationMutationState,
  formData: FormData,
): Promise<ApplicationMutationState> {
  await requireSessionForCurrentPath();
  const applicationId = textField(formData, "applicationId");
  const rawFilter = textField(formData, "filter");
  const rawPage = textField(formData, "page");
  const filter = filters.has(rawFilter as ApplicationFilter)
    ? (rawFilter as ApplicationFilter)
    : null;
  const page = /^\d+$/.test(rawPage) ? Number(rawPage) : null;
  if (!isUuid(applicationId) || filter === null || page === null || !Number.isSafeInteger(page)) {
    return { status: "error", errorCode: "VALIDATION_FAILED", httpStatus: 400 };
  }

  try {
    await withdrawWorkerApplication(applicationId);
    return { status: "done", applications: await readWorkerApplications({ status: filter, page }) };
  } catch (error) {
    unstable_rethrow(error);
    const failure = failureView(error);
    if (error instanceof ApiError && error.status === 409) {
      try {
        return {
          status: "error",
          errorCode: failure.errorCode,
          httpStatus: failure.httpStatus,
          applications: await readWorkerApplications({ status: filter, page }),
        };
      } catch (readError) {
        unstable_rethrow(readError);
      }
    }
    return {
      status: "error",
      errorCode: failure.errorCode,
      httpStatus: failure.httpStatus,
      ...(state.status !== "idle" && state.applications
        ? { applications: state.applications }
        : {}),
    };
  }
}
