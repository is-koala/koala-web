"use client";

import { useActionState, useRef, useState, useTransition, type ChangeEvent } from "react";

import {
  createEducationAction,
  deleteEducationAction,
  loadDepartmentsAction,
  loadFacultiesAction,
  updateEducationAction,
  type ReferenceActionResult,
} from "@/app/(uygulama)/panel/profil/education-actions";
import {
  DoneNotice,
  InputField,
  SelectField,
  SubmitButton,
} from "@/components/form-controls";
import { ProfileDeleteForm } from "@/components/profile/delete-form";
import { ErrorState, FormAlert } from "@/components/states";
import { fieldError, idleFormState, type FormAction } from "@/lib/form-state";
import {
  gradeTypeOptions,
  type AcademicReference,
  type Education,
} from "@/lib/profile";

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
      <ProfileDeleteForm action={deleteAction} label="Eğitimi sil" />
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
  const [facultiesPending, startFacultyTransition] = useTransition();
  const [departmentsPending, startDepartmentTransition] = useTransition();
  const selectedUniversity = useRef(universityId);
  const selectedFaculty = useRef(facultyId);
  const facultyRequestGeneration = useRef(0);
  const departmentRequestGeneration = useRef(0);

  if (state.status === "done") {
    return <DoneNotice title="Eğitim kaydedildi">Özgeçmişin güncellendi.</DoneNotice>;
  }

  const selectUniversity = (event: ChangeEvent<HTMLSelectElement>) => {
    const id = event.currentTarget.value;
    const generation = ++facultyRequestGeneration.current;
    ++departmentRequestGeneration.current;
    selectedUniversity.current = id;
    selectedFaculty.current = "";
    setUniversityId(id);
    setFacultyId("");
    setDepartmentId("");
    setFaculties([]);
    setDepartments([]);
    setReferenceFailure(null);
    if (!id) return;

    startFacultyTransition(async () => {
      const result = await loadFacultiesAction(id);
      if (
        generation !== facultyRequestGeneration.current ||
        id !== selectedUniversity.current
      ) return;
      setReferenceFailure(result.status === "error" ? result : null);
      if (result.status === "done") setFaculties(result.items);
    });
  };

  const selectFaculty = (event: ChangeEvent<HTMLSelectElement>) => {
    const id = event.currentTarget.value;
    const generation = ++departmentRequestGeneration.current;
    selectedFaculty.current = id;
    setFacultyId(id);
    setDepartmentId("");
    setDepartments([]);
    setReferenceFailure(null);
    if (!id) return;

    startDepartmentTransition(async () => {
      const result = await loadDepartmentsAction(id);
      if (
        generation !== departmentRequestGeneration.current ||
        id !== selectedFaculty.current
      ) return;
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
        disabled={!universityId || facultiesPending}
        options={faculties.map(({ id, name }) => ({ value: id, label: name }))}
        placeholder={facultiesPending ? "Yükleniyor…" : "Fakülte seç"}
        error={fieldError(state, "facultyId")}
      />
      <SelectField
        id={`${fieldIdPrefix}-departmentId`}
        name="departmentId"
        label="Bölüm"
        value={departmentId}
        onChange={(event) => setDepartmentId(event.currentTarget.value)}
        disabled={!facultyId || departmentsPending}
        options={departments.map(({ id, name }) => ({ value: id, label: name }))}
        placeholder={departmentsPending ? "Yükleniyor…" : "Bölüm seç"}
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

function includeCurrent(
  references: readonly AcademicReference[],
  current: AcademicReference,
): readonly AcademicReference[] {
  return references.some(({ id }) => id === current.id) ? references : [current, ...references];
}
