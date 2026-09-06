const allowedPaymentHosts = new Set([
  "payment.iyzipay.com",
  "sandbox-payment.iyzipay.com",
]);

/** Sağlayıcı URL'si tarayıcıyı uygulamadan çıkaran bir güven sınırıdır. */
export function isAllowedPaymentPageUrl(candidate: string): boolean {
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" && allowedPaymentHosts.has(url.hostname);
  } catch {
    return false;
  }
}

const paymentStatusLabels: Readonly<Record<string, string>> = {
  PENDING_COLLECTION: "Tahsilat bekleniyor",
  HELD_IN_ESCROW: "Emanette",
  RELEASED_TO_WORKER: "İşçiye aktarıldı",
  FAILED: "Başarısız",
  REFUNDED: "İade edildi",
};

const paymentAttemptLabels: Readonly<Record<string, string>> = {
  INITIATED: "Sonuç bekleniyor",
  IN_REVIEW: "İnceleniyor",
  SUCCEEDED: "Başarılı",
  FAILED: "Başarısız",
};

export function canStartPayment(assignment: {
  status: string;
  paymentStatus: string;
  employerType?: string;
}): boolean {
  return assignment.employerType !== "UNKNOWN" && assignment.status === "CONFIRMED" &&
    (assignment.paymentStatus === "PENDING_COLLECTION" || assignment.paymentStatus === "FAILED");
}

export function paymentStatusLabel(status: string): string {
  return paymentStatusLabels[status] ?? "Durum güncelleniyor";
}

export function paymentAttemptLabel(status: string): string {
  return paymentAttemptLabels[status] ?? "Sonuç doğrulanıyor";
}
