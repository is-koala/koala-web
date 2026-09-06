"use client";

import { useActionState, useState, useTransition, type ChangeEvent } from "react";
import { useFormStatus } from "react-dom";

import {
  createEducationAction,
  createExperienceAction,
  deleteEducationAction,
  deleteExperienceAction,
  loadDepartmentsAction,
  loadFacultiesAction,
  updateEducationAction,
  updateExperienceAction,
  updateNotificationPreferencesAction,
  updateProfileAction,
  uploadProfilePictureAction,
  type ReferenceActionResult,
} from "@/app/(uygulama)/panel/profil/actions";
import { DoneNotice, FieldError, FormAlert, SubmitButton, TextField } from "@/components/form-controls";
import { ErrorState } from "@/components/states";
import { fieldError, idleFormState, type FormAction } from "@/lib/form-state";
import {
  employmentTypeOptions,
  gradeTypeOptions,
  notificationCategoryLabels,
  notificationChannelLabels,
  type AcademicReference,
  type EditableProfile,
  type Education,
  type Experience,
  type NotificationPreference,
} from "@/lib/profile";

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
      <div className="field">
        <label htmlFor="profile-image">Yeni fotoğraf</label>
        <input
          id="profile-image"
          name="image"
          type="file"
          accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
          required
          aria-invalid={fieldError(state, "image") ? true : undefined}
          aria-describedby={fieldError(state, "image") ? "profile-image-error" : undefined}
        />
        <p className="field-hint">PNG, JPG, JPEG veya WEBP · en fazla 10 MB</p>
        <FieldError id="profile-image-error" message={fieldError(state, "image")} />
      </div>
      <SubmitButton label="Fotoğrafı yükle" pendingLabel="Yükleniyor…" />
    </form>
  );
}

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
      <ExperienceForm experience={experience} action={updateAction} submitLabel="Değişiklikleri kaydet" />
      <DeleteForm action={deleteAction} label="Deneyimi sil" />
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

export function EducationCreator({ universities }: { universities: readonly AcademicReference[] }) {
  return (
    <details className="profile-editor">
      <summary>Yeni eğitim ekle</summary>
      <EducationForm
        universities={universities}
        action={createEducationAction}
        submitLabel="Eğitimi ekle"
      />
    </details>
  );
}

export function EducationEditor({
  education,
  universities,
}: {
  education: Education;
  universities: readonly AcademicReference[];
}) {
  const updateAction = updateEducationAction.bind(null, education.id);
  const deleteAction = deleteEducationAction.bind(null, education.id);

  return (
    <details className="profile-editor">
      <summary>Eğitimi düzenle</summary>
      <EducationForm
        education={education}
        universities={includeCurrent(universities, {
          id: education.universityId,
          name: education.universityName,
        })}
        action={updateAction}
        submitLabel="Değişiklikleri kaydet"
      />
      <DeleteForm action={deleteAction} label="Eğitimi sil" />
    </details>
  );
}

function EducationForm({
  education,
  universities,
  action,
  submitLabel,
}: {
  education?: Education;
  universities: readonly AcademicReference[];
  action: FormAction;
  submitLabel: string;
}) {
  const [state, submit] = useActionState(action, idleFormState);
  const fieldIdPrefix = `education-${education?.id ?? "new"}`;
  const [universityId, setUniversityId] = useState(education?.universityId ?? "");
  const [facultyId, setFacultyId] = useState(education?.facultyId ?? "");
  const [departmentId, setDepartmentId] = useState(education?.departmentId ?? "");
  const [faculties, setFaculties] = useState<readonly AcademicReference[]>(
    education ? [{ id: education.facultyId, name: education.facultyName }] : [],
  );
  const [departments, setDepartments] = useState<readonly AcademicReference[]>(
    education ? [{ id: education.departmentId, name: education.departmentName }] : [],
  );
  const [referenceFailure, setReferenceFailure] = useState<ReferenceActionResult | null>(null);
  const [referencesPending, startReferenceTransition] = useTransition();

  if (state.status === "done") {
    return <DoneNotice title="Eğitim kaydedildi">Özgeçmişin güncellendi.</DoneNotice>;
  }

  const selectUniversity = (event: ChangeEvent<HTMLSelectElement>) => {
    const id = event.currentTarget.value;
    setUniversityId(id);
    setFacultyId("");
    setDepartmentId("");
    setFaculties([]);
    setDepartments([]);
    setReferenceFailure(null);
    if (!id) return;
    startReferenceTransition(async () => {
      const result = await loadFacultiesAction(id);
      setReferenceFailure(result.status === "error" ? result : null);
      if (result.status === "done") setFaculties(result.items);
    });
  };

  const selectFaculty = (event: ChangeEvent<HTMLSelectElement>) => {
    const id = event.currentTarget.value;
    setFacultyId(id);
    setDepartmentId("");
    setDepartments([]);
    setReferenceFailure(null);
    if (!id) return;
    startReferenceTransition(async () => {
      const result = await loadDepartmentsAction(id);
      setReferenceFailure(result.status === "error" ? result : null);
      if (result.status === "done") setDepartments(result.items);
    });
  };

  return (
    <form className="form profile-form" action={submit}>
      <FormAlert state={state} />
      {referenceFailure?.status === "error" ? (
        <ErrorState
          errorCode={referenceFailure.errorCode}
          status={referenceFailure.httpStatus}
        />
      ) : null}
      <SelectField
        id={`${fieldIdPrefix}-universityId`}
        name="universityId"
        label="Üniversite"
        value={universityId}
        onChange={selectUniversity}
        options={universities.map(({ id, name }) => ({ value: id, label: name }))}
        placeholder="Üniversite seç"
        error={fieldError(state, "universityId")}
      />
      <SelectField
        id={`${fieldIdPrefix}-facultyId`}
        name="facultyId"
        label="Fakülte"
        value={facultyId}
        onChange={selectFaculty}
        disabled={!universityId || referencesPending}
        options={faculties.map(({ id, name }) => ({ value: id, label: name }))}
        placeholder={referencesPending ? "Yükleniyor…" : "Fakülte seç"}
        error={fieldError(state, "facultyId")}
      />
      <SelectField
        id={`${fieldIdPrefix}-departmentId`}
        name="departmentId"
        label="Bölüm"
        value={departmentId}
        onChange={(event) => setDepartmentId(event.currentTarget.value)}
        disabled={!facultyId || referencesPending}
        options={departments.map(({ id, name }) => ({ value: id, label: name }))}
        placeholder={referencesPending ? "Yükleniyor…" : "Bölüm seç"}
        error={fieldError(state, "departmentId")}
      />
      <div className="profile-form-grid">
        <SelectField
          id={`${fieldIdPrefix}-type`}
          name="type"
          label="Eğitim durumu"
          defaultValue={education?.type ?? ""}
          options={gradeTypeOptions}
          placeholder="Durum seç"
          error={fieldError(state, "type")}
        />
        <InputField
          id={`${fieldIdPrefix}-gpa`}
          name="gpa"
          label="Not ortalaması"
          type="number"
          min="0"
          max="4"
          step="0.01"
          defaultValue={education ? String(education.gpa) : ""}
          error={fieldError(state, "gpa")}
        />
      </div>
      <div className="profile-form-grid">
        <InputField
          id={`${fieldIdPrefix}-startDate`}
          name="startDate"
          label="Başlangıç tarihi"
          type="date"
          defaultValue={education?.startDate ?? ""}
          error={fieldError(state, "startDate")}
        />
        <InputField
          id={`${fieldIdPrefix}-endDate`}
          name="endDate"
          label="Bitiş tarihi"
          type="date"
          required={false}
          defaultValue={education?.endDate ?? ""}
          hint="Devam ediyorsa boş bırak."
          error={fieldError(state, "endDate")}
        />
      </div>
      <SubmitButton label={submitLabel} pendingLabel="Kaydediliyor…" />
    </form>
  );
}

export function NotificationPreferencesForm({
  preferences,
}: {
  preferences: readonly NotificationPreference[];
}) {
  const [state, submit] = useActionState(updateNotificationPreferencesAction, idleFormState);

  if (state.status === "done") {
    return <DoneNotice title="İletişim tercihlerin güncellendi">Seçimlerin kaydedildi.</DoneNotice>;
  }

  return (
    <form className="form compact-form" action={submit}>
      <FormAlert state={state} />
      <FieldError message={fieldError(state, "preferences")} />
      <div className="preference-list">
        {preferences.map((preference) => {
          const label = `${notificationChannelLabels[preference.channel]} · ${notificationCategoryLabels[preference.category]}`;
          const key = `${preference.category}|${preference.channel}`;
          return (
            <label className="preference-row" key={key}>
              {preference.editable ? (
                <input name="preferences" type="hidden" value={`${key}|false`} />
              ) : null}
              <input
                name={preference.editable ? "preferences" : undefined}
                type="checkbox"
                value={`${key}|true`}
                defaultChecked={preference.enabled}
                disabled={!preference.editable}
              />
              <span>
                <strong>{label}</strong>
                <small>
                  {preference.editable
                    ? "Bu kanalı açıp kapatabilirsin."
                    : "Hesap işlemleri için zorunlu bildirim."}
                </small>
              </span>
            </label>
          );
        })}
      </div>
      {preferences.some(({ editable }) => editable) ? (
        <SubmitButton label="İletişim tercihlerini kaydet" pendingLabel="Kaydediliyor…" />
      ) : null}
    </form>
  );
}

function DeleteForm({ action, label }: { action: FormAction; label: string }) {
  const [state, submit] = useActionState(action, idleFormState);
  if (state.status === "done") return <DoneNotice title="Kayıt silindi">Özgeçmişin güncellendi.</DoneNotice>;
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

function TextareaField({
  id,
  name,
  label,
  defaultValue,
  rows,
  hint,
  error,
  maxLength,
}: {
  id?: string;
  name: string;
  label: string;
  defaultValue: string;
  rows: number;
  hint?: string;
  error?: string;
  maxLength?: number;
}) {
  const fieldId = id ?? name;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  return (
    <div className="field">
      <label htmlFor={fieldId}>{label}</label>
      <textarea
        id={fieldId}
        name={name}
        defaultValue={defaultValue}
        rows={rows}
        maxLength={maxLength}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
      />
      {hint ? <p className="field-hint" id={hintId}>{hint}</p> : null}
      <FieldError id={errorId} message={error} />
    </div>
  );
}

function InputField({
  id,
  name,
  label,
  type,
  defaultValue,
  required = true,
  hint,
  error,
  min,
  max,
  step,
}: {
  id?: string;
  name: string;
  label: string;
  type: "date" | "number";
  defaultValue: string;
  required?: boolean;
  hint?: string;
  error?: string;
  min?: string;
  max?: string;
  step?: string;
}) {
  const fieldId = id ?? name;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  return (
    <div className="field">
      <label htmlFor={fieldId}>{label}</label>
      <input
        id={fieldId}
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        min={min}
        max={max}
        step={step}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
      />
      {hint ? <p className="field-hint" id={hintId}>{hint}</p> : null}
      <FieldError id={errorId} message={error} />
    </div>
  );
}

function SelectField({
  id,
  name,
  label,
  options,
  placeholder,
  defaultValue,
  value,
  onChange,
  required = true,
  disabled = false,
  error,
}: {
  id?: string;
  name: string;
  label: string;
  options: readonly { value: string; label: string }[];
  placeholder: string;
  defaultValue?: string;
  value?: string;
  onChange?: (event: ChangeEvent<HTMLSelectElement>) => void;
  required?: boolean;
  disabled?: boolean;
  error?: string;
}) {
  const fieldId = id ?? name;
  const errorId = error ? `${fieldId}-error` : undefined;
  return (
    <div className="field">
      <label htmlFor={fieldId}>{label}</label>
      <select
        id={fieldId}
        name={name}
        defaultValue={value === undefined ? defaultValue : undefined}
        value={value}
        onChange={onChange}
        required={required}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
      <FieldError id={errorId} message={error} />
    </div>
  );
}

function includeCurrent(
  references: readonly AcademicReference[],
  current: AcademicReference,
): readonly AcademicReference[] {
  return references.some(({ id }) => id === current.id) ? references : [current, ...references];
}
