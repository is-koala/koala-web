"use client";

import { useActionState, useState, type ReactNode } from "react";

import { serviceAreaNotice } from "@/address/contract";
import type { AddressGateway } from "@/address/gateway-client";
import { CanonicalAddressForm } from "@/components/canonical-address-form";
import {
  FileField,
  SelectField,
  SubmitButton,
  TextField,
  TextareaField,
} from "@/components/form-controls";
import { FormAlert } from "@/components/states";
import {
  companyDraftErrors,
  companyTextLimit,
  companyTypes,
  createCompanyFields,
  emptyCompanyDraft,
  type CompanyDraft,
  type CompanyField,
} from "@/lib/company";
import { idleFormState, type FormAction, type FormState } from "@/lib/form-state";

import { logoAccept, logoHint } from "./logo";

/**
 * Şirket oluşturma formu.
 *
 * Dört adım tek bir `<form>` içinde: adımlar arası geçişte alanlar DOM'da
 * kalıyor, çünkü gönderim tek bir `FormData` ile gidiyor ve gizlenen bir
 * adımın alanı gövdeden düşerse kullanıcı doldurduğu bir bilgiyi sessizce
 * kaybederdi.
 *
 * Taslak `localStorage`'a **yazılmıyor** — bireysel ilan formundan ayrıldığı
 * yer burası. Formda vergi numarası ve şirket e-postası gibi kurumsal
 * bilgiler var ve ortak bir tarayıcıda kalıcı bir kopya bırakmak, ilanın
 * kamuya açık metnini saklamakla aynı şey değil.
 */

export type CompanyFormProps = {
  action: FormAction;
  /** Adres bileşeninin ağ geçidi; testler kendi taklidini geçiriyor. */
  addressGateway?: AddressGateway;
  addressDebounceMs?: number;
};

const steps = ["Şirket bilgileri", "Adres", "Logo", "Önizleme ve gönder"] as const;

type StepName = (typeof steps)[number];

/** Bir alanın hangi adımda çizildiği; eksik alan o adıma dönebilsin diye. */
const fieldSteps: Readonly<Record<string, StepName>> = {
  name: "Şirket bilgileri",
  email: "Şirket bilgileri",
  phoneNumber: "Şirket bilgileri",
  website: "Şirket bilgileri",
  description: "Şirket bilgileri",
  taxNumber: "Şirket bilgileri",
  type: "Şirket bilgileri",
  address: "Adres",
  logo: "Logo",
};

export function CompanyForm({
  action,
  addressGateway,
  addressDebounceMs,
}: CompanyFormProps) {
  const [draft, setDraft] = useState<CompanyDraft>(emptyCompanyDraft);
  const [step, setStep] = useState<StepName>("Şirket bilgileri");

  /**
   * Gönderimden önceki son kapı.
   *
   * Kural sunucu action'ında da okunuyor; buradaki kopya kullanıcıyı bir ağ
   * turu beklemeden eksiğine götürmek için. Şirket **silinemediği** için bu
   * tur bedava değil: sunucuya çıkan ve yarısı geçerli bir gövde, geri
   * alınamayan bir kayıt üretme riskini taşıyor.
   */
  const submit = async (previous: FormState, formData: FormData): Promise<FormState> => {
    const errors = companyDraftErrors(draft, createCompanyFields);
    if (!formData.get("address")) errors.address = "Adresi onaylaman gerekiyor.";

    if (Object.keys(errors).length > 0) {
      setStep(firstStepWithError(errors));
      // Backend aynı durumu bu kodla bildiriyor; form iki kaynağı ayırmak
      // zorunda kalmasın diye istemci de aynısını kullanıyor.
      return { status: "error", errorCode: "VALIDATION_FAILED", httpStatus: 400, fieldErrors: errors };
    }

    return action(previous, formData);
  };

  const [state, formAction] = useActionState(submit, idleFormState);
  const fieldErrors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const errorFor = (field: CompanyField | "address" | "logo") => fieldErrors[field];
  const set = (field: CompanyField) => (value: string) => setDraft({ ...draft, [field]: value });

  return (
    <form action={formAction} noValidate className="job-form">
      <nav className="job-form-steps" aria-label="Şirket kaydı adımları">
        {steps.map((name) => (
          <button
            key={name}
            type="button"
            className={name === step ? "step is-current" : "step"}
            aria-current={name === step ? "step" : undefined}
            onClick={() => setStep(name)}
          >
            {name}
          </button>
        ))}
      </nav>

      <FormAlert state={state} />

      <StepPanel name="Şirket bilgileri" current={step}>
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
          hint="Şirketle ilgili bildirimler bu adrese gider; kendi hesap adresinden farklı olabilir."
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
        <TextField
          name="taxNumber"
          label="Vergi numarası"
          autoComplete="off"
          value={draft.taxNumber}
          onValueChange={set("taxNumber")}
          maxLength={companyTextLimit}
          // Alan kurulduktan sonra değiştirilemiyor ve backend hiçbir biçim
          // denetimi yapmıyor; uyarı bu yüzden alanın yanında duruyor.
          hint="Kayıttan sonra değiştirilemiyor; girmeden önce kontrol et."
          error={errorFor("taxNumber")}
        />
        <SelectField
          name="type"
          label="Şirket türü"
          placeholder="Tür seç"
          options={companyTypes.map((option) => ({ value: option.value, label: option.label }))}
          value={draft.type}
          onChange={(event) => set("type")(event.target.value)}
          hint="Kayıttan sonra değiştirilemiyor."
          error={errorFor("type")}
        />
      </StepPanel>

      <StepPanel name="Adres" current={step}>
        {/*
         * Hizmet alanı gönderimden **önce** yazılı: backend sınır dışındaki
         * konumu 400 ile reddediyor ve kullanıcı o an formu çoktan doldurmuş
         * oluyor.
         */}
        <p className="field-hint">{serviceAreaNotice}</p>
        <p className="field-hint">
          Şirket adresini sonradan şirket profilindeki &quot;Şirket adresi&quot; bölümünden
          değiştirebilirsin.
        </p>
        <CanonicalAddressForm
          gateway={addressGateway}
          debounceMs={addressDebounceMs}
          fieldErrors={fieldErrors}
        />
        {errorFor("address") ? <p className="field-error">{errorFor("address")}</p> : null}
      </StepPanel>

      <StepPanel name="Logo" current={step}>
        <FileField
          id="company-logo"
          name="logo"
          label="Şirket logosu (isteğe bağlı)"
          accept={logoAccept}
          required={false}
          hint={logoHint}
          error={errorFor("logo")}
        />
      </StepPanel>

      <StepPanel name="Önizleme ve gönder" current={step}>
        <div className="form-warning">
          <p>
            Şirket kaydı <strong>onay bekleyerek</strong> açılır. Onaylanana kadar şirket adına
            ilan açamazsın.
          </p>
          <p>
            Onay tamamlandığında bildirim gönderilmiyor; durumu bu sayfayı yeniden açarak
            görebilirsin.
          </p>
          <p>
            Kayıt oluşturulduktan sonra <strong>silinemiyor</strong>. Vergi numarası, şirket türü
            ve adres sonradan değiştirilemiyor.
          </p>
        </div>
        <SubmitButton label="Şirketi oluştur" pendingLabel="Şirket oluşturuluyor…" />
      </StepPanel>
    </form>
  );
}

/**
 * Adım paneli.
 *
 * Görünmeyen adım `hidden` ile duruyor, DOM'dan **kaldırılmıyor**: alanları
 * söküp takmak, tek `FormData` ile giden gövdeden o adımın alanlarını
 * düşürürdü.
 */
function StepPanel({
  name,
  current,
  children,
}: {
  name: StepName;
  current: StepName;
  children: ReactNode;
}) {
  return (
    <section className="job-form-panel" hidden={name !== current} aria-label={name}>
      {children}
    </section>
  );
}

function firstStepWithError(errors: Readonly<Record<string, string>>): StepName {
  const found = steps.find((name) =>
    Object.keys(errors).some((field) => fieldSteps[field] === name),
  );
  return found ?? "Şirket bilgileri";
}
