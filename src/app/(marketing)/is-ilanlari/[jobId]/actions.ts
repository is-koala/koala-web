"use server";

import { redirect, unstable_rethrow } from "next/navigation";

import type { FormState } from "@/lib/form-state";
import { isUuid } from "@/lib/identifiers";
import { createJobApplication } from "@/server/jobs/jobs";
import { failureState, textField, validationState } from "@/server/form";
import { requireSessionForCurrentPath } from "@/server/session/guard";
import { currentGates } from "@/server/session/gates";

const applicationsPath = "/panel/basvurularim";
const maximumNotesLength = 2000;

export async function applyToJobAction(
  jobId: string,
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireSessionForCurrentPath();

  const { gates } = await currentGates();
  if (gates !== null && !gates.application.open) {
    return {
      status: "error",
      errorCode: "APPLICANT_IDENTITY_NOT_VERIFIED",
      httpStatus: 400,
    };
  }

  if (!isUuid(jobId)) {
    return { status: "error", errorCode: "JOB_NOT_FOUND", httpStatus: 404 };
  }

  const notes = textField(formData, "notes").trim();
  if (notes.length > maximumNotesLength) {
    return validationState({ notes: "Başvuru notu en fazla 2000 karakter olabilir." });
  }

  try {
    const application = await createJobApplication(jobId, notes || undefined);
    if (application === null || !isUuid(application.id)) {
      return { status: "error", errorCode: "UNEXPECTED", httpStatus: 500 };
    }
  } catch (error) {
    unstable_rethrow(error);
    return failureState(error);
  }

  redirect(applicationsPath);
}
