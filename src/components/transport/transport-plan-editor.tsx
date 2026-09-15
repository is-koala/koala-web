"use client";

import { useActionState, useState, useSyncExternalStore } from "react";

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
import { takeTransportDraftHandoff } from "@/transport/carry-over";
import { transportErrorSentences } from "@/transport/errors";
import {
  mergeServerPlan,
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
 * sunucu action'ında da okunuyor. 404 ve 409'da (`TRANSPORT_SHUTTLE_NOT_FOUND`,
 * `TRANSPORT_SHUTTLE_CAPACITY_BELOW_SEATS`, …) action güncel planı da
 * getiriyor ve form kullanıcının taslağını **silmeden** onunla birleştiriyor
 * (`mergeServerPlan`): yazdıkları durur, doluluk ve kimlikler sunucudan
 * gelir; birleşik taslak yeniden denetlenip kapasite hatası ilgili servisin
 * altına düşer, üst bant cümleyi kendi kataloğundan (`transportErrors`) yazar.
 */
export function TransportPlanEditor({
  plan,
  action,
  addressGateway,
  addressDebounceMs,
  publishFailed = false,
}: {
  plan: TransportPlan | null;
  action: TransportPlanFormAction;
  addressGateway?: AddressGateway;
  addressDebounceMs?: number;
  /**
   * Sihirbaz ilanı yayımladı ama planı yazamadı (`?ulasim=kaydedilemedi`):
   * not çizilir ve sihirbazın bıraktığı taslak (`carry-over.ts`) forma alınır.
   */
  publishFailed?: boolean;
}) {
  const [draft, setDraft] = useState<TransportPlanDraft>(() => transportPlanDraftFrom(plan));
  const [clientErrors, setClientErrors] = useState<Readonly<Record<string, string>>>({});

  // `sessionStorage` sunucuda yok; taşınan taslak hidrasyondan sonra, aynı
  // render içinde ("önceki render'dan bilgi saklama" kalıbı) bir kez alınıyor.
  const hydrated = useSyncExternalStore(subscribeToNothing, () => true, () => false);
  const [handoffTaken, setHandoffTaken] = useState(false);
  if (publishFailed && hydrated && !handoffTaken) {
    setHandoffTaken(true);
    const carried = takeTransportDraftHandoff();
    if (carried !== null) setDraft(carried);
  }

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
    } else if (state.status === "error" && state.plan) {
      // Red planın bu sırada değişmesinden geliyor (başka cihazdan koltuk,
      // silinen servis): kullanıcının yazdıkları kalır, gerçekler sunucudan
      // gelir ve birleşik taslak yeniden denetlenir ki kapasite hatası
      // ilgili servisin altında görünsün.
      const merged = mergeServerPlan(draft, state.plan);
      setDraft(merged);
      setClientErrors(transportPlanErrors(merged, () => true));
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
      ? assignmentErrorMessage(state.errorCode, state.httpStatus, transportErrorSentences)
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
      {publishFailed ? (
        <p className="form-warning" role="alert" data-testid="transport-publish-notice">
          İlan yayımlandı ama ulaşım planı kaydedilemedi. Sihirbazda girdiklerin aşağıda;
          durak adreslerini yeniden onaylayıp planı kaydet.
        </p>
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

/** Hidrasyon dışında değişen bir şey yok; abone olunacak bir kaynak da yok. */
function subscribeToNothing() {
  return () => {};
}

/** Adres arama kutusunda Enter formu göndermesin (`job-form.tsx` ile aynı). */
function blockImplicitSubmit(event: React.KeyboardEvent<HTMLFormElement>) {
  const target = event.target as HTMLElement;
  if (event.key !== "Enter" || target.tagName !== "INPUT") return;
  event.preventDefault();
}
