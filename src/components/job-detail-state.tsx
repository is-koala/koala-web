import type { JobDetail } from "@/jobs/contract";
import type { FormAction } from "@/lib/form-state";

import { JobDetailView } from "./job-detail";
import { EmptyState, ErrorState } from "./states";

export type JobDetailLoadState =
  | { readonly status: "ready"; readonly job: JobDetail; readonly applyAction: FormAction }
  | { readonly status: "empty" }
  | { readonly status: "error"; readonly errorCode: string; readonly httpStatus: number };

export function JobDetailState({ state }: { state: JobDetailLoadState }) {
  if (state.status === "ready") {
    return <JobDetailView job={state.job} applyAction={state.applyAction} />;
  }

  return (
    <section className="job-detail-state">
      {state.status === "empty" ? (
        <EmptyState kind="jobDetail" />
      ) : (
        <ErrorState errorCode={state.errorCode} status={state.httpStatus} />
      )}
    </section>
  );
}
