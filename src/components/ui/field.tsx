import type { ReactNode } from "react";

/**
 * Form alanı kabuğu: etiket, denetim, ipucu ve hata.
 *
 * `form-controls.tsx`'teki `TextField` ailesi istemci bileşeni ve
 * `useFormStatus` okuyor; sunucuda çizilen düz formlar (red gerekçesi,
 * arama kutusu) için aynı görünümü kurmak isteyen çağıranlar bu kabuğu
 * kullanır. İkisi aynı `.field` sınıfını paylaşıyor; görünüm tek yerde.
 *
 * Erişilebilirlik bağını çağıran kurar: `id`'yi denetime, `hintId`/`errorId`
 * değerlerini `aria-describedby`'a yazar. Bileşen denetimi sarmalamıyor ki
 * `textarea`, `select` ve `input` aynı kabuğa girebilsin.
 */
export function Field({
  id,
  label,
  hint,
  error,
  children,
  className,
}: {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={["field", className].filter(Boolean).join(" ")}>
      <label htmlFor={id}>{label}</label>
      {children}
      {hint ? (
        <p className="field-hint" id={fieldHintId(id)}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="field-error" id={fieldErrorId(id)} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function fieldHintId(id: string): string {
  return `${id}-hint`;
}

export function fieldErrorId(id: string): string {
  return `${id}-error`;
}

/** `aria-describedby` için ipucu ve hata kimliklerini birleştirir. */
export function fieldDescribedBy(id: string, { hint, error }: { hint?: boolean; error?: boolean }) {
  const ids = [hint ? fieldHintId(id) : null, error ? fieldErrorId(id) : null].filter(Boolean);
  return ids.length > 0 ? ids.join(" ") : undefined;
}

/** Birden çok alanı bir başlık altında toplayan `fieldset`. */
export function FieldGroup({
  legend,
  description,
  children,
  className,
}: {
  legend: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <fieldset className={["field-group", className].filter(Boolean).join(" ")}>
      <legend>{legend}</legend>
      {description ? <p className="field-hint">{description}</p> : null}
      {children}
    </fieldset>
  );
}
