"use client";

import { useActionState } from "react";

import { DoneNotice, FormAlert, SubmitButton, TextField } from "@/components/form-controls";
import { forgotPasswordContent } from "@/content/account";
import { fieldError, idleFormState, type FormAction } from "@/lib/form-state";

export function ForgotPasswordForm({ action }: { action: FormAction }) {
  const [state, submit] = useActionState(action, idleFormState);

  if (state.status === "done") {
    return (
      <DoneNotice title={forgotPasswordContent.sentTitle}>
        {/* Adres kayıtlı olmasa da aynı metin: kayıtlı adresleri ele vermez. */}
        <p>{forgotPasswordContent.sentBody}</p>
      </DoneNotice>
    );
  }

  return (
    <form className="form" action={submit}>
      <FormAlert state={state} />
      <TextField
        name="email"
        label="E-posta"
        type="email"
        inputMode="email"
        autoComplete="email"
        maxLength={254}
        error={fieldError(state, "email")}
      />
      <SubmitButton label="Bağlantı gönder" pendingLabel="Gönderiliyor…" />
    </form>
  );
}
