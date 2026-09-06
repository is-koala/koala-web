"use client";

import type { ChangeEvent, ReactNode } from "react";
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

type FieldPresentation = {
  /** Aynı formdan birden çok örnek çizildiğinde etiket bağını benzersiz tutar. */
  id?: string;
  /** Backend DTO alan adıyla aynı: `details[]` eşlemesi böyle karşılık buluyor. */
  name: string;
  label: string;
  hint?: string;
  error?: string;
};

type FieldAccessibility = {
  id: string;
  "aria-invalid": true | undefined;
  "aria-describedby": string | undefined;
};

function FieldShell({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: (accessibility: FieldAccessibility) => ReactNode;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children({
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy,
      })}
      {hint ? <p className="field-hint" id={hintId}>{hint}</p> : null}
      <FieldError id={errorId} message={error} />
    </div>
  );
}

export type TextFieldProps = FieldPresentation & {
  type?: "text" | "email" | "password";
  /** Mobil klavyeyi alana göre açar; `type` tek başına her tarayıcıda yetmiyor. */
  inputMode?: "text" | "email";
  autoComplete?: string;
  required?: boolean;
  defaultValue?: string;
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
  id,
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
  const fieldId = id ?? name;

  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error}>
      {(accessibility) => (
        <input
          {...accessibility}
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
        />
      )}
    </FieldShell>
  );
}

export type TextareaFieldProps = FieldPresentation & {
  defaultValue: string;
  rows: number;
  maxLength?: number;
  /** Denetimli kullanım; taslağı dışarıda tutan formlar için (bkz. `TextField`). */
  value?: string;
  onValueChange?: (value: string) => void;
};

export function TextareaField({
  id,
  name,
  label,
  defaultValue,
  rows,
  hint,
  error,
  maxLength,
  value,
  onValueChange,
}: TextareaFieldProps) {
  return (
    <FieldShell id={id ?? name} label={label} hint={hint} error={error}>
      {(accessibility) => (
        <textarea
          {...accessibility}
          name={name}
          defaultValue={value === undefined ? defaultValue : undefined}
          value={value}
          readOnly={value !== undefined && !onValueChange}
          onChange={onValueChange ? (event) => onValueChange(event.target.value) : undefined}
          rows={rows}
          maxLength={maxLength}
        />
      )}
    </FieldShell>
  );
}

export type InputFieldProps = FieldPresentation & {
  /** `datetime-local` saat dilimi taşımaz; backend karşılığı `LocalDateTime`. */
  type: "date" | "datetime-local" | "number";
  defaultValue: string;
  required?: boolean;
  min?: string;
  max?: string;
  step?: string;
  /** Denetimli kullanım; taslağı dışarıda tutan formlar için (bkz. `TextField`). */
  value?: string;
  onValueChange?: (value: string) => void;
};

export function InputField({
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
  value,
  onValueChange,
}: InputFieldProps) {
  return (
    <FieldShell id={id ?? name} label={label} hint={hint} error={error}>
      {(accessibility) => (
        <input
          {...accessibility}
          name={name}
          type={type}
          defaultValue={value === undefined ? defaultValue : undefined}
          value={value}
          readOnly={value !== undefined && !onValueChange}
          onChange={onValueChange ? (event) => onValueChange(event.target.value) : undefined}
          required={required}
          min={min}
          max={max}
          step={step}
        />
      )}
    </FieldShell>
  );
}

export type SelectFieldProps = FieldPresentation & {
  options: readonly { value: string; label: string }[];
  placeholder: string;
  defaultValue?: string;
  value?: string;
  onChange?: (event: ChangeEvent<HTMLSelectElement>) => void;
  required?: boolean;
  disabled?: boolean;
};

export function SelectField({
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
  hint,
  error,
}: SelectFieldProps) {
  return (
    <FieldShell id={id ?? name} label={label} hint={hint} error={error}>
      {(accessibility) => (
        <select
          {...accessibility}
          name={name}
          defaultValue={value === undefined ? defaultValue : undefined}
          value={value}
          onChange={onChange}
          required={required}
          disabled={disabled}
        >
          <option value="">{placeholder}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      )}
    </FieldShell>
  );
}

export type FileFieldProps = FieldPresentation & {
  accept: string;
  required?: boolean;
};

export function FileField({
  id,
  name,
  label,
  accept,
  required = true,
  hint,
  error,
}: FileFieldProps) {
  return (
    <FieldShell id={id ?? name} label={label} hint={hint} error={error}>
      {(accessibility) => (
        <input
          {...accessibility}
          name={name}
          type="file"
          accept={accept}
          required={required}
        />
      )}
    </FieldShell>
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
  children: ReactNode;
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
  children: ReactNode;
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
