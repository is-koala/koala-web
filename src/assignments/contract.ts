export type AssignmentStatus =
  | "PENDING_CONFIRMATION"
  | "CONFIRMED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "REJECTED"
  | "CANCELLED"
  | "UNKNOWN";

export type PaymentStatus =
  | "PENDING_COLLECTION"
  | "HELD_IN_ESCROW"
  | "RELEASED_TO_WORKER"
  | "FAILED"
  | "REFUNDED"
  | "UNKNOWN";

/**
 * Çalışanın liste ekranında kullandığı dar atama modeli.
 *
 * `MyAssignmentDto.job` tam adres taşımadığı için modelde de adres yoktur.
 * Ayrıntı uçları teslim edilmeden liste katmanı bu bilgiyi üretemez.
 */
export type WorkerAssignment = {
  id: string;
  title: string;
  position: string | null;
  categoryName: string | null;
  companyName: string | null;
  cityName: string | null;
  districtName: string | null;
  startsAt: string;
  endsAt: string;
  status: AssignmentStatus;
  paymentStatus: PaymentStatus;
  workerPayout: string;
  currency: string;
};

export type WorkerAssignmentPage = {
  content: readonly WorkerAssignment[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
};

export type AssignmentResponseState =
  | { status: "idle" }
  | { status: "done"; assignments: WorkerAssignmentPage }
  | {
      status: "error";
      errorCode: string;
      httpStatus: number;
      /** Bir önceki başarılı yeniden okumayı geçici POST hatasında kaybetme. */
      assignments?: WorkerAssignmentPage;
    };

export const idleAssignmentResponseState: AssignmentResponseState = { status: "idle" };

export type AssignmentResponseAction = (
  state: AssignmentResponseState,
  formData: FormData,
) => Promise<AssignmentResponseState>;
