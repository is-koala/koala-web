"use client";

import Link from "next/link";
import { useActionState } from "react";

import { FormAlert, SubmitButton, TextareaField } from "@/components/form-controls";
import { applicationRemedy } from "@/jobs/application";
import { fieldError, idleFormState, type FormAction } from "@/lib/form-state";

export function JobApplicationForm({
  action,
  returnPath,
}: {
  action: FormAction;
  returnPath?: string;
}) {
  const [state, submit] = useActionState(action, idleFormState);
  const remedy = state.status === "error" ? applicationRemedy(state.errorCode, returnPath) : null;

  return (
    <form className="form job-application-form" action={submit}>
      <FormAlert state={state} />
      {remedy ? (
        <Link className="text-link application-remedy" href={remedy.href}>
          {remedy.label}
        </Link>
      ) : null}
      <TextareaField
        name="notes"
        label="Başvuru notu (isteğe bağlı)"
        defaultValue=""
        rows={6}
        maxLength={2000}
        error={fieldError(state, "notes")}
        hint="Deneyimini veya bu iş için neden uygun olduğunu kısaca paylaşabilirsin."
      />
      <SubmitButton label="Başvuruyu gönder" pendingLabel="Başvuru gönderiliyor…" />
    </form>
  );
}
