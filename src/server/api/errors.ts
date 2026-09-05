import "server-only";

import { upgradeRequiredStatus } from "@/server/contract";

/** Doğrulama hatalarında alan bazında mesaj taşıyan `FieldError` kaydı. */
export type ApiFieldError = {
  field: string;
  message: string;
};

export type ApiErrorInit = {
  status: number;
  errorCode: string;
  errorCategory: string;
  message: string;
  details?: readonly ApiFieldError[];
  correlationId?: string | null;
  /** Yalnız 426 yanıtında dolu: backend'in beklediği en düşük web sürümü. */
  minimumAppVersion?: string | null;
};

/**
 * Backend hata zarfının tipli karşılığı.
 *
 * Dallanma `errorCode` ve `errorCategory` ile yapılır; `message` yalnız
 * kayıt ve hata ayıklama içindir, kullanıcıya `@/lib/errors` üzerinden
 * çözülmüş Türkçe metin gösterilir.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly errorCode: string;
  readonly errorCategory: string;
  readonly details: readonly ApiFieldError[];
  readonly correlationId: string | null;
  readonly minimumAppVersion: string | null;

  constructor(init: ApiErrorInit) {
    super(init.message);
    this.name = "ApiError";
    this.status = init.status;
    this.errorCode = init.errorCode;
    this.errorCategory = init.errorCategory;
    this.details = init.details ?? [];
    this.correlationId = init.correlationId ?? null;
    this.minimumAppVersion = init.minimumAppVersion ?? null;
  }
}

/**
 * Sürüm kapısına takılan istek. Kullanıcıya yapacak tek bir şey kalır:
 * sayfayı yenileyip yeni web derlemesini almak.
 */
export function isUpgradeRequired(error: unknown): error is ApiError {
  return error instanceof ApiError && error.status === upgradeRequiredStatus;
}
