import type { Metadata } from "next";
import { unstable_rethrow } from "next/navigation";

import { JobDetailState, type JobDetailLoadState } from "@/components/job-detail-state";
import { isUuid } from "@/lib/identifiers";
import { failureView } from "@/server/form";
import { readJobDetail } from "@/server/jobs/jobs";

import { applyToJobAction } from "./actions";

export const metadata: Metadata = {
  title: "İlan ayrıntısı",
  description: "Koala'daki iş ilanının ayrıntılarını incele ve başvurunu gönder.",
};

export default async function Page({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  if (!isUuid(jobId)) return <JobDetailState state={{ status: "empty" }} />;

  let state: JobDetailLoadState;
  try {
    const job = await readJobDetail(jobId);
    state =
      job === null
        ? { status: "empty" }
        : { status: "ready", job, applyAction: applyToJobAction.bind(null, jobId) };
  } catch (error) {
    unstable_rethrow(error);
    const failure = failureView(error);
    state = {
      status: "error",
      errorCode: failure.errorCode,
      httpStatus: failure.httpStatus,
    };
  }

  return <JobDetailState state={state} />;
}
