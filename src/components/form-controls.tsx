"use client";

import { useFormStatus } from "react-dom";

import { ErrorState } from "@/components/states";
import type { FormState } from "@/lib/form-state";

/**
 * Formun üst bandındaki hata.
 *
 * Metin `errorPresentation` üzerinden `errorCode` ile seçilir; alan bazlı
 * mesajlar ayrıca kendi alanlarının altında görünür.
 */
export function FormAlert({ state }: { state: FormState }) {
  if (state.status !== "error") return null;
  return <ErrorState errorCode={state.errorCode} status={state.httpStatus} />;
}

export type TextFieldProps = {
  /** Backend DTO alan adıyla aynı: `details[]` eşlemesi böyle karşılık buluyor. */
  name: string;
  label: string;
  type?: "text" | "email" | "password";
  /** Mobil klavyeyi alana göre açar; `type` tek başına her tarayıcıda yetmiyor. */
  inputMode?: "text" | "email";
  autoComplete?: string;
  required?: boolean;
  defaultValue?: string;
  hint?: string;
  error?: string;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  /**
   * Denetimli kullanım. Adres formunda alanlar aramadan gelen adayla
   * dışarıdan doldurulabiliyor; `defaultValue` bir kez okunduğu için o
   * yazma ekrana hiç yansımazdı.
   */
  value?: string;
  onValueChange?: (value: string) => void;
  onBlur?: () => void;
};

export function TextField({
  name,
  label,
  type = "text",
  inputMode,
  autoComplete,
  required = true,
  defaultValue,
  hint,
  error,
  minLength,
  maxLength,
  pattern,
  value,
  onValueChange,
  onBlur,
}: TextFieldProps) {
  const hintId = hint ? `${name}-hint` : undefined;
  const errorId = error ? `${name}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <input
        id={name}
        name={name}
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        required={required}
        defaultValue={value === undefined ? defaultValue : undefined}
        value={value}
        // Denetimli değer değiştirici olmadan gelirse React her tuşta uyarır;
        // niyet zaten salt okunur bir alandır.
        readOnly={value !== undefined && !onValueChange}
        onChange={onValueChange ? (event) => onValueChange(event.target.value) : undefined}
        onBlur={onBlur}
        minLength={minLength}
        maxLength={maxLength}
        pattern={pattern}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
      />
      {hint && (
        <p className="field-hint" id={hintId}>
          {hint}
        </p>
      )}
      <FieldError id={errorId} message={error} />
    </div>
  );
}

export function CheckboxField({
  name,
  value,
  required = false,
  children,
}: {
  name: string;
  value: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  const id = `${name}-${value}`;
  return (
    <div className="checkbox-field">
      <input id={id} name={name} type="checkbox" value={value} required={required} />
      <label htmlFor={id}>{children}</label>
    </div>
  );
}

/**
 * Sayfa değişmeden biten işlemin onayı. Üç form da aynı kabuğu kullanıyor;
 * ekran okuyucunun değişikliği duyurabilmesi için `role="status"` taşır.
 */
export function DoneNotice({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="state-card" role="status">
      <h2>{title}</h2>
      {children}
    </div>
  );
}

export function FieldError({ id, message }: { id?: string; message?: string }) {
  if (!message) return null;
  return (
    <p className="field-error" id={id}>
      {message}
    </p>
  );
}

/**
 * Bekleme durumu ayrı bir bileşende: `useFormStatus` yalnız gönderen formun
 * içinden okunabiliyor.
 */
export function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button className="button button-primary" type="submit" disabled={pending}>
      {pending ? pendingLabel : label}
    </button>
  );
}
