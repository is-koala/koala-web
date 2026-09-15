import type {
  CheckpointKind,
  WorkDetail,
  WorkSession,
} from "@/assignments/work-detail";
import type { LocationCapture } from "@/assignments/geolocation";
import { canOpenAssignmentDispute } from "@/assignments/resolution";
import { errorPresentation } from "@/lib/errors";
import { transportErrors } from "@/transport/errors";

export function openSession(detail: WorkDetail): WorkSession | null {
  return detail.sessions.find((session) => session.checkOutAt === null) ?? null;
}

export function canCheckIn(detail: WorkDetail): boolean {
  return (
    openSession(detail) === null &&
    (detail.assignment.status === "CONFIRMED" ||
      detail.assignment.status === "IN_PROGRESS") &&
    detail.assignment.paymentStatus === "HELD_IN_ESCROW"
  );
}

export function canOpenDispute(detail: WorkDetail): boolean {
  return canOpenAssignmentDispute({
    assignmentStatus: detail.assignment.status,
    paymentStatus: detail.assignment.paymentStatus,
    resolution: detail.resolution,
  });
}

export function totalMinutes(sessions: readonly WorkSession[]): number {
  return sessions.reduce((total, session) => total + (session.minutes ?? 0), 0);
}

export function formatDuration(total: number): string {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (hours === 0) return `${minutes} dk`;
  if (minutes === 0) return `${hours} sa`;
  return `${hours} sa ${minutes} dk`;
}

export function formatRate(value: string): string {
  const rate = Number(value);
  if (!Number.isFinite(rate)) return value;
  return new Intl.NumberFormat("tr-TR", { style: "percent", maximumFractionDigits: 2 }).format(rate);
}

export function formatNotice(minutes: number): string {
  return minutes > 0 ? formatDuration(minutes) : "İş başladı";
}

export function formatElapsed(checkInAt: string, now: number): string {
  const start = Date.parse(checkInAt);
  const seconds = Number.isFinite(start) ? Math.max(0, Math.floor((now - start) / 1000)) : 0;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  return [hours, minutes, rest].map((value) => String(value).padStart(2, "0")).join(":");
}

export function timesheetErrorMessage(errorCode: string, status: number): string {
  // Koltuk seçimi aynı komut kanalından geçiyor; cümleleri kendi
  // kataloğunda (`transportErrors`), kabuk kataloğuna birleştirilmedi.
  if (Object.hasOwn(transportErrors, errorCode)) return transportErrors[errorCode].message;
  if (errorCode === "TIMESHEET_ALREADY_CHECKED_IN") {
    return "Zaten açık bir çalışma oturumu var. Güncel durum gösteriliyor.";
  }
  if (errorCode === "TIMESHEET_NOT_CHECKED_IN") {
    return "Açık çalışma oturumu bulunamadı. Güncel durum gösteriliyor.";
  }
  return errorPresentation(errorCode, status).message;
}

export function locationNotice(
  capture: LocationCapture,
  kind: CheckpointKind,
): string | null {
  if (capture.status === "located") return null;
  const operation = kind === "check-in" ? "giriş" : "çıkış";
  switch (capture.reason) {
    case "denied":
      return `Konum izni verilmedi; ${operation} konumsuz kaydedildi.`;
    case "insecure":
      return `Güvenli bağlantı olmadığı için konum alınamadı; ${operation} konumsuz kaydedildi.`;
    case "unsupported":
      return `Bu tarayıcı konumu desteklemiyor; ${operation} konumsuz kaydedildi.`;
    case "failed":
      return `Konum alınamadı; ${operation} konumsuz kaydedildi.`;
  }
}
