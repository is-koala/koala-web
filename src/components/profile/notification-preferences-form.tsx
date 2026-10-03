"use client";

import Link from "next/link";
import { useActionState } from "react";

import { updateNotificationPreferencesAction } from "@/app/(uygulama)/panel/profil/notification-actions";
import {
  DoneNotice,
  FieldError,
  SubmitButton,
} from "@/components/form-controls";
import { FormAlert } from "@/components/states";
import { fieldError, idleFormState } from "@/lib/form-state";
import {
  notificationCategoryLabels,
  notificationChannelLabels,
  type NotificationPreference,
} from "@/lib/profile";

/** Ticari izin doğrulanmamış alıcıyla reddedildi; çözüm iletişim doğrulaması. */
const unverifiedRecipient = "IYS_VERIFIED_RECIPIENT_REQUIRED";

export function NotificationPreferencesForm({
  preferences,
  contactHref,
}: {
  preferences: readonly NotificationPreference[];
  /**
   * Telefon/e-posta doğrulamasının yapıldığı yer. Hesap sayfasında aynı
   * sayfadaki `#iletisim` bölümü, profil sayfasında hesap sayfasının kendisi.
   */
  contactHref: string;
}) {
  const [state, submit] = useActionState(updateNotificationPreferencesAction, idleFormState);

  if (state.status === "done") {
    return state.unchanged ? (
      <DoneNotice title="Değişiklik yok">
        Tercihlerin zaten bu hâliyle kayıtlı; gönderilecek bir değişiklik olmadığı için hiçbir şey
        yazılmadı.
      </DoneNotice>
    ) : (
      <DoneNotice title="İletişim tercihlerin güncellendi">Seçimlerin kaydedildi.</DoneNotice>
    );
  }

  return (
    <form className="form compact-form" action={submit}>
      <FormAlert state={state} />
      {state.status === "error" && state.errorCode === unverifiedRecipient ? (
        <Link className="text-link" href={contactHref}>
          Telefonunu ve e-postanı doğrula
        </Link>
      ) : null}
      <FieldError message={fieldError(state, "preferences")} />
      <div className="preference-list">
        {preferences.map((preference) => {
          const label = `${notificationChannelLabels[preference.channel]} · ${notificationCategoryLabels[preference.category]}`;
          const key = `${preference.category}|${preference.channel}`;
          return (
            <label className="preference-row" key={key}>
              {preference.editable ? (
                <>
                  {/* Yüklenen değer: action yalnız bundan farklı satırları gönderir. */}
                  <input name="initialPreferences" type="hidden" value={`${key}|${preference.enabled}`} />
                  <input name="preferences" type="hidden" value={`${key}|false`} />
                </>
              ) : null}
              <input
                name={preference.editable ? "preferences" : undefined}
                type="checkbox"
                value={`${key}|true`}
                defaultChecked={preference.enabled}
                disabled={!preference.editable}
              />
              <span>
                <strong>{label}</strong>
                <small>
                  {preference.editable
                    ? "Bu kanalı açıp kapatabilirsin."
                    : "Bu bildirim kapatılamaz: işlem bildirimi."}
                </small>
              </span>
            </label>
          );
        })}
      </div>
      {preferences.some(({ editable }) => editable) ? (
        <SubmitButton label="İletişim tercihlerini kaydet" pendingLabel="Kaydediliyor…" />
      ) : null}
    </form>
  );
}
