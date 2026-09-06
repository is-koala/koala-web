"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { ErrorState } from "@/components/states";
import { idleFormState, type FormState } from "@/lib/form-state";

export type LoginFormProps = {
  /** Girişten sonra dönülecek, sunucuda site içi olduğu doğrulanmış yol. */
  destination: string;
  action: (state: FormState, formData: FormData) => Promise<FormState>;
};

export function LoginForm({ destination, action }: LoginFormProps) {
  const [state, submit] = useActionState(action, idleFormState);

  return (
    <form className="form" action={submit}>
      {state.status === "error" && (
        <ErrorState errorCode={state.errorCode} status={state.httpStatus} />
      )}

      {/* Sorgu parametresiyle aynı ad taşınır; sunucu değeri yeniden doğrular. */}
      <input type="hidden" name="next" value={destination} readOnly />

      <div className="field">
        <label htmlFor="email">E-posta</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          maxLength={254}
        />
      </div>

      <div className="field">
        <label htmlFor="password">Parola</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>

      <SubmitButton />
    </form>
  );
}

/**
 * Bekleme durumu ayrı bir bileşende: `useFormStatus` yalnız gönderen formun
 * içinden okunabiliyor.
 */
function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className="button button-primary" type="submit" disabled={pending}>
      {pending ? "Giriş yapılıyor…" : "Giriş yap"}
    </button>
  );
}
