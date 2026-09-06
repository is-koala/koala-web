export type PayoutStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "UNKNOWN";

/** İşçinin göreceği ödeme çıkışı; işveren fiyatı ve hizmet bedeli taşımaz. */
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
