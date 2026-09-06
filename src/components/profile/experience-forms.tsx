"use client";

import { useActionState } from "react";

import {
  createExperienceAction,
  deleteExperienceAction,
  updateExperienceAction,
} from "@/app/(uygulama)/panel/profil/experience-actions";
import {
  DoneNotice,
  FormAlert,
  InputField,
  SelectField,
  SubmitButton,
  TextareaField,
  TextField,
} from "@/components/form-controls";
import { ProfileDeleteForm } from "@/components/profile/delete-form";
import { fieldError, idleFormState, type FormAction } from "@/lib/form-state";
import { employmentTypeOptions, type Experience } from "@/lib/profile";

export function ExperienceCreator() {
  return (
    <details className="profile-editor">
      <summary>Yeni deneyim ekle</summary>
      <ExperienceForm action={createExperienceAction} submitLabel="Deneyimi ekle" />
    </details>
  );
}

export function ExperienceEditor({ experience }: { experience: Experience }) {
  const updateAction = updateExperienceAction.bind(null, experience.id);
  const deleteAction = deleteExperienceAction.bind(null, experience.id);

  return (
    <details className="profile-editor">
      <summary>Deneyimi düzenle</summary>
      <ExperienceForm
        experience={experience}
        action={updateAction}
        submitLabel="Değişiklikleri kaydet"
      />
      <ProfileDeleteForm action={deleteAction} label="Deneyimi sil" />
    </details>
  );
}

function ExperienceForm({
  experience,
  action,
  submitLabel,
}: {
  experience?: Experience;
  action: FormAction;
  submitLabel: string;
}) {
  const [state, submit] = useActionState(action, idleFormState);
  const fieldIdPrefix = `experience-${experience?.id ?? "new"}`;

  if (state.status === "done") {
    return <DoneNotice title="Deneyim kaydedildi">Özgeçmişin güncellendi.</DoneNotice>;
  }

  return (
    <form className="form profile-form" action={submit}>
      <FormAlert state={state} />
      <TextField
        id={`${fieldIdPrefix}-title`}
        name="title"
        label="Pozisyon"
        maxLength={255}
        defaultValue={experience?.title ?? ""}
        error={fieldError(state, "title")}
      />
      <div className="profile-form-grid">
        <TextField
          id={`${fieldIdPrefix}-companyName`}
          name="companyName"
          label="İşveren veya şirket"
          required={false}
          maxLength={255}
          defaultValue={experience?.companyName ?? ""}
          error={fieldError(state, "companyName")}
        />
        <TextField
          id={`${fieldIdPrefix}-cityName`}
          name="cityName"
          label="Şehir"
          required={false}
          maxLength={255}
          defaultValue={experience?.cityName ?? ""}
          error={fieldError(state, "cityName")}
        />
      </div>
      <SelectField
        id={`${fieldIdPrefix}-employmentType`}
        name="employmentType"
        label="Çalışma türü"
        defaultValue={experience?.employmentType ?? ""}
        required={false}
        error={fieldError(state, "employmentType")}
        options={employmentTypeOptions}
        placeholder="Belirtilmedi"
      />
      <div className="profile-form-grid">
        <InputField
          id={`${fieldIdPrefix}-startDate`}
          name="startDate"
          label="Başlangıç tarihi"
          type="date"
          defaultValue={experience?.startDate ?? ""}
          error={fieldError(state, "startDate")}
        />
        <InputField
          id={`${fieldIdPrefix}-endDate`}
          name="endDate"
          label="Bitiş tarihi"
          type="date"
          required={false}
          defaultValue={experience?.endDate ?? ""}
          hint="Devam ediyorsa boş bırak."
          error={fieldError(state, "endDate")}
        />
      </div>
      <TextareaField
        id={`${fieldIdPrefix}-description`}
        name="description"
        label="Açıklama"
        defaultValue={experience?.description ?? ""}
        maxLength={2000}
        rows={4}
        error={fieldError(state, "description")}
      />
      <SubmitButton label={submitLabel} pendingLabel="Kaydediliyor…" />
    </form>
  );
}
