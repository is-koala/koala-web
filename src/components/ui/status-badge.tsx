import type { ComponentPropsWithoutRef, ReactNode } from "react";

import type { ApplicationStatus } from "@/applications/contract";
import type { AssignmentStatus, PaymentStatus } from "@/assignments/contract";
import type { JobStatus } from "@/jobs/lifecycle";
import type { PayoutStatus } from "@/payments/payouts";

/**
 * Rozetin rengi; her ton tasarım sisteminde tek bir anlam taşıyor.
 *
 * - `success` yeşil: tamamlanan, onaylanan, açık ilan.
 * - `warning` turuncu: "Ödeme Bekleniyor", kullanıcıdan bir adım bekleyen.
 * - `pending` mor: "Başvurularım" — cevabı karşı tarafta olan.
 * - `info` mavi: işveren panelinin yardımcı vurgusu (`--biz-blue`), sürmekte olan.
 * - `danger` kırmızı: başarısız, reddedilmiş, iptal.
 * - `neutral` gri: kapanmış, geri çekilmiş, bilinmeyen.
 */
export type StatusTone = "success" | "warning" | "pending" | "info" | "danger" | "neutral";

export function StatusBadge({
  tone,
  children,
  className,
  ...rest
}: {
  tone: StatusTone;
  children: ReactNode;
  className?: string;
} & Omit<ComponentPropsWithoutRef<"span">, "className" | "children">) {
  return (
    <span
      className={["ui-badge", `ui-badge-${tone}`, className].filter(Boolean).join(" ")}
      data-tone={tone}
      {...rest}
    >
      {children}
    </span>
  );
}

/*
  Durum → ton eşlemeleri. Etiket metinleri kendi modüllerinde kalıyor
  (`jobStatusLabel`, `assignmentStatusLabel`, `paymentStatusPresentation`);
  burada yalnız renk kararı var, böylece aynı durum iki ekranda iki renk olamıyor.
*/

/** İlan ayrıntısı durumu ham dize taşıyor; tanınmayan değer nötr kalır. */
export function jobStatusTone(status: JobStatus | "UNKNOWN" | string): StatusTone {
  switch (status) {
    case "OPEN":
      return "success";
    case "CANCELLED":
      return "danger";
    case "CLOSED":
    default:
      return "neutral";
  }
}

export function applicationStatusTone(status: ApplicationStatus): StatusTone {
  switch (status) {
    case "APPLIED":
      return "pending";
    case "ACCEPTED":
      return "success";
    case "REJECTED":
      return "danger";
    case "WITHDRAWN":
    default:
      return "neutral";
  }
}

export function assignmentStatusTone(status: AssignmentStatus): StatusTone {
  switch (status) {
    case "PENDING_CONFIRMATION":
      return "warning";
    case "CONFIRMED":
    case "COMPLETED":
      return "success";
    case "IN_PROGRESS":
      return "info";
    case "REJECTED":
    case "CANCELLED":
      return "danger";
    default:
      return "neutral";
  }
}

export function paymentStatusTone(status: PaymentStatus): StatusTone {
  switch (status) {
    case "PENDING_COLLECTION":
      return "warning";
    case "HELD_IN_ESCROW":
      return "info";
    case "RELEASED_TO_WORKER":
      return "success";
    case "FAILED":
      return "danger";
    case "REFUNDED":
    default:
      return "neutral";
  }
}

export function payoutStatusTone(status: PayoutStatus): StatusTone {
  switch (status) {
    case "COMPLETED":
      return "success";
    case "PENDING":
    case "PROCESSING":
      return "warning";
    case "FAILED":
      return "danger";
    default:
      return "neutral";
  }
}

/** Ödeme akışının kendi üçlü tonu (`PaymentTone`) rozet tonuna çevrilir. */
export function paymentToneToStatusTone(tone: "positive" | "warning" | "negative" | "neutral"): StatusTone {
  switch (tone) {
    case "positive":
      return "success";
    case "warning":
      return "warning";
    case "negative":
      return "danger";
    default:
      return "neutral";
  }
}
