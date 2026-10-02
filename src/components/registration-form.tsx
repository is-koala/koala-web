"use client";

import { useActionState } from "react";

import { DoneNotice, SubmitButton, TextField } from "@/components/form-controls";
import { PublicFormAlert } from "@/components/public-form-alert";
import { registrationContent } from "@/content/account";
import { fieldError, idleFormState, type FormAction } from "@/lib/form-state";

export function RegistrationForm({ action }: { action: FormAction }) {
  const [state, submit] = useActionState(action, idleFormState);

  if (state.status === "done") {
    return (
      <DoneNotice title={registrationContent.sentTitle}>
        {/* Uç kayıtlı adres için de 200 dönüyor; ekran hesabın açıldığını
            iddia edemez. */}
        <p>{registrationContent.sentBody}</p>
      </DoneNotice>
    );
  }

  return (
    <form className="form" action={submit}>
      <PublicFormAlert state={state} />

      <TextField
        name="firstName"
        label="Ad"
        autoComplete="given-name"
        maxLength={100}
        error={fieldError(state, "firstName")}
      />
      <TextField
        name="lastName"
        label="Soyad"
        autoComplete="family-name"
        maxLength={100}
        error={fieldError(state, "lastName")}
      />
      <TextField
        name="email"
        label="E-posta"
        type="email"
        inputMode="email"
        autoComplete="email"
        maxLength={254}
        error={fieldError(state, "email")}
      />

      <fieldset className="field-group">
        <legend>Koala&apos;yı ne için kullanacaksın?</legend>
        <div className="checkbox-field">
          <input id="role-is-arayan" name="role" type="radio" value="is-arayan" defaultChecked />
          <label htmlFor="role-is-arayan">İş arıyorum</label>
        </div>
        <div className="checkbox-field">
          <input id="role-isveren" name="role" type="radio" value="isveren" />
          <label htmlFor="role-isveren">İşveren olarak ilan vereceğim</label>
        </div>
      </fieldset>

      <SubmitButton label="Doğrulama bağlantısı gönder" pendingLabel="Gönderiliyor…" />
    </form>
  );
}
