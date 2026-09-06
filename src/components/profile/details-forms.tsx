"use client";

import { useActionState } from "react";

import {
  updateProfileAction,
  uploadProfilePictureAction,
} from "@/app/(uygulama)/panel/profil/profile-actions";
import {
  DoneNotice,
  FileField,
  FormAlert,
  SubmitButton,
  TextareaField,
  TextField,
} from "@/components/form-controls";
import { fieldError, idleFormState } from "@/lib/form-state";
import type { EditableProfile } from "@/lib/profile";

export function ProfileDetailsForm({ profile }: { profile: EditableProfile }) {
  const [state, submit] = useActionState(updateProfileAction, idleFormState);

  if (state.status === "done") {
    return <DoneNotice title="Profil bilgilerin güncellendi">Değişikliklerin kaydedildi.</DoneNotice>;
  }

  return (
    <form className="form profile-form" action={submit}>
      <FormAlert state={state} />
      {profile.identityVerified ? (
        <>
          <input type="hidden" name="namesLocked" value="true" />
          <div className="locked-fields" role="note">
            <span>Ad soyad</span>
            <strong>{`${profile.firstName ?? ""} ${profile.lastName ?? ""}`.trim()}</strong>
            <small>Kimliğin doğrulandığı için ad ve soyad buradan değiştirilemez.</small>
          </div>
        </>
      ) : (
        <div className="profile-form-grid">
          <TextField
            name="firstName"
            label="Ad"
            autoComplete="given-name"
            maxLength={100}
            defaultValue={profile.firstName ?? ""}
            error={fieldError(state, "firstName")}
          />
          <TextField
            name="lastName"
            label="Soyad"
            autoComplete="family-name"
            maxLength={100}
            defaultValue={profile.lastName ?? ""}
            error={fieldError(state, "lastName")}
          />
        </div>
      )}

      <TextField
        name="jobTitle"
        label="Meslek başlığı"
        required={false}
        maxLength={255}
        defaultValue={profile.jobTitle ?? ""}
        hint="Örneğin: Barista, garson veya fotoğrafçı"
        error={fieldError(state, "jobTitle")}
      />
      <TextareaField
        name="about"
        label="Hakkında"
        defaultValue={profile.about ?? ""}
        rows={4}
        error={fieldError(state, "about")}
      />
      <TextareaField
        name="qualifications"
        label="Yetkinlikler"
        defaultValue={profile.qualifications ?? ""}
        rows={3}
        hint="Bu alan serbest metindir; becerilerini kısa ve aranabilir yaz."
        error={fieldError(state, "qualifications")}
      />
      <TextareaField
        name="interests"
        label="İlgi alanları"
        defaultValue={profile.interests ?? ""}
        rows={3}
        hint="Yapmak istediğin iş türlerini serbest metinle anlat."
        error={fieldError(state, "interests")}
      />
      <SubmitButton label="Profil bilgilerini kaydet" pendingLabel="Kaydediliyor…" />
    </form>
  );
}

export function ProfilePictureForm() {
  const [state, submit] = useActionState(uploadProfilePictureAction, idleFormState);

  if (state.status === "done") {
    return <DoneNotice title="Profil fotoğrafın güncellendi">Yeni fotoğrafın kaydedildi.</DoneNotice>;
  }

  return (
    <form className="form compact-form" action={submit}>
      <FormAlert state={state} />
      <FileField
        id="profile-image"
        name="image"
        label="Yeni fotoğraf"
        accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
        hint="PNG, JPG, JPEG veya WEBP · en fazla 10 MB"
        error={fieldError(state, "image")}
      />
      <SubmitButton label="Fotoğrafı yükle" pendingLabel="Yükleniyor…" />
    </form>
  );
}
