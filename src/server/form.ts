import "server-only";

import type { FormState } from "@/lib/form-state";

import { ApiError, type ApiFieldError } from "./api/errors";
import { unexpectedError } from "./contract";

/** Backend'in alan doğrulamasına verdiği kod; `ErrorResult` kategoriden türetiyor. */
const validationFailed = "VALIDATION_FAILED";

/**
 * Backend hatasını forma taşınabilir duruma çevirir.
 *
 * Alan mesajları `details[]` içinde zaten çözülmüş Türkçe geliyor
 * (`GlobalExceptionHandler` `messageResolver.resolve`), bu yüzden oldukları
 * gibi taşınır; üst banttaki metin ise `errorCode` üzerinden seçilir. Form
 * alanları backend DTO alan adlarıyla aynı adlandırıldığı için eşleme
 * dönüştürme gerektirmez.
 */
export function failureState(error: unknown): FormState {
  const { errorCode, httpStatus } = failureView(error);
  return {
    status: "error",
    errorCode,
    httpStatus,
    fieldErrors: error instanceof ApiError ? fieldErrorsOf(error.details) : undefined,
  };
}

/**
 * Form dışındaki yüzeylerin — sunucuda çizilen hata kartlarının — aynı
 * kodu kullanabilmesi için. Metin yine `errorPresentation` ile seçilir.
 */
export function failureView(error: unknown): { errorCode: string; httpStatus: number } {
  if (error instanceof ApiError) {
    return { errorCode: error.errorCode, httpStatus: error.status };
  }
  return { errorCode: unexpectedError, httpStatus: 500 };
}

/**
 * İstemcide yakalanan kural ihlali. Backend aynı durumu VALIDATION_FAILED ile
 * bildirdiği için form iki kaynağı ayırt etmek zorunda kalmaz.
 */
export function validationState(fieldErrors: Record<string, string>): FormState {
  return { status: "error", errorCode: validationFailed, httpStatus: 400, fieldErrors };
}

/** Form alanının metin değeri; dosya ya da eksik alan boş dizeye düşer. */
export function textField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function fieldErrorsOf(details: readonly ApiFieldError[]): Record<string, string> | undefined {
  if (details.length === 0) return undefined;
  return Object.fromEntries(details.map((detail) => [detail.field, detail.message]));
}
