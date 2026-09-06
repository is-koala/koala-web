"use client";

import Link from "next/link";
import { useActionState } from "react";

import {
  CheckboxField,
  FieldError,
  FormAlert,
  SubmitButton,
  TextField,
} from "@/components/form-controls";
import { setPasswordContent } from "@/content/account";
import { agreementLink, agreementTitle, type Agreement } from "@/lib/consents";
import { fieldError, idleFormState, type FormAction } from "@/lib/form-state";
import { minPasswordLength, passwordPattern, passwordRequirement } from "@/lib/password";

export function SetPasswordForm({
  setPasswordToken,
  agreements,
  action,
}: {
  setPasswordToken: string;
  agreements: readonly Agreement[];
  action: FormAction;
}) {
  const [state, submit] = useActionState(action, idleFormState);

  return (
    <form className="form" action={submit}>
      <FormAlert state={state} />

      <input type="hidden" name="setPasswordToken" value={setPasswordToken} readOnly />

      <TextField
        name="password"
        label="Parola"
        type="password"
        autoComplete="new-password"
        minLength={minPasswordLength}
        pattern={passwordPattern}
        hint={passwordRequirement}
        error={fieldError(state, "password")}
      />
      <TextField
        name="passwordConfirmation"
        label="Parola (tekrar)"
        type="password"
        autoComplete="new-password"
        minLength={minPasswordLength}
        error={fieldError(state, "passwordConfirmation")}
      />

      {agreements.length > 0 && (
        <fieldset className="field-group">
          <legend>{setPasswordContent.consentsTitle}</legend>
          {agreements.map((agreement) => (
            <CheckboxField
              key={agreement.id}
              name="consents"
              value={agreement.id}
              required={agreement.mandatory}
            >
              <AgreementLabel agreement={agreement} />
            </CheckboxField>
          ))}
          <FieldError message={fieldError(state, "consents")} />
        </fieldset>
      )}

      <SubmitButton label="Kaydı tamamla" pendingLabel="Tamamlanıyor…" />
    </form>
  );
}

/** Zorunlu olmayan sözleşme reddedilebilir; kutu işaretlenmese de karar gider. */
function AgreementLabel({ agreement }: { agreement: Agreement }) {
  const href = agreementLink(agreement);
  const title = agreementTitle(agreement);
  const suffix = agreement.mandatory ? "'nı okudum, onaylıyorum." : "'nı kabul ediyorum.";

  return (
    <>
      {href ? (
        <Link className="text-link" href={href}>{title}</Link>
      ) : (
        title
      )}
      {suffix}
      {!agreement.mandatory && <span className="muted"> (isteğe bağlı)</span>}
    </>
  );
}
