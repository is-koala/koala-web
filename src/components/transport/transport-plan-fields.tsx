"use client";

import { useId, useState } from "react";

import type { AddressGateway } from "@/address/gateway-client";
import { CanonicalAddressForm } from "@/components/canonical-address-form";
import {
  FieldError,
  InputField,
  SelectField,
  TextField,
  TextareaField,
} from "@/components/form-controls";
import {
  transportDirectionLabels,
  transportDirections,
  transportMethodLabels,
  transportMethods,
  type TransportDirection,
} from "@/transport/contract";
import {
  allowanceApplies,
  emptyShuttleDraft,
  emptyStopDraft,
  isTransportMethod,
  methodFor,
  serializeTransportPlanDraft,
  shuttleCapacityRange,
  stopAddressFieldErrors,
  transportAddressField,
  transportPlanField,
  transportTextLimits,
  type ShuttleDraft,
  type StopDraft,
  type TransportPlanDraft,
} from "@/transport/plan-form";

/**
 * Ulaşım planı alanları (is-koala/koala-web#187).
 *
 * Kendi `<form>`'u yok, bilerek: aynı alanlar hem ilan sihirbazının tek
 * formunda bir adım hem de yayımlanmış ilanın sayfasında ayrı bir form
 * (`TransportPlanEditor`). Taslak dışarıda tutuluyor ki sihirbaz onu kendi
 * durumuyla birlikte taşısın ve düzenleyici kayıttan sonra sunucunun
 * döndürdüğü plandan yeniden kurabilsin.
 *
 * Gövde tek gizli alanda JSON (`transportPlan`); durak adresleri
 * `CanonicalAddressForm`'un kendi gizli alanında (`transportAddress.<key>`).
 * Sunucu `readTransportPlanWrite` ile birleştiriyor.
 *
 * Servis yalnız yöntemi "Servis" olan yönde tanımlanabiliyor (DTO kuralı):
 * yöntem değişince o yönün servisleri ekranda kalıyor ama taslak hatası
 * yazıyor — sessizce silmek, seçilmiş koltukları da düşürürdü.
 */
export type TransportPlanFieldsProps = {
  draft: TransportPlanDraft;
  onChange: (draft: TransportPlanDraft) => void;
  /** `transportFieldErrors` ile çevrilmiş, `shuttles[0].stops[1].scheduledAt` biçiminde. */
  fieldErrors?: Readonly<Record<string, string>>;
  addressGateway?: AddressGateway;
  addressDebounceMs?: number;
};

const methodOptions = transportMethods.map((method) => ({
  value: method,
  label: transportMethodLabels[method],
}));

export function TransportPlanFields({
  draft,
  onChange,
  fieldErrors = {},
  addressGateway,
  addressDebounceMs,
}: TransportPlanFieldsProps) {
  const id = useId();
  const set = <K extends keyof TransportPlanDraft>(field: K, value: TransportPlanDraft[K]) =>
    onChange({ ...draft, [field]: value });

  const setMethod = (direction: TransportDirection, value: string) => {
    if (!isTransportMethod(value)) return;
    set(direction === "OUTBOUND" ? "outboundMethod" : "returnMethod", value);
  };

  const updateShuttle = (key: string, shuttle: ShuttleDraft) =>
    set("shuttles", draft.shuttles.map((current) => (current.key === key ? shuttle : current)));
  const removeShuttle = (key: string) =>
    set("shuttles", draft.shuttles.filter((current) => current.key !== key));
  const addShuttle = (direction: TransportDirection) =>
    set("shuttles", [...draft.shuttles, emptyShuttleDraft(direction)]);

  return (
    <div className="transport-plan-fields">
      <input type="hidden" name={transportPlanField} value={serializeTransportPlanDraft(draft)} readOnly />

      <div className="transport-methods">
        {transportDirections.map((direction) => (
          <SelectField
            key={direction}
            id={`${id}-${direction}`}
            name={`transport-${direction}`}
            label={direction === "OUTBOUND" ? "İşe gidiş" : "İşten dönüş"}
            placeholder="Seç"
            options={methodOptions}
            value={methodFor(draft, direction)}
            onChange={(event) => setMethod(direction, event.target.value)}
            error={fieldErrors[direction === "OUTBOUND" ? "outboundMethod" : "returnMethod"]}
          />
        ))}
      </div>

      {allowanceApplies(draft) ? (
        <div className="transport-allowance">
          <InputField
            id={`${id}-allowance`}
            name="transport-allowanceAmount"
            type="number"
            label="Yol parası (₺)"
            hint="Bilgi amaçlı: tutarı işçiye elden verirsin, Koala üzerinden tahsil edilmez."
            min="0"
            step="0.01"
            defaultValue=""
            value={draft.allowanceAmount}
            onValueChange={(value) => set("allowanceAmount", value)}
            error={fieldErrors.allowanceAmount}
          />
          <TextareaField
            id={`${id}-allowance-note`}
            name="transport-allowanceNote"
            label="Yol parası notu"
            hint="Ne zaman ve nasıl verileceği gibi."
            rows={2}
            maxLength={transportTextLimits.allowanceNote}
            defaultValue=""
            value={draft.allowanceNote}
            onValueChange={(value) => set("allowanceNote", value)}
            error={fieldErrors.allowanceNote}
          />
        </div>
      ) : null}

      <TextareaField
        id={`${id}-notes`}
        name="transport-notes"
        label="Ulaşım notu"
        hint="Yalnızca işe aldığın çalışanlar görür."
        rows={2}
        maxLength={transportTextLimits.notes}
        defaultValue=""
        value={draft.notes}
        onValueChange={(value) => set("notes", value)}
        error={fieldErrors.notes}
      />

      <FieldError id={`${id}-shuttles-error`} message={fieldErrors.shuttles} />

      {transportDirections.map((direction) => {
        const shuttles = draft.shuttles
          .map((shuttle, index) => ({ shuttle, index }))
          .filter(({ shuttle }) => shuttle.direction === direction);
        if (methodFor(draft, direction) !== "SHUTTLE" && shuttles.length === 0) return null;
        return (
          <section
            key={direction}
            className="transport-direction"
            aria-labelledby={`${id}-${direction}-heading`}
          >
            <h3 id={`${id}-${direction}-heading`}>{transportDirectionLabels[direction]} servisleri</h3>
            {methodFor(draft, direction) !== "SHUTTLE" ? (
              <p className="form-warning" role="alert">
                Bu yönün yöntemi artık servis değil; aşağıdaki servisleri kaldır ya da yöntemi
                yeniden &quot;Servis&quot; yap.
              </p>
            ) : null}
            {shuttles.map(({ shuttle, index }) => (
              <ShuttleFields
                key={shuttle.key}
                idPrefix={`${id}-${shuttle.key}`}
                index={index}
                shuttle={shuttle}
                fieldErrors={fieldErrors}
                addressGateway={addressGateway}
                addressDebounceMs={addressDebounceMs}
                onChange={(next) => updateShuttle(shuttle.key, next)}
                onRemove={() => removeShuttle(shuttle.key)}
              />
            ))}
            {methodFor(draft, direction) === "SHUTTLE" ? (
              <button
                type="button"
                className="button button-secondary button-small"
                onClick={() => addShuttle(direction)}
              >
                {shuttles.length === 0 ? "Servis ekle" : "Bir servis daha ekle"}
              </button>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

function ShuttleFields({
  idPrefix,
  index,
  shuttle,
  fieldErrors,
  addressGateway,
  addressDebounceMs,
  onChange,
  onRemove,
}: {
  idPrefix: string;
  index: number;
  shuttle: ShuttleDraft;
  fieldErrors: Readonly<Record<string, string>>;
  addressGateway?: AddressGateway;
  addressDebounceMs?: number;
  onChange: (shuttle: ShuttleDraft) => void;
  onRemove: () => void;
}) {
  const at = `shuttles[${index}]`;
  const errorFor = (field: string) => fieldErrors[`${at}.${field}`];
  const set = <K extends keyof ShuttleDraft>(field: K, value: ShuttleDraft[K]) =>
    onChange({ ...shuttle, [field]: value });
  const updateStop = (key: string, stop: StopDraft) =>
    set("stops", shuttle.stops.map((current) => (current.key === key ? stop : current)));
  const removeStop = (key: string) => set("stops", shuttle.stops.filter((current) => current.key !== key));

  return (
    <fieldset className="transport-shuttle" data-testid="transport-shuttle">
      <legend>
        {shuttle.name.trim() || `${index + 1}. servis`}
        {shuttle.id !== null ? (
          <span className="muted"> · {shuttle.seatsTaken} koltuk seçilmiş</span>
        ) : null}
      </legend>
      <FieldError id={`${idPrefix}-direction-error`} message={errorFor("direction")} />
      <div className="transport-shuttle-grid">
        <TextField
          id={`${idPrefix}-name`}
          name={`transport-${shuttle.key}-name`}
          label="Servis adı"
          hint="İlanda herkese görünür."
          maxLength={transportTextLimits.name}
          value={shuttle.name}
          onValueChange={(value) => set("name", value)}
          error={errorFor("name")}
        />
        <InputField
          id={`${idPrefix}-capacity`}
          name={`transport-${shuttle.key}-capacity`}
          type="number"
          label="Koltuk sayısı"
          min={String(shuttleCapacityRange.minimum)}
          max={String(shuttleCapacityRange.maximum)}
          defaultValue=""
          value={shuttle.capacity}
          onValueChange={(value) => set("capacity", value)}
          error={errorFor("capacity")}
        />
        <TextField
          id={`${idPrefix}-plate`}
          name={`transport-${shuttle.key}-plate`}
          label="Plaka"
          hint="Yalnızca işe aldığın çalışanlar görür."
          required={false}
          maxLength={transportTextLimits.plate}
          value={shuttle.plate}
          onValueChange={(value) => set("plate", value)}
          error={errorFor("plate")}
        />
        <TextField
          id={`${idPrefix}-driver-name`}
          name={`transport-${shuttle.key}-driverName`}
          label="Şoför adı"
          required={false}
          maxLength={transportTextLimits.driverName}
          value={shuttle.driverName}
          onValueChange={(value) => set("driverName", value)}
          error={errorFor("driverName")}
        />
        <TextField
          id={`${idPrefix}-driver-phone`}
          name={`transport-${shuttle.key}-driverPhone`}
          label="Şoför telefonu"
          required={false}
          inputMode="text"
          autoComplete="off"
          maxLength={transportTextLimits.driverPhone}
          value={shuttle.driverPhone}
          onValueChange={(value) => set("driverPhone", value)}
          error={errorFor("driverPhone")}
        />
      </div>

      <div className="transport-stops">
        <h4>Duraklar</h4>
        <FieldError id={`${idPrefix}-stops-error`} message={errorFor("stops")} />
        {shuttle.stops.map((stop, stopIndex) => (
          <StopFields
            key={stop.key}
            idPrefix={`${idPrefix}-${stop.key}`}
            shuttleIndex={index}
            stopIndex={stopIndex}
            stop={stop}
            fieldErrors={fieldErrors}
            addressGateway={addressGateway}
            addressDebounceMs={addressDebounceMs}
            onChange={(next) => updateStop(stop.key, next)}
            onRemove={() => removeStop(stop.key)}
          />
        ))}
        <button
          type="button"
          className="button button-secondary button-small"
          onClick={() => set("stops", [...shuttle.stops, emptyStopDraft()])}
        >
          Durak ekle
        </button>
      </div>

      <RemoveControl
        label="Servisi kaldır"
        seatsTaken={shuttle.seatsTaken}
        what="serviste"
        onConfirm={onRemove}
      />
    </fieldset>
  );
}

function StopFields({
  idPrefix,
  shuttleIndex,
  stopIndex,
  stop,
  fieldErrors,
  addressGateway,
  addressDebounceMs,
  onChange,
  onRemove,
}: {
  idPrefix: string;
  shuttleIndex: number;
  stopIndex: number;
  stop: StopDraft;
  fieldErrors: Readonly<Record<string, string>>;
  addressGateway?: AddressGateway;
  addressDebounceMs?: number;
  onChange: (stop: StopDraft) => void;
  onRemove: () => void;
}) {
  const at = `shuttles[${shuttleIndex}].stops[${stopIndex}]`;
  const errorFor = (field: string) => fieldErrors[`${at}.${field}`];
  const set = <K extends keyof StopDraft>(field: K, value: StopDraft[K]) =>
    onChange({ ...stop, [field]: value });

  return (
    <div className="transport-stop" data-testid="transport-stop">
      <p className="transport-stop-title">
        <strong>{stop.label.trim() || `${stopIndex + 1}. durak`}</strong>
        {stop.id !== null ? <span className="muted"> · {stop.seatsTaken} koltuk</span> : null}
      </p>
      <div className="transport-shuttle-grid">
        <TextField
          id={`${idPrefix}-label`}
          name={`transport-${stop.key}-label`}
          label="Durak adı"
          required={false}
          maxLength={transportTextLimits.label}
          value={stop.label}
          onValueChange={(value) => set("label", value)}
          error={errorFor("label")}
        />
        <InputField
          id={`${idPrefix}-scheduled-at`}
          name={`transport-${stop.key}-scheduledAt`}
          type="datetime-local"
          label="Kalkış saati"
          hint="Türkiye saati."
          defaultValue=""
          value={stop.scheduledAt}
          onValueChange={(value) => set("scheduledAt", value)}
          error={errorFor("scheduledAt")}
        />
      </div>

      <div className="transport-stop-address">
        <FieldError id={`${idPrefix}-address-error`} message={errorFor("address")} />
        {stop.editingAddress ? (
          <>
            {stop.savedAddress !== null ? (
              <p className="field-hint">
                Kayıtlı adres: {stop.savedAddress}.{" "}
                <button
                  type="button"
                  className="text-link"
                  onClick={() => set("editingAddress", false)}
                >
                  Kayıtlı adresi koru
                </button>
              </p>
            ) : null}
            <CanonicalAddressForm
              name={transportAddressField(stop.key)}
              gateway={addressGateway}
              debounceMs={addressDebounceMs}
              fieldErrors={stopAddressFieldErrors(fieldErrors, shuttleIndex, stopIndex)}
            />
          </>
        ) : (
          <p className="transport-stop-saved-address">
            <span className="muted">Adres: </span>
            {stop.savedAddress ?? "Kayıtlı adres"}{" "}
            <button type="button" className="text-link" onClick={() => set("editingAddress", true)}>
              Adresi değiştir
            </button>
          </p>
        )}
      </div>

      <RemoveControl
        label="Durağı kaldır"
        seatsTaken={stop.seatsTaken}
        what="durakta"
        onConfirm={onRemove}
      />
    </div>
  );
}

/**
 * Kaldırma düğmesi. Koltuk seçilmiş bir servis/durak tek tıkla gitmiyor:
 * kaydedildiğinde koltuklar düşer ve işçilere `SEAT_DROPPED` bildirimi gider,
 * o yüzden önce uyarı ve ikinci bir onay.
 */
function RemoveControl({
  label,
  seatsTaken,
  what,
  onConfirm,
}: {
  label: string;
  seatsTaken: number;
  what: "serviste" | "durakta";
  onConfirm: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  if (seatsTaken <= 0) {
    return (
      <button type="button" className="button button-danger button-small" onClick={onConfirm}>
        {label}
      </button>
    );
  }
  if (!confirming) {
    return (
      <button
        type="button"
        className="button button-danger button-small"
        onClick={() => setConfirming(true)}
      >
        {label}
      </button>
    );
  }
  return (
    <div className="transport-remove-confirm" role="alert">
      <p className="form-warning">
        Bu {what} {seatsTaken} koltuk seçilmiş. Kaldırıp kaydedersen seçimler düşer ve
        çalışanlara bildirim gider.
      </p>
      <div className="transport-remove-actions">
        <button type="button" className="button button-danger button-small" onClick={onConfirm}>
          Yine de kaldır
        </button>
        <button
          type="button"
          className="button button-secondary button-small"
          onClick={() => setConfirming(false)}
        >
          Vazgeç
        </button>
      </div>
    </div>
  );
}
