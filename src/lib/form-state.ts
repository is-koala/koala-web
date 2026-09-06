/**
 * Sunucu action'ı ile formun paylaştığı durum.
 *
 * Yalnız `errorCode`, HTTP durumu ve alan bazlı metinler taşınır: formun üst
 * bandındaki metin istemcide `errorPresentation` ile seçilir, böylece
 * backend'in ham mesajı ekrana hiç düşmez ve dallanma metne göre yapılamaz
 * (`AGENTS.md`). Alan hataları ayrı, çünkü backend onları zaten çözülmüş
 * Türkçe olarak `details[]` içinde veriyor (`FieldError`).
 */
export type FormState =
  | { status: "idle" }
  /** İşlem tamamlandı ve sayfa değişmiyor; form yerine onay paneli çizilir. */
  | { status: "done" }
  | {
      status: "error";
      errorCode: string;
      httpStatus: number;
      fieldErrors?: Readonly<Record<string, string>>;
    };

export const idleFormState: FormState = { status: "idle" };

/** `useActionState` ile eşleşen sunucu action imzası. */
export type FormAction = (state: FormState, formData: FormData) => Promise<FormState>;

/** Alanın altına yazılacak metin; yalnız hata durumunda dolu. */
export function fieldError(state: FormState, name: string): string | undefined {
  return state.status === "error" ? state.fieldErrors?.[name] : undefined;
}
