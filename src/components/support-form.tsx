"use client";

import Link from "next/link";
import { useActionState } from "react";

import {
  CheckboxField,
  DoneNotice,
  SelectField,
  SubmitButton,
  TextareaField,
  TextField,
} from "@/components/form-controls";
import { PublicFormAlert } from "@/components/public-states";
import { controllerIdentity, supportContent } from "@/content/support";
import { fieldError, idleFormState, type FormAction } from "@/lib/form-state";

export function SupportForm({ action }: { action: FormAction }) {
  const [state, submit] = useActionState(action, idleFormState);

  if (state.status === "done") {
    return (
      <DoneNotice title={supportContent.sentTitle}>
        <p>{supportContent.sentBody}</p>
      </DoneNotice>
    );
  }

  return (
    <form className="form" action={submit}>
      <PublicFormAlert state={state} />

      <div className="honeypot-field" aria-hidden="true">
        <label htmlFor="website">Web sitesi</label>
        <input
          id="website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <SelectField
        name="topic"
        label="Konu"
        placeholder="Konu seç"
        options={supportContent.topics}
        error={fieldError(state, "topic")}
      />
      <TextField
        name="name"
        label="Ad"
        autoComplete="name"
        maxLength={100}
        error={fieldError(state, "name")}
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
      <TextareaField
        name="message"
        label="Mesaj"
        defaultValue=""
        rows={6}
        maxLength={4000}
        error={fieldError(state, "message")}
      />
      <CheckboxField
        name="consent"
        value="granted"
        required
        error={fieldError(state, "consent")}
      >
        <Link className="text-link" href={controllerIdentity.kvkkNoticePath}>
          KVKK Aydınlatma Metni
        </Link>
        {"'ni okudum ve kişisel verilerimin bu başvuru için işlenmesini kabul ediyorum."}
      </CheckboxField>
      <SubmitButton label="Gönder" pendingLabel="Gönderiliyor…" />
    </form>
  );
}
