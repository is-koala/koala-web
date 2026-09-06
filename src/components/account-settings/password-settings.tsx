import { useActionState } from "react";

import type { SettingsAction } from "@/app/(uygulama)/hesap-actions";
import { FormAlert, SubmitButton, TextField } from "@/components/form-controls";
import { fieldError } from "@/lib/form-state";
import { minPasswordLength, passwordPattern, passwordRequirement } from "@/lib/password";

import { initialSettingsActionState } from "./types";

export function PasswordSettings({ action }: { action: SettingsAction }) {
  const [state, submit] = useActionState(action, initialSettingsActionState);
  return (
    <section className="settings-card" id="guvenlik" aria-labelledby="guvenlik-baslik">
      <h2 id="guvenlik-baslik">Parola</h2>
      <form className="form settings-form" action={submit}>
        <FormAlert state={state} />
        {state.status === "done" ? (
          <p className="inline-success" role="status">
            Parolan güncellendi.
          </p>
        ) : null}
        <TextField
          name="currentPassword"
          label="Mevcut parola"
          type="password"
          autoComplete="current-password"
          error={fieldError(state, "currentPassword")}
        />
        <TextField
          name="newPassword"
          label="Yeni parola"
          type="password"
          autoComplete="new-password"
          minLength={minPasswordLength}
          pattern={passwordPattern}
          hint={passwordRequirement}
          error={fieldError(state, "newPassword")}
        />
        <TextField
          name="confirmNewPassword"
          label="Yeni parola (tekrar)"
          type="password"
          autoComplete="new-password"
          minLength={minPasswordLength}
          error={fieldError(state, "confirmNewPassword")}
        />
        <SubmitButton label="Parolayı güncelle" pendingLabel="Güncelleniyor…" />
      </form>
    </section>
  );
}
