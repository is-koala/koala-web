"use client";

import { useActionState, useId, useState } from "react";

import {
  deleteAvailabilityExceptionAction,
  saveAvailabilityAction,
  saveAvailabilityExceptionAction,
} from "@/app/(uygulama)/panel/profil/availability-actions";
import {
  DoneNotice,
  FieldError,
  InputField,
  SubmitButton,
  TextField,
} from "@/components/form-controls";
import { FormAlert } from "@/components/states";
import { ProfileDeleteForm } from "@/components/profile/delete-form";
import {
  dayOfWeekLabels,
  dayOfWeekValues,
  maximumExceptionNoteLength,
  maximumSlots,
  slotFieldNames,
  sortSlots,
  toClockTime,
  type AvailabilityException,
  type AvailabilitySlot,
  type DayOfWeek,
  type SlotWrite,
} from "@/lib/availability";
import { formatDate } from "@/lib/dates";
import { fieldError, idleFormState } from "@/lib/form-state";

type EditableSlot = SlotWrite & { key: number };

/**
 * Haftalık aralık düzenleyicisi.
 *
 * Tek form, toptan kayıt: `PUT /users/me/availability` gönderilen listeyi
 * haftanın tamamı sayıyor, yani satırları ayrı ayrı kaydetmek her kayıtta
 * öbür satırları silerdi. Satır ekleme/çıkarma istemci durumu; gönderim
 * `FormData.getAll` ile sırayla okunuyor.
 */
export function AvailabilityEditor({
  slots,
  unreadableSlotCount = 0,
}: {
  slots: readonly AvailabilitySlot[];
  unreadableSlotCount?: number;
}) {
  const [state, submit] = useActionState(saveAvailabilityAction, idleFormState);
  const [rows, setRows] = useState<EditableSlot[]>(() =>
    sortSlots(slots).map((slot, index) => ({
      key: index,
      dayOfWeek: slot.dayOfWeek,
      startTime: toClockTime(slot.startTime),
      endTime: toClockTime(slot.endTime),
    })),
  );
  const [nextKey, setNextKey] = useState(slots.length);
  const idPrefix = useId();

  if (state.status === "done") {
    return <DoneNotice title="Müsaitliğin kaydedildi">Haftalık aralıkların güncellendi.</DoneNotice>;
  }

  const addRow = () => {
    setRows((current) => [
      ...current,
      { key: nextKey, dayOfWeek: "MONDAY", startTime: "09:00", endTime: "17:00" },
    ]);
    setNextKey((key) => key + 1);
  };

  const updateRow = (key: number, patch: Partial<SlotWrite>) => {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  const removeRow = (key: number) => {
    setRows((current) => current.filter((row) => row.key !== key));
  };

  const slotsError = fieldError(state, "slots");
  const slotsErrorId = `${idPrefix}-slots-error`;
  /**
   * Okunamayan aralık varsa düzenleyici kilitli: kaydetmek haftanın tamamını
   * yazıyor ve gövdeye giremeyen satırlar kalıcı silinirdi. Kullanıcı
   * gördüğü satırları okuyabilir; değişiklik mobil uygulamadan yapılır.
   */
  const locked = unreadableSlotCount > 0;
  const quotaFull = rows.length >= maximumSlots;

  return (
    <form className="form availability-form" action={submit}>
      <FormAlert state={state} />
      {locked ? (
        <p className="settings-empty availability-locked" role="status">
          Bu cihazdan düzenlenemeyen {unreadableSlotCount} aralık var; kaydetmek onları silerdi.
          Müsaitliğini şimdilik mobil uygulamadan güncelle.
        </p>
      ) : null}
      {rows.length === 0 ? (
        <p className="settings-empty" role="status">
          Henüz haftalık aralık yok. İşverenler seni her gün müsait sayar; aralık ekleyerek daraltabilirsin.
        </p>
      ) : (
        <ul
          className="availability-rows"
          aria-label="Haftalık müsaitlik aralıkları"
          aria-describedby={slotsError ? slotsErrorId : undefined}
        >
          {rows.map((row, index) => {
            const rowId = `${idPrefix}-row-${row.key}`;
            return (
              <li key={row.key} className="availability-row">
                <div className="field">
                  <label htmlFor={`${rowId}-day`}>Gün</label>
                  <select
                    id={`${rowId}-day`}
                    name={slotFieldNames.dayOfWeek}
                    value={row.dayOfWeek}
                    disabled={locked}
                    onChange={(event) => updateRow(row.key, { dayOfWeek: event.target.value as DayOfWeek })}
                  >
                    {dayOfWeekValues.map((day) => (
                      <option key={day} value={day}>{dayOfWeekLabels[day]}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor={`${rowId}-start`}>Başlangıç</label>
                  <input
                    id={`${rowId}-start`}
                    type="time"
                    name={slotFieldNames.startTime}
                    value={row.startTime}
                    required
                    disabled={locked}
                    onChange={(event) => updateRow(row.key, { startTime: event.target.value })}
                  />
                </div>
                <div className="field">
                  <label htmlFor={`${rowId}-end`}>Bitiş</label>
                  <input
                    id={`${rowId}-end`}
                    type="time"
                    name={slotFieldNames.endTime}
                    value={row.endTime}
                    required
                    disabled={locked}
                    onChange={(event) => updateRow(row.key, { endTime: event.target.value })}
                  />
                </div>
                {locked ? null : (
                  <button
                    type="button"
                    className="button button-secondary button-small"
                    onClick={() => removeRow(row.key)}
                    aria-label={`${index + 1}. aralığı kaldır`}
                  >
                    Kaldır
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <FieldError id={slotsErrorId} message={slotsError} />
      {locked ? null : (
        <div className="button-row">
          {/*
            Tavan bir ürün sınırı (`SaveAvailabilityDto` `@Size(max = 50)`),
            beklemekle açılmaz: gerekçesi yanında ve `permanent` işaretiyle
            (`AGENTS.md`, "Ekran durumları").
          */}
          {quotaFull ? (
            <p className="payment-disabled-reason">
              <button
                type="button"
                className="button button-secondary button-small"
                disabled
                data-disabled-kind="permanent"
              >
                Aralık ekle
              </button>
              <span>{`En fazla ${maximumSlots} aralık kaydedilebilir; yeni aralık için birini kaldır.`}</span>
            </p>
          ) : (
            <button type="button" className="button button-secondary button-small" onClick={addRow}>
              Aralık ekle
            </button>
          )}
          <SubmitButton label="Müsaitliği kaydet" pendingLabel="Kaydediliyor…" />
        </div>
      )}
    </form>
  );
}

/**
 * Tarih istisnaları: belirli bir günde haftalık düzenden sapma.
 *
 * `PUT` aynı tarihe ikinci kez yazıldığında öncekinin üzerine geçiyor; liste
 * bu yüzden kayıt kimliğiyle değil tarihle okunuyor.
 */
export function AvailabilityExceptions({
  exceptions,
}: {
  exceptions: readonly AvailabilityException[];
}) {
  const sorted = [...exceptions].sort((left, right) => left.date.localeCompare(right.date));

  return (
    <div className="availability-exceptions">
      {sorted.length === 0 ? (
        <p className="settings-empty" role="status">Henüz tarih istisnan yok.</p>
      ) : (
        <ul className="profile-record-list" aria-label="Tarih istisnaları">
          {sorted.map((exception) => (
            <li key={exception.id} className="profile-record availability-exception">
              <div>
                <h3>{formatDate(exception.date)}</h3>
                <p>
                  <span className={exception.available ? "verification verified" : "verification"}>
                    {exception.available ? "Müsaitim" : "Müsait değilim"}
                  </span>
                </p>
                {exception.note ? <small>{exception.note}</small> : null}
              </div>
              <ProfileDeleteForm
                action={deleteAvailabilityExceptionAction.bind(null, exception.id)}
                label="İstisnayı sil"
              />
            </li>
          ))}
        </ul>
      )}
      <details className="profile-editor">
        <summary>Tarih istisnası ekle</summary>
        <AvailabilityExceptionForm />
      </details>
    </div>
  );
}

function AvailabilityExceptionForm() {
  const [state, submit] = useActionState(saveAvailabilityExceptionAction, idleFormState);
  const idPrefix = useId();

  if (state.status === "done") {
    return <DoneNotice title="İstisna kaydedildi">O gün için müsaitliğin güncellendi.</DoneNotice>;
  }

  const availableError = fieldError(state, "available");

  return (
    <form className="form profile-form" action={submit}>
      <FormAlert state={state} />
      <InputField
        id={`${idPrefix}-date`}
        name="date"
        label="Tarih"
        type="date"
        defaultValue=""
        error={fieldError(state, "date")}
      />
      <fieldset
        className="field-group"
        aria-describedby={availableError ? `${idPrefix}-available-error` : undefined}
      >
        <legend>O gün</legend>
        <div className="checkbox-field">
          <input id={`${idPrefix}-unavailable`} type="radio" name="available" value="false" defaultChecked required />
          <label htmlFor={`${idPrefix}-unavailable`}>Müsait değilim</label>
        </div>
        <div className="checkbox-field">
          <input id={`${idPrefix}-available`} type="radio" name="available" value="true" />
          <label htmlFor={`${idPrefix}-available`}>Müsaitim</label>
        </div>
        <FieldError id={`${idPrefix}-available-error`} message={availableError} />
      </fieldset>
      <TextField
        id={`${idPrefix}-note`}
        name="note"
        label="Not"
        required={false}
        maxLength={maximumExceptionNoteLength}
        hint="İsteğe bağlı; yalnız sen görürsün."
        error={fieldError(state, "note")}
      />
      <SubmitButton label="İstisnayı kaydet" pendingLabel="Kaydediliyor…" />
    </form>
  );
}
