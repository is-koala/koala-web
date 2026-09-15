"use client";

import { useActionState, useState } from "react";

import { SubmitButton, TextField, TextareaField } from "@/components/form-controls";
import { FormAlert } from "@/components/states";
import {
  companyDraftErrors,
  companyTextLimit,
  editableCompanyFields,
  emptyCompanyDraft,
  type CompanyDraft,
  type EditableCompanyField,
} from "@/lib/company";
import { idleFormState, type FormAction, type FormState } from "@/lib/form-state";
import type { Company } from "@/server/company/company";

/**
 * Şirketin düzenlenebilir bilgileri.
 *
 * Beş alan ve tam olarak beş: `UpdateCompanyRequestDto` başka bir alan
 * taşımıyor ve gövdeye konan altıncı bir alan backend'de sessizce yok
 * sayılırdı — ekran değişmemiş bir değeri değişmiş gibi gösterirdi. Kilitli
 * alanlar formun içinde değil, gerekçeleriyle birlikte sayfanın kendisinde
 * duruyor.
 */
export function CompanyEditForm({ company, action }: { company: Company; action: FormAction }) {
  const [draft, setDraft] = useState<CompanyDraft>(() => ({
    ...emptyCompanyDraft,
    name: company.name,
    email: company.email,
    phoneNumber: company.phoneNumber,
    website: company.website ?? "",
    description: company.description ?? "",
  }));

  /**
   * Gönderimden önceki son kapı; kural sunucu action'ında da okunuyor.
   * Buradaki kopya kullanıcıyı bir ağ turu beklemeden eksiğine götürüyor.
   */
  const submit = async (previous: FormState, formData: FormData): Promise<FormState> => {
    const errors = companyDraftErrors(draft, editableCompanyFields);
    if (Object.keys(errors).length > 0) {
      return { status: "error", errorCode: "VALIDATION_FAILED", httpStatus: 400, fieldErrors: errors };
    }
    return action(previous, formData);
  };

  const [state, formAction] = useActionState(submit, idleFormState);
  const fieldErrors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const errorFor = (field: EditableCompanyField) => fieldErrors[field];
  const set = (field: EditableCompanyField) => (value: string) =>
    setDraft({ ...draft, [field]: value });

  return (
    <form className="form" action={formAction} noValidate aria-label="Şirket bilgileri">
      <FormAlert state={state} />

      <TextField
        name="name"
        label="Şirket adı"
        value={draft.name}
        onValueChange={set("name")}
        maxLength={companyTextLimit}
        error={errorFor("name")}
      />
      <TextField
        name="email"
        label="Şirket e-postası"
        type="email"
        inputMode="email"
        autoComplete="off"
        value={draft.email}
        onValueChange={set("email")}
        maxLength={companyTextLimit}
        error={errorFor("email")}
      />
      <TextField
        name="phoneNumber"
        label="Telefon numarası"
        autoComplete="off"
        value={draft.phoneNumber}
        onValueChange={set("phoneNumber")}
        maxLength={companyTextLimit}
        error={errorFor("phoneNumber")}
      />
      <TextField
        name="website"
        label="Web sitesi (isteğe bağlı)"
        required={false}
        value={draft.website}
        onValueChange={set("website")}
        maxLength={companyTextLimit}
        error={errorFor("website")}
      />
      <TextareaField
        name="description"
        label="Açıklama (isteğe bağlı)"
        defaultValue=""
        value={draft.description}
        onValueChange={set("description")}
        rows={4}
        maxLength={companyTextLimit}
        error={errorFor("description")}
      />

      <SubmitButton label="Değişiklikleri kaydet" pendingLabel="Kaydediliyor…" />
    </form>
  );
}
