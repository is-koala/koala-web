"use client";

import { useActionState } from "react";

import { FormAlert, SubmitButton, TextField } from "@/components/form-controls";
import { idleFormState, type FormAction } from "@/lib/form-state";

export type LoginFormProps = {
  /** Girişten sonra dönülecek, sunucuda site içi olduğu doğrulanmış yol. */
  destination: string;
  action: FormAction;
};

export function LoginForm({ destination, action }: LoginFormProps) {
  const [state, submit] = useActionState(action, idleFormState);

  return (
    <form className="form" action={submit}>
      <FormAlert state={state} />

      {/* Sorgu parametresiyle aynı ad taşınır; sunucu değeri yeniden doğrular. */}
      <input type="hidden" name="next" value={destination} readOnly />

      <TextField
        name="email"
        label="E-posta"
        type="email"
        inputMode="email"
        autoComplete="email"
        maxLength={254}
      />
      <TextField name="password" label="Parola" type="password" autoComplete="current-password" />

      <SubmitButton label="Giriş yap" pendingLabel="Giriş yapılıyor…" />
    </form>
  );
}
