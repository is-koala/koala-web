import "server-only";

import type { WorkSession } from "@/assignments/work-detail";
import { backendPaths } from "@/server/contract";
import { apiRequest } from "@/server/session/session";

/**
 * İşveren atama takibinin iki ucu.
 *
 * Ayrı bir modül, çünkü `@/server/assignments/work-detail` çalışanın ekranını
 * kuruyor ve oradaki sahiplik taraması işverenin listesini hiç okumuyor.
 * Ortak olan yalnız `WorkSession` modeli.
 */

/** `WorkSessionDto`'nun on yedi alanından ekranda kullanılan dördü. */
type WorkSessionDto = {
  id?: string | null;
  checkInAt?: string | null;
  checkOutAt?: string | null;
  minutes?: number | null;
};

/**
 * `GET /job-assignments/{id}/work-sessions` — `checkInAt` sırasında düz liste.
 *
 * Yanıt her oturum için giriş ve çıkış koordinatı da taşıyor; bunlar sınırı
 * geçmiyor. İşverenin ekranı "ne kadar çalışıldı" sorusunu cevaplıyor,
 * "işçi neredeydi" sorusunu değil.
 */
export async function readAssignmentWorkSessions(
  assignmentId: string,
): Promise<readonly WorkSession[]> {
  const sessions = await apiRequest<readonly WorkSessionDto[] | null>(
    `${backendPaths.jobAssignments}/${encodeURIComponent(assignmentId)}/work-sessions`,
    { cache: "no-store" },
  );

  return (sessions ?? []).map((dto) => ({
    id: dto.id ?? "",
    checkInAt: dto.checkInAt ?? "",
    checkOutAt: dto.checkOutAt ?? null,
    minutes: dto.minutes ?? null,
  }));
}

/**
 * `POST /job-assignments/{id}/complete` — gövdesiz.
 *
 * Geçiş kuralı burada tekrar edilmiyor: sunucu ödeme emanette değilse 409
 * `ASSIGNMENT_PAYMENT_NOT_SECURED`, durum `CONFIRMED`/`IN_PROGRESS` değilse
 * 409 `JOB_ASSIGNMENT_NOT_COMPLETABLE` döndürüyor. Ekranda düğmeyi kapatan
 * karar `@/assignments/employer-tracking` içinde; bu modül yalnız isteği
 * taşıyor ve reddi `errorCode` olarak geri veriyor.
 *
 * Yanıt güncel `MyAssignmentDto` taşıyor ama okunmuyor: sayfa zaten
 * `revalidatePath` ile yeniden çiziliyor ve tek doğru kaynak o okuma.
 */
export async function completeAssignment(assignmentId: string): Promise<void> {
  await apiRequest(
    `${backendPaths.jobAssignments}/${encodeURIComponent(assignmentId)}/complete`,
    { method: "POST" },
  );
}
