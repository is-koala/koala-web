"use client";

import { useActionState } from "react";

import {
  idleCompletionActionState,
  type CompletionAction,
  type CompletionDecision,
  type TrackingEvent,
} from "@/assignments/employer-tracking";
import type { WorkSession } from "@/assignments/work-detail";
import { formatDateTime, formatDuration, totalMinutes } from "@/components/work-detail/presenters";
import { errorPresentation } from "@/lib/errors";

/**
 * Atamanın durum çizelgesi, puantajı ve tamamlama eylemi.
 *
 * Üçü tek bileşende, çünkü aynı soruyu üç ölçekte cevaplıyorlar: atama nerede,
 * ne kadar çalışıldı, sıradaki eylem ne. Ayrı ayrı çizilseler kullanıcı
 * "tamamlandı işaretle" düğmesinin neden kapalı olduğunu çizelgeye bakarak
 * kendi bulmak zorunda kalırdı.
 */
export function EmployerAssignmentTracking({
  timeline,
  sessions,
  completion,
  action,
}: {
  timeline: readonly TrackingEvent[];
  sessions: readonly WorkSession[];
  completion: CompletionDecision;
  action: CompletionAction;
}) {
  const [state, submit, pending] = useActionState(action, idleCompletionActionState);
  const worked = totalMinutes(sessions);

  return (
    <section className="work-detail-section assignment-tracking" aria-labelledby="assignment-tracking-title">
      <h2 id="assignment-tracking-title">Atama takibi</h2>

      <ol className="work-timeline assignment-timeline" aria-label="Atama zaman çizelgesi">
        {timeline.map((event) => (
          <li key={event.key} data-reached={String(event.reached)}>
            <strong>{event.label}</strong>
            {event.at ? <time dateTime={event.at}>{formatDateTime(event.at)}</time> : null}
          </li>
        ))}
      </ol>

      <div className="work-session-history">
        <div className="section-heading-row">
          <h3>Çalışma oturumları</h3>
          <strong className="work-total">Toplam {formatDuration(worked)}</strong>
        </div>
        {sessions.length === 0 ? (
          <p className="muted">Henüz çalışma oturumu kaydı yok.</p>
        ) : (
          <ul>
            {[...sessions].reverse().map((session) => (
              <li key={session.id}>
                <span>{formatDateTime(session.checkInAt)}</span>
                <strong>
                  {session.checkOutAt ? formatDuration(session.minutes ?? 0) : "Devam ediyor"}
                </strong>
              </li>
            ))}
          </ul>
        )}
      </div>

      {state.status === "done" ? (
        <p role="status" className="work-location-notice">
          Atama tamamlandı olarak işaretlendi.
        </p>
      ) : null}
      {state.status === "error" ? (
        <p role="alert" className="form-warning">
          {completionErrorMessage(state.errorCode, state.httpStatus)}
        </p>
      ) : null}

      {/*
        Kapalı eylem gizlenmiyor, kilitleniyor ve nedeni yanına yazılıyor:
        "bu atamada tamamlama yok" ile "henüz tamamlanamaz" arasındaki fark
        ekranda kalmalı.
      */}
      <div className="assignment-completion">
        <form action={submit}>
          <button
            className="button button-primary"
            disabled={!completion.available || pending}
          >
            {pending ? "İşaretleniyor" : "İşi tamamlandı işaretle"}
          </button>
        </form>
        {completion.blockedReason ? (
          <p className="muted">{completion.blockedReason}</p>
        ) : (
          <p className="muted">
            İşaretledikten sonra emanetteki ödeme işçiye aktarılmak üzere işlenir.
          </p>
        )}
      </div>
    </section>
  );
}

/**
 * Tamamlamanın iki reddi.
 *
 * İkisi de `conflict` ailesinde ve aile metni ("Bu kayıt başka bir duruma
 * geçmiş olabilir") ikisini de aynı şeye benzetirdi. Oysa yapılacak iş farklı:
 * birinde ödeme tamamlanacak, öbüründe atamanın durumu değişmiş.
 */
function completionErrorMessage(errorCode: string, httpStatus: number): string {
  if (errorCode === "ASSIGNMENT_PAYMENT_NOT_SECURED") {
    return "Ödeme emanete alınmadan atama tamamlanamaz. Önce ödemeyi tamamla.";
  }
  if (errorCode === "JOB_ASSIGNMENT_NOT_COMPLETABLE") {
    return "Atamanın durumu bu sırada değişmiş; tamamlanabilir bir durumda değil. Sayfayı yenileyip güncel durumu gör.";
  }
  if (errorCode === "JOB_ASSIGNMENT_NOT_FOUND") {
    return "Atama bulunamadı veya erişim yetkin yok.";
  }
  return errorPresentation(errorCode, httpStatus).message;
}
