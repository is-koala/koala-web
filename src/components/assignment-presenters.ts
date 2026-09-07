import type { AssignmentStatus, PaymentStatus } from "@/assignments/contract";
import { monthName } from "@/lib/dates";

export const assignmentStatusLabel: Readonly<Record<AssignmentStatus, string>> = {
  PENDING_CONFIRMATION: "Onay bekliyor",
  CONFIRMED: "Onaylandı",
  IN_PROGRESS: "Devam ediyor",
  COMPLETED: "Tamamlandı",
  REJECTED: "Reddedildi",
  CANCELLED: "İptal edildi",
  UNKNOWN: "Durum güncelleniyor",
};

export const paymentStatusLabel: Readonly<Record<PaymentStatus, string>> = {
  PENDING_COLLECTION: "Ödeme bekleniyor",
  HELD_IN_ESCROW: "Ödeme güvende",
  RELEASED_TO_WORKER: "Ödeme aktarıldı",
  FAILED: "Ödeme tamamlanamadı",
  REFUNDED: "İade sürecinde",
  UNKNOWN: "Ödeme durumu güncelleniyor",
};

export function formatAssignmentDate(startsAt: string, endsAt: string): string {
  const start = localDateParts(startsAt);
  const end = localDateParts(endsAt);
  if (!start || !end) return startsAt;

  const startLabel = `${start.day} ${monthName(start.month)} ${start.year}, ${start.time}`;
  if (start.year === end.year && start.month === end.month && start.day === end.day) {
    return `${startLabel}–${end.time}`;
  }
  return `${startLabel} – ${end.day} ${monthName(end.month)} ${end.year}, ${end.time}`;
}

export function formatMoney(amount: string, currency: string): string {
  const value = Number(amount);
  if (!Number.isFinite(value) || !currency) return [amount, currency].filter(Boolean).join(" ");
  try {
    return new Intl.NumberFormat("tr-TR", { style: "currency", currency }).format(value);
  } catch {
    return `${amount} ${currency}`;
  }
}

function localDateParts(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    time: `${match[4]}:${match[5]}`,
  };
}
