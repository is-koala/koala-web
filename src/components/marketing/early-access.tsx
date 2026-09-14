"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState, useId } from "react";
import { useFormStatus } from "react-dom";

import { homeContent } from "@/content/marketing";
import { fieldError, idleFormState, type FormAction, type FormState } from "@/lib/form-state";

import mascot from "../../../public/brand/maskot-3.webp";

const copy = homeContent.earlyAccess;

/**
 * Erken erişim kartı. Alanlar mockup'taki hap biçiminde ama etiketleri var:
 * yalnız placeholder'a dayanan alan ekran okuyucuya adsız kalırdı. KVKK onayı
 * destek formuyla aynı: kayıt aynı kutuya düşüyor.
 *
 * `form-controls` ve `@/lib/errors` bilerek kullanılmıyor: ikisi `states.tsx`
 * ve hata kataloğunu ana sayfanın istemci paketine ikinci kez taşıyordu
 * (katalog kök `error.tsx` sınırının parçasında zaten var; Turbopack sayfa
 * parçasında yineliyor) ve Lighthouse betik bütçesi 256 KB'de
 * (`lighthouse-budget.cjs`). Formun görebileceği üç durum burada, kod ile
 * seçilerek ve bilinmeyen kodda nötr yedekle (`AGENTS.md` § Ekran durumları).
 */
const failureCopy: Record<string, string> = {
  TOO_MANY_REQUESTS: "Kısa sürede çok fazla deneme oldu; birkaç dakika sonra yeniden dene.",
  VALIDATION_FAILED: "Alanlardan biri eksik ya da hatalı; işaretli yerleri düzeltip yeniden gönder.",
};
const failureFallback = "Kaydın şu an alınamadı. Biraz sonra yeniden dene; olmazsa iletişim sayfasından yaz.";

function Alert({ state }: { state: FormState }) {
  if (state.status !== "error") return null;
  return (
    <p role="alert" className="state-card state-card-error">
      {failureCopy[state.errorCode] ?? failureFallback}
    </p>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p className="field-error" id={id}>
      {message}
    </p>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button className="button button-primary" type="submit" disabled={pending}>
      {pending ? copy.pending : copy.submit}
    </button>
  );
}

const checkIcon = (
  <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
);

export function EarlyAccess({ action, kvkkPath }: { action: FormAction; kvkkPath: string }) {
  const [state, submit] = useActionState(action, idleFormState);
  const id = useId();
  const nameError = fieldError(state, "name");
  const emailError = fieldError(state, "email");
  const consentError = fieldError(state, "consent");

  return (
    <section id="erken-erisim" className="mk-section mk-section-white" aria-labelledby="erken-title">
      <div className="mk-inner">
        <div className="mk-early">
          <div className="mk-early-copy">
            <h2 id="erken-title" className="mk-title">{copy.title}</h2>
            <p className="mk-intro">{copy.body}</p>
            {state.status === "done" ? (
              <p className="mk-early-done" role="status">
                {checkIcon}
                <span>
                  <strong>{copy.doneTitle}</strong> {copy.doneBody}
                </span>
              </p>
            ) : (
              <form className="mk-early-form" action={submit}>
                <Alert state={state} />
                <div className="honeypot-field" aria-hidden="true">
                  <label htmlFor={`${id}-website`}>Web sitesi</label>
                  <input id={`${id}-website`} name="website" type="text" tabIndex={-1} autoComplete="off" />
                </div>
                <div className="mk-early-row">
                  <div className="mk-pill-field">
                    <label htmlFor={`${id}-name`}>{copy.nameLabel}</label>
                    <input
                      id={`${id}-name`}
                      name="name"
                      type="text"
                      autoComplete="given-name"
                      required
                      maxLength={100}
                      aria-invalid={nameError ? true : undefined}
                      aria-describedby={nameError ? `${id}-name-error` : undefined}
                    />
                  </div>
                  <div className="mk-pill-field mk-pill-field-grow">
                    <label htmlFor={`${id}-email`}>{copy.emailLabel}</label>
                    <input
                      id={`${id}-email`}
                      name="email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      placeholder={copy.emailPlaceholder}
                      required
                      maxLength={254}
                      aria-invalid={emailError ? true : undefined}
                      aria-describedby={emailError ? `${id}-email-error` : undefined}
                    />
                  </div>
                  <Submit />
                </div>
                <FieldError id={`${id}-name-error`} message={nameError} />
                <FieldError id={`${id}-email-error`} message={emailError} />
                <div className="checkbox-field mk-early-consent">
                  <input
                    id={`${id}-consent`}
                    name="consent"
                    type="checkbox"
                    value="granted"
                    required
                    aria-invalid={consentError ? true : undefined}
                    aria-describedby={consentError ? `${id}-consent-error` : undefined}
                  />
                  <label htmlFor={`${id}-consent`}>
                    <Link className="mk-text-link" href={kvkkPath}>
                      KVKK Aydınlatma Metni
                    </Link>
                    {"'ni okudum; e-postamın yalnız bu haber için işlenmesini kabul ediyorum."}
                  </label>
                </div>
                <FieldError id={`${id}-consent-error`} message={consentError} />
              </form>
            )}
          </div>
          <div className="mk-early-visual">
            <Image src={mascot} alt="" sizes="(max-width: 700px) 50vw, 250px" />
          </div>
        </div>
      </div>
    </section>
  );
}
