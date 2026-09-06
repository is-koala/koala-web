import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import type { SettingsAction } from "@/app/(uygulama)/hesap-actions";
import { FieldError, FormAlert, SubmitButton } from "@/components/form-controls";
import { fieldError } from "@/lib/form-state";

import { initialSettingsActionState } from "./types";

export function ResourceAction({
  action,
  field,
  value,
  label,
  pendingLabel,
  secondary = false,
}: {
  action: SettingsAction;
  field: string;
  value: string;
  label: string;
  pendingLabel: string;
  secondary?: boolean;
}) {
  const [state, submit] = useActionState(action, initialSettingsActionState);
  return (
    <form className="compact-form" action={submit}>
      <FormAlert state={state} />
      <FieldError message={fieldError(state, field)} />
      <input type="hidden" name={field} value={value} readOnly />
      <CompactSubmitButton label={label} pendingLabel={pendingLabel} secondary={secondary} />
      {state.status === "done" ? (
        <span className="sr-only" role="status">
          İşlem tamamlandı.
        </span>
      ) : null}
    </form>
  );
}

export function SimpleAction({
  action,
  label,
  pendingLabel,
}: {
  action: SettingsAction;
  label: string;
  pendingLabel: string;
}) {
  const [state, submit] = useActionState(action, initialSettingsActionState);
  return (
    <form className="compact-form" action={submit}>
      <FormAlert state={state} />
      <SubmitButton label={label} pendingLabel={pendingLabel} />
    </form>
  );
}

function CompactSubmitButton({
  label,
  pendingLabel,
  secondary,
}: {
  label: string;
  pendingLabel: string;
  secondary: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      className={`button button-small ${secondary ? "button-secondary" : "button-primary"}`}
      type="submit"
      disabled={pending}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
