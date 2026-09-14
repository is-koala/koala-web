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
  /**
   * Hakediş ayrıntısı (backend 0.9.25, `PayoutDto`, is-koala/koala-backend#294).
   *
   * `maskedIban` çıkış anındaki birincil hesabın maskeli IBAN'ı
   * (`TR18***2315`); tam IBAN hiçbir yanıtta yok. Hesap kaydı yoksa ya da
   * sonradan silindiyse `null` ve satır "—" yazar. `providerReference`
   * sağlayıcının onay referansı; `PENDING`'de henüz yok. `releasedAt`
   * emanetten çıkış anı, `settledAt` banka ekstresiyle doğrulanan an — yalnız
   * `COMPLETED`'da dolu. Eski sunucuda dördü de yok → `null`; ekran
   * `createdAt`/`completedAt`'e düşer, alan uydurmaz.
   */
  maskedIban: string | null;
  providerReference: string | null;
  releasedAt: string | null;
  settledAt: string | null;
};

/**
 * Durum sözlüğü — aynı enum için iki metin, tek dosyada. Rozet kısa adı
 * söyler (`payoutStatusLabel`); açıklama (`payoutStatusDescription`)
 * `PayoutDto`'nun kendi sözlüğüne sadık kalır: PENDING = çıkışa alındı,
 * sağlayıcı onayı bekleniyor; PROCESSING = sağlayıcı onayladı, banka
 * transferi yolda; COMPLETED = banka ekstresiyle doğrulandı; FAILED = çıkış
 * başarısız, nedeni `failureReason` (ekranda güvenli `failureMessage`) taşır.
 * Backend'in söylemediği bir şey ("tutar şurada tutuluyor" gibi) buraya
 * yazılmaz.
 */
export const payoutStatusLabel: Readonly<Record<PayoutStatus, string>> = {
  PENDING: "Aktarım bekliyor",
  PROCESSING: "Aktarılıyor",
  COMPLETED: "Ödendi",
  FAILED: "Aktarılamadı",
  UNKNOWN: "Durum güncelleniyor",
};

export const payoutStatusDescription: Readonly<Record<PayoutStatus, string>> = {
  PENDING: "Kazancın emanetten çıkışa alındı; ödeme sağlayıcısının onayı bekleniyor.",
  PROCESSING: "Sağlayıcı çıkışı onayladı; banka transferi yolda.",
  COMPLETED: "Transfer banka ekstresiyle doğrulandı.",
  FAILED: "Çıkış başarısız; ayrıntı için destekle iletişime geç.",
  UNKNOWN: "Durum güncelleniyor; biraz sonra yeniden kontrol edebilirsin.",
};
