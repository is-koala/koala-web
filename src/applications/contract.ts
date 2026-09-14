import type { JobEmployerType } from "@/jobs/employer-jobs";
import type { JobStatus } from "@/jobs/lifecycle";

export type ApplicationStatus = "APPLIED" | "ACCEPTED" | "REJECTED" | "WITHDRAWN" | "UNKNOWN";

export type ApplicationFilter = Exclude<ApplicationStatus, "UNKNOWN"> | "ALL";

export type WorkerApplication = {
  id: string;
  jobId: string;
  title: string;
  position: string | null;
  companyName: string | null;
  cityName: string | null;
  districtName: string | null;
  startsAt: string;
  coverImageUrl: string | null;
  status: ApplicationStatus;
  notes: string | null;
  rejectionReason: string | null;
  appliedAt: string;
  /** `answeredDateTime` — işverenin kabul ya da ret anı; cevapsız başvuruda `null`. */
  answeredAt: string | null;
  assignmentId: string | null;
  /** `job.employerType`; bireysel ilanda `companyName` boş olduğu için rozet gerekiyor. */
  employerType: JobEmployerType;
  /** `job.status`; kapanmış ya da iptal edilmiş ilanı bekleyen başvuru üstünde söyler. */
  jobStatus: JobStatus | "UNKNOWN";
};

export type WorkerApplicationPage = {
  content: readonly WorkerApplication[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
};

export type ApplicationMutationState =
  | { status: "idle" }
  | { status: "done"; applications: WorkerApplicationPage }
  | {
      status: "error";
      errorCode: string;
      httpStatus: number;
      applications?: WorkerApplicationPage;
    };

export const idleApplicationMutationState: ApplicationMutationState = { status: "idle" };

export type ApplicationMutationAction = (
  state: ApplicationMutationState,
  formData: FormData,
) => Promise<ApplicationMutationState>;
