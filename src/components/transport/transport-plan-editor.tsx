"use client";

import { useActionState, useState } from "react";

import type { AddressGateway } from "@/address/gateway-client";
import { assignmentErrorMessage } from "@/components/assignment-error-message";
import { SubmitButton } from "@/components/form-controls";
import { formatDateTime } from "@/lib/dates";
import type { TransportPlan } from "@/transport/contract";
import {
  idleTransportPlanFormState,
  type TransportPlanFormAction,
  type TransportPlanFormState,
} from "@/transport/editor-state";
import { transportErrors } from "@/transport/errors";
import {
  transportAddressField,
  transportFieldErrors,
  transportPlanDraftFrom,
  transportPlanErrors,
  type TransportPlanDraft,
} from "@/transport/plan-form";

import { TransportPlanFields } from "./transport-plan-fields";

/**
 * Yayımlanmış ilanın "Ulaşım planı" bölümü (is-koala/koala-web#187).
 *
 * Plan bütünüyle yazılıyor (`PUT`), yani kaydedilmemiş bir servis listede
 * yoksa koltuklarıyla birlikte gidiyor. Bu yüzden form kayıttan sonra
 * sunucunun döndürdüğü plandan yeniden kuruluyor: yeni açılan servis ve
 * duraklar kimliklerini alıyor ve ikinci kayıt onları yerinde güncelliyor.
 *
 * Gönderimden önceki son kapı istemcide (`transportPlanErrors`); aynı kural
 * sunucu action'ında da okunuyor. 409'lar (`TRANSPORT_SHUTTLE_CAPACITY_BELOW_SEATS`,
 * `TRANSPORT_SHUTTLE_DIRECTION_LOCKED`) alan hatası taşımıyor; üst bant
 * cümleyi kendi kataloğundan (`transportErrors`) yazıyor. Kapasite kuralı
 * istemcide de var: taslak `seatsTaken`'ı taşıyor ve gönderimden önce
 * ilgili servisin alanına düşüyor; 409 yalnız yarış yedeği.
 */
export function TransportPlanEditor({
  plan,
  action,
  addressGateway,
  addressDebounceMs,
  publishNotice = null,
}: {
  plan: TransportPlan | null;
  action: TransportPlanFormAction;
  addressGateway?: AddressGateway;
  addressDebounceMs?: number;
  /** Sihirbazdan gelen "ilan yayımlandı ama plan kaydedilemedi" notu. */
  publishNotice?: string | null;
}) {
  const [draft, setDraft] = useState<TransportPlanDraft>(() => transportPlanDraftFrom(plan));
  const [clientErrors, setClientErrors] = useState<Readonly<Record<string, string>>>({});

  const submit = async (
    previous: TransportPlanFormState,
    formData: FormData,
  ): Promise<TransportPlanFormState> => {
    const errors = transportPlanErrors(draft, (key) => Boolean(formData.get(transportAddressField(key))));
    if (Object.keys(errors).length > 0) {
      setClientErrors(errors);
      return { status: "error", errorCode: "VALIDATION_FAILED", httpStatus: 400, fieldErrors: errors };
    }
    setClientErrors({});
    return action(previous, formData);
  };

  const [state, formAction] = useActionState(submit, idleTransportPlanFormState);

  // Kayıt ya da red sonrası sunucunun planı: form ondan yeniden kuruluyor.
  // "Önceki render'dan bilgi saklama" kalıbı (React belgeleri): durum nesnesi
  // değiştiğinde taslak aynı render içinde sıfırlanıyor, bir etkiyle değil —
  // etki bir kare boyunca eski taslağı çizerdi.
  const [appliedState, setAppliedState] = useState<TransportPlanFormState>(state);
  if (appliedState !== state) {
    setAppliedState(state);
    if (state.status === "done") {
      setDraft(transportPlanDraftFrom(state.plan));
      setClientErrors({});
    } else if (state.status === "error" && state.httpStatus === 404 && state.plan !== undefined) {
      // Red, planın bu sırada değişmesinden geliyorsa kullanıcı güncel
      // plan üzerinde düzeltsin; yazdıklarını korumanın karşılığı yok çünkü
      // kimlikler ve koltuk sayıları artık başka.
      setDraft(transportPlanDraftFrom(state.plan));
    }
  }

  const savedPlan: TransportPlan | null =
    state.status === "done"
      ? state.plan
      : state.status === "error" && state.plan !== undefined
        ? state.plan
        : plan;

  const fieldErrors = {
    ...clientErrors,
    ...(state.status === "error" ? transportFieldErrors(state.fieldErrors ?? {}) : {}),
  };

  const errorMessage =
    state.status === "error" && state.errorCode !== "VALIDATION_FAILED"
      ? assignmentErrorMessage(state.errorCode, state.httpStatus, transportSentences)
      : state.status === "error"
        ? "Bazı alanlar eksik ya da hatalı; işaretli alanları düzelt."
        : null;

  return (
    <section className="transport-plan-editor" aria-labelledby="transport-plan-heading">
      <h2 id="transport-plan-heading">Ulaşım planı</h2>
      <p className="muted">
        Gidiş ve dönüş için servis, yol parası ya da kendi imkânı seçebilirsin. Servis
        tanımlarsan işe aldığın çalışanlar durağını kendisi seçer; plaka, şoför ve tam adres
        yalnızca onlara görünür.
      </p>
      {publishNotice ? (
        <p className="form-warning" role="alert">{publishNotice}</p>
      ) : null}
      {savedPlan?.updatedAt ? (
        <p className="field-hint">
          Son kayıt: <time dateTime={savedPlan.updatedAt}>{formatDateTime(savedPlan.updatedAt)}</time>
        </p>
      ) : null}

      <form action={formAction} noValidate onKeyDown={blockImplicitSubmit} className="transport-plan-form">
        {errorMessage ? (
          <p className="form-warning" role="alert" data-testid="transport-plan-error">
            {errorMessage}
          </p>
        ) : null}
        {state.status === "done" ? (
          <p className="work-location-notice" role="status">Ulaşım planı kaydedildi.</p>
        ) : null}
        <TransportPlanFields
          draft={draft}
          onChange={setDraft}
          fieldErrors={fieldErrors}
          addressGateway={addressGateway}
          addressDebounceMs={addressDebounceMs}
        />
        <div className="transport-plan-actions">
          <SubmitButton label="Ulaşım planını kaydet" pendingLabel="Kaydediliyor…" />
        </div>
      </form>
    </section>
  );
}

const transportSentences: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(transportErrors).map(([code, entry]) => [code, entry.message]),
);

/** Adres arama kutusunda Enter formu göndermesin (`job-form.tsx` ile aynı). */
function blockImplicitSubmit(event: React.KeyboardEvent<HTMLFormElement>) {
  const target = event.target as HTMLElement;
  if (event.key !== "Enter" || target.tagName !== "INPUT") return;
  event.preventDefault();
}
