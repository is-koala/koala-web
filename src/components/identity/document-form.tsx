"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import {
  DoneNotice,
  FileField,
  TextField,
} from "@/components/form-controls";
import { FormAlert } from "@/components/states";
import {
  identityDocumentUploadPath,
  identityPhotoInputAccept,
} from "@/identity/document-upload-policy";
import { identityHandoffHref } from "@/identity/handoff";
import { fieldError, idleFormState, type FormState } from "@/lib/form-state";
import { loginPath } from "@/lib/site";

export function IdentityDocumentForm({
  firstName,
  lastName,
  returnPath,
}: {
  firstName: string;
  lastName: string;
  returnPath?: string | null;
}) {
  const router = useRouter();
  const identityLoginPath = `${loginPath}?next=${encodeURIComponent(
    identityHandoffHref(returnPath),
  )}`;
  const [state, setState] = useState<FormState>(idleFormState);
  const [pending, setPending] = useState(false);

  if (state.status === "done") {
    return (
      <DoneNotice title="Belgelerin incelemeye alındı">
        Dört kimlik fotoğrafın personel kuyruğuna düştü. Onaylanınca hesabın
        doğrulanmış olur; çip okutmana gerek yok.
      </DoneNotice>
    );
  }

  return (
    <form className="form" onSubmit={(event) => void submit(event)}>
      <FormAlert state={state} />
      <div className="profile-form-grid">
        <TextField
          name="firstName"
          label="Ad"
          autoComplete="given-name"
          maxLength={100}
          defaultValue={firstName}
          error={fieldError(state, "firstName")}
        />
        <TextField
          name="lastName"
          label="Soyad"
          autoComplete="family-name"
          maxLength={100}
          defaultValue={lastName}
          error={fieldError(state, "lastName")}
        />
      </div>
      <TextField
        name="birthDate"
        label="Doğum tarihi"
        type="date"
        hint="Kimlik kartındaki doğum tarihi"
        error={fieldError(state, "birthDate")}
      />
      <TextField
        name="identityNumber"
        label="T.C. kimlik numarası"
        inputMode="text"
        autoComplete="off"
        maxLength={11}
        pattern="[1-9][0-9]{9}[02468]"
        error={fieldError(state, "identityNumber")}
      />
      <TextField
        name="tcDocumentNumber"
        label="Kimlik seri numarası"
        autoComplete="off"
        maxLength={32}
        hint="Kartın ön yüzündeki belge numarası"
        error={fieldError(state, "tcDocumentNumber")}
      />
      <FileField
        name="selfie"
        label="Yüz fotoğrafı"
        accept={identityPhotoInputAccept}
        hint="Yüzünün net bir selfie fotoğrafı"
        error={fieldError(state, "selfie")}
      />
      <FileField
        name="front"
        label="Kimlik ön yüzü"
        accept={identityPhotoInputAccept}
        hint="TCKK ön yüzünün net bir fotoğrafı"
        error={fieldError(state, "front")}
      />
      <FileField
        name="back"
        label="Kimlik arka yüzü"
        accept={identityPhotoInputAccept}
        hint="TCKK arka yüzünün net bir fotoğrafı"
        error={fieldError(state, "back")}
      />
      <FileField
        name="together"
        label="Kimlik yüzün altında"
        accept={identityPhotoInputAccept}
        hint="Yüzün ve TCKK'nın aynı karede olduğu fotoğraf"
        error={fieldError(state, "together")}
      />
      {fieldError(state, "photos") ? (
        <p role="alert" className="field-error">{fieldError(state, "photos")}</p>
      ) : null}
      <button className="button button-primary" type="submit" disabled={pending}>
        {pending ? "Gönderiliyor…" : "İncelemeye gönder"}
      </button>
    </form>
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    try {
      const response = await fetch(identityDocumentUploadPath, {
        method: "POST",
        body: new FormData(event.currentTarget),
        credentials: "same-origin",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const nextState = await formStateFrom(response);
      if (
        nextState.status === "error"
        && nextState.errorCode === "AUTHENTICATION_REQUIRED"
        && nextState.httpStatus === 401
      ) {
        router.replace(identityLoginPath);
        return;
      }
      setState(nextState);
    } catch {
      setState(unexpectedState(500));
    } finally {
      setPending(false);
    }
  }
}

async function formStateFrom(response: Response): Promise<FormState> {
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    return unexpectedState(response.status || 500);
  }
  if (isFormState(value)) return value;
  return unexpectedState(response.status || 500);
}

function isFormState(value: unknown): value is FormState {
  if (typeof value !== "object" || value === null) return false;
  const state = value as Partial<FormState>;
  if (state.status === "done") return true;
  if (state.status !== "error") return false;
  return typeof state.errorCode === "string" && typeof state.httpStatus === "number";
}

function unexpectedState(httpStatus: number): FormState {
  return { status: "error", errorCode: "UNEXPECTED", httpStatus };
}
