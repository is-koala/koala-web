"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { DoneNotice } from "@/components/form-controls";
import { FormAlert } from "@/components/states";
import { idleFormState, type FormAction } from "@/lib/form-state";

export function ProfileDeleteForm({ action, label }: { action: FormAction; label: string }) {
  const [state, submit] = useActionState(action, idleFormState);

  if (state.status === "done") {
    return <DoneNotice title="Kayıt silindi">Özgeçmişin güncellendi.</DoneNotice>;
  }

  return (
    <form className="delete-form" action={submit}>
      <FormAlert state={state} />
      <DeleteButton label={label} />
    </form>
  );
}

function DeleteButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button className="button button-danger button-small" type="submit" disabled={pending}>
      {pending ? "Siliniyor…" : label}
    </button>
  );
}
