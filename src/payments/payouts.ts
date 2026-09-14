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
  failureMessage: string | null;
  /** Aktarımın tamamlandığı an; `createdAt` (kaydın açılışı) ile karıştırılmaz. */
  completedAt: string | null;
  createdAt: string;
  /**
   * Hangi iş: backend `PayoutDto.jobTitle/companyName` yazana kadar
   * (is-koala/koala-backend#282) atama listesinden `jobAssignmentId` ile
   * eşleniyor; eşleşme yoksa `null` ve satır yalnız bağlantıyı gösteriyor.
   */
  jobTitle: string | null;
  employerName: string | null;
};
