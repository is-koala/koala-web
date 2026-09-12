import "server-only";

import type { FormState } from "@/lib/form-state";
import { loadViewer } from "@/server/session/viewer";

/** Büyük yükleme gövdesi okunmadan önce tokenları backend'de gerçekten doğrular. */
export async function verifyIdentityUploadSession(): Promise<FormState | null> {
  try {
    const { viewer, failure } = await loadViewer();
    if (viewer) return null;
    return {
      status: "error",
      errorCode: failure?.errorCode ?? "UNEXPECTED",
      httpStatus: failureStatus(failure?.status),
    };
  } catch (error) {
    // Server Component'te gezinme olan NEXT_REDIRECT, fetch ile çağrılan rota
    // içinde giriş HTML'ine dönüşür. İstemci gerçek sayfa geçişini kendisi yapar.
    const failure = identityUploadAuthenticationFailure(error);
    if (failure) return failure;
    throw error;
  }
}

function failureStatus(status: number | undefined): number {
  return status !== undefined && Number.isInteger(status) && status >= 400 && status <= 599
    ? status
    : 500;
}

/** Fetch'in sayfa HTML'ini takip etmemesi için oturum yönlendirmesini API durumuna çevirir. */
export function identityUploadAuthenticationFailure(error: unknown): FormState | null {
  if (!isRedirect(error)) return null;
  return {
    status: "error",
    errorCode: "AUTHENTICATION_REQUIRED",
    httpStatus: 401,
  };
}

function isRedirect(error: unknown): boolean {
  return (
    typeof error === "object"
    && error !== null
    && typeof (error as { digest?: unknown }).digest === "string"
    && (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}
