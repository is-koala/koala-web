"use client";

import { useActionState } from "react";

import { MessagingGate, type MessagingParty } from "@/components/messaging/messaging-gate";
import { errorPresentation } from "@/lib/errors";
import {
  idleConversationState,
  type ConversationAction,
  type MessagingAvailability,
} from "@/messaging/contract";

/**
 * Atama ayrıntısındaki mesajlaşma bölümü — işveren ve çalışan aynı bileşeni
 * çiziyor, ayrıldıkları yer eylem ve kapının metni.
 *
 * Eylem başarıda mesaj kabuğuna yönlendiriyor; burada yalnız red kalıyor ve
 * metin `errorCode` ile kataloğdan seçiliyor (`src/lib/errors.ts`): kapı
 * çizildikten sonra ödeme iade edilmişse 409 `MESSAGING_WINDOW_CLOSED`,
 * karar eski bir listeden geldiyse 403 `MESSAGING_PAYMENT_REQUIRED` düşer.
 *
 * Karar `null` ise bölüm **hiç** çizilmiyor — başlık da yok. Eski bir
 * önbellekten gelen atama için "mesajlaşma" başlığı altında boşluk bırakmak
 * kullanıcıya düğmenin kaybolduğunu düşündürürdü.
 */
export function AssignmentMessaging({
  availability,
  party,
  assignmentId,
  action,
}: {
  availability: MessagingAvailability | null;
  party: MessagingParty;
  assignmentId: string;
  action: ConversationAction;
}) {
  const [state, submit, pending] = useActionState(action, idleConversationState);
  if (availability === null) return null;

  return (
    <section className="assignment-messaging" aria-labelledby="assignment-messaging-title">
      <h2 id="assignment-messaging-title">Mesajlaşma</h2>
      {state.status === "error" ? (
        <p role="alert" className="form-warning">
          {errorPresentation(state.errorCode, state.httpStatus).message}
        </p>
      ) : null}
      <MessagingGate availability={availability} party={party} assignmentId={assignmentId}>
        <form action={submit}>
          <button className="button button-secondary button-small" disabled={pending}>
            Mesaj gönder
          </button>
        </form>
      </MessagingGate>
    </section>
  );
}
