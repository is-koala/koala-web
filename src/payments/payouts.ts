export type PayoutStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "UNKNOWN";

/** İşveren fiyatı ve hizmet bedeli çalışanın kazanç sınırına sızmasın diye ayrı bir modeldir. */
export type WorkerPayout = {
  id: string;
  assignmentId: string;
  amount: string;
  currency: string;
  status: PayoutStatus;
  failureReason: string | null;
  completedAt: string | null;
  createdAt: string;
};
