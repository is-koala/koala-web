"use client";

import Link from "next/link";
import { useActionState } from "react";

import { DoneNotice, SubmitButton, TextField } from "@/components/form-controls";
import { PublicFormAlert } from "@/components/public-states";
import { resetPasswordContent } from "@/content/account";
import { fieldError, idleFormState, type FormAction } from "@/lib/form-state";
import { minPasswordLength, passwordPattern, passwordRequirement } from "@/lib/password";

export function ResetPasswordForm({
  resetToken,
  action,
}: {
  resetToken: string;
  action: FormAction;
}) {
  const [state, submit] = useActionState(action, idleFormState);

  if (state.status === "done") {
    return (
      <DoneNotice title={resetPasswordContent.doneTitle}>
        <p>{resetPasswordContent.doneBody}</p>
        <Link className="button button-primary" href="/giris">Giriş yap</Link>
      </DoneNotice>
    );
  }

  return (
    <form className="form" action={submit}>
      <PublicFormAlert state={state} />

      {/* Uyarı gönderimden önce görünür: sıfırlama bütün oturumları kapatıyor. */}
      <p className="form-warning" role="note">{resetPasswordContent.sessionWarning}</p>

      <input type="hidden" name="resetToken" value={resetToken} readOnly />

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
        name="newPasswordConfirmation"
        label="Yeni parola (tekrar)"
        type="password"
        autoComplete="new-password"
        minLength={minPasswordLength}
        error={fieldError(state, "newPasswordConfirmation")}
      />

      <SubmitButton label="Parolamı güncelle" pendingLabel="Güncelleniyor…" />
    </form>
  );
}
