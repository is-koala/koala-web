"use client";

import { useActionState } from "react";

import { submitIdentityDocumentsAction } from "@/app/(account)/kimlik-dogrula/actions";
import {
  DoneNotice,
  FileField,
  FormAlert,
  SubmitButton,
  TextField,
} from "@/components/form-controls";
import { fieldError, idleFormState } from "@/lib/form-state";

const imageAccept = "image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp";

export function IdentityDocumentForm({
  firstName,
  lastName,
}: {
  firstName: string;
  lastName: string;
}) {
  const [state, submit] = useActionState(submitIdentityDocumentsAction, idleFormState);

  if (state.status === "done") {
    return (
      <DoneNotice title="Belgelerin incelemeye alındı">
        Dört kimlik fotoğrafın personel kuyruğuna düştü. Onaylanınca hesabın
        doğrulanmış olur; çip okutmana gerek yok.
      </DoneNotice>
    );
  }

  return (
    <form className="form" action={submit}>
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
        accept={imageAccept}
        hint="Yüzünün net bir selfie fotoğrafı"
        error={fieldError(state, "selfie")}
      />
      <FileField
        name="front"
        label="Kimlik ön yüzü"
        accept={imageAccept}
        hint="TCKK ön yüzünün net bir fotoğrafı"
        error={fieldError(state, "front")}
      />
      <FileField
        name="back"
        label="Kimlik arka yüzü"
        accept={imageAccept}
        hint="TCKK arka yüzünün net bir fotoğrafı"
        error={fieldError(state, "back")}
      />
      <FileField
        name="together"
        label="Kimlik yüzün altında"
        accept={imageAccept}
        hint="Yüzün ve TCKK'nın aynı karede olduğu fotoğraf"
        error={fieldError(state, "together")}
      />
      <SubmitButton label="İncelemeye gönder" pendingLabel="Gönderiliyor…" />
    </form>
  );
}
