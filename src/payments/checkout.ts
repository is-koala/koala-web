import type { PaymentStatus } from "@/assignments/contract";

import type { PaymentAttemptStatus, PaymentResolution } from "./contract";

const allowedPaymentHosts = new Set([
  "api.iyzipay.com",
  "cpp.iyzipay.com",
  "sandbox-api.iyzipay.com",
  "sandbox-cpp.iyzipay.com",
]);

/** Sağlayıcı URL'si tarayıcıyı uygulamadan çıkaran bir güven sınırıdır. */
export function isAllowedPaymentPageUrl(candidate: string): boolean {
  try {
    const url = new URL(candidate);
    const authority = /^https:\/\/([^/?#]+)/i.exec(candidate)?.[1]?.toLowerCase();
    return url.protocol === "https:" &&
      authority === url.hostname &&
      url.username === "" &&
      url.password === "" &&
      url.port === "" &&
      url.hash === "" &&
      allowedPaymentHosts.has(url.hostname);
  } catch {
    return false;
  }
}

type PaymentTone = "neutral" | "warning" | "positive" | "negative";

type PaymentStatusPresentation = {
  readonly label: string;
  readonly tone: PaymentTone;
  readonly resolution: PaymentResolution;
};

const paymentStatuses: Readonly<Record<PaymentStatus, PaymentStatusPresentation>> = {
  PENDING_COLLECTION: { label: "Tahsilat bekleniyor", tone: "warning", resolution: "pending" },
  HELD_IN_ESCROW: { label: "Emanette", tone: "positive", resolution: "held" },
  RELEASED_TO_WORKER: { label: "İşçiye aktarıldı", tone: "positive", resolution: "released" },
  FAILED: { label: "Başarısız", tone: "negative", resolution: "failed" },
  REFUNDED: { label: "İade sürecinde", tone: "neutral", resolution: "pending" },
  UNKNOWN: { label: "Durum güncelleniyor", tone: "neutral", resolution: "pending" },
};

const paymentAttempts: Readonly<Record<PaymentAttemptStatus, Omit<PaymentStatusPresentation, "resolution">>> = {
  INITIATED: { label: "Sonuç bekleniyor", tone: "warning" },
  IN_REVIEW: { label: "İnceleniyor", tone: "warning" },
  VERIFY_PENDING: { label: "Sonuç doğrulanıyor", tone: "warning" },
  SUCCEEDED: { label: "Başarılı", tone: "positive" },
  FAILED: { label: "Başarısız", tone: "negative" },
  UNKNOWN: { label: "Sonuç doğrulanıyor", tone: "neutral" },
};

const paymentResults: Readonly<Record<PaymentResolution, {
  readonly title: string;
  readonly body: string;
  readonly role: "status" | "alert";
  readonly tone: PaymentTone;
}>> = {
  held: {
    title: "Ödeme doğrulandı",
    body: "Ödediğin tutar Koala'da emanete alındı.",
    role: "status",
    tone: "positive",
  },
  released: {
    title: "Ödeme işçiye aktarıldı",
    body: "Atamanın ücreti emanetten çıktı ve işçiye aktarıldı.",
    role: "status",
    tone: "positive",
  },
  failed: {
    title: "Ödeme tamamlanamadı",
    body: "Ödeme alınmadı. Atamanın koşulları uygunsa yeniden deneyebilirsin.",
    role: "alert",
    tone: "negative",
  },
  pending: {
    title: "Ödeme sonucunu bekliyoruz",
    body: "Sonuç kesinleşene kadar yeni bir ödeme başlatma.",
    role: "status",
    tone: "warning",
  },
};

export function canStartPayment(assignment: {
  status: string;
  paymentStatus: string;
  employerType?: string;
}): boolean {
  return assignment.employerType !== "UNKNOWN" && assignment.status === "CONFIRMED" &&
    (assignment.paymentStatus === "PENDING_COLLECTION" || assignment.paymentStatus === "FAILED");
}

export function hasUnresolvedPaymentAttempt(
  attempts: readonly { status: PaymentAttemptStatus }[],
): boolean {
  return attempts.some(({ status }) =>
    status === "INITIATED" ||
    status === "IN_REVIEW" ||
    status === "VERIFY_PENDING" ||
    status === "UNKNOWN"
  );
}

export function paymentStatusPresentation(status: string): PaymentStatusPresentation {
  return status in paymentStatuses
    ? paymentStatuses[status as PaymentStatus]
    : paymentStatuses.UNKNOWN;
}

export function paymentAttemptPresentation(status: string) {
  return status in paymentAttempts
    ? paymentAttempts[status as PaymentAttemptStatus]
    : paymentAttempts.UNKNOWN;
}

export function paymentResultPresentation(resolution: PaymentResolution) {
  return paymentResults[resolution];
}

export function paymentStatusLabel(status: string): string {
  return paymentStatusPresentation(status).label;
}

export function paymentAttemptLabel(status: string): string {
  return paymentAttemptPresentation(status).label;
}

export function paymentReturnToneTitle(status: "success" | "failed"): string {
  return status === "success" ? "Ödeme dönüşü alındı" : "Ödeme tamamlanamadı bildirimi alındı";
}
