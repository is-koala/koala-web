"use client";

import { useActionState } from "react";

import { updateNotificationPreferencesAction } from "@/app/(uygulama)/panel/profil/notification-actions";
import {
  DoneNotice,
  FieldError,
  FormAlert,
  SubmitButton,
} from "@/components/form-controls";
import { fieldError, idleFormState } from "@/lib/form-state";
import {
  notificationCategoryLabels,
  notificationChannelLabels,
  type NotificationPreference,
} from "@/lib/profile";

export function NotificationPreferencesForm({
  preferences,
}: {
  preferences: readonly NotificationPreference[];
}) {
  const [state, submit] = useActionState(updateNotificationPreferencesAction, idleFormState);

  if (state.status === "done") {
    return <DoneNotice title="İletişim tercihlerin güncellendi">Seçimlerin kaydedildi.</DoneNotice>;
  }

  return (
    <form className="form compact-form" action={submit}>
      <FormAlert state={state} />
      <FieldError message={fieldError(state, "preferences")} />
      <div className="preference-list">
        {preferences.map((preference) => {
          const label = `${notificationChannelLabels[preference.channel]} · ${notificationCategoryLabels[preference.category]}`;
          const key = `${preference.category}|${preference.channel}`;
          return (
            <label className="preference-row" key={key}>
              {preference.editable ? (
                <input name="preferences" type="hidden" value={`${key}|false`} />
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
                    : "Hesap işlemleri için zorunlu bildirim."}
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
