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
      httpStatus: failure?.status ?? 500,
    };
  } catch (error) {
    // Server Component'te gezinme olan NEXT_REDIRECT, fetch ile çağrılan rota
    // içinde giriş HTML'ine dönüşür. İstemci gerçek sayfa geçişini kendisi yapar.
    if (isRedirect(error)) {
      return {
        status: "error",
        errorCode: "AUTHENTICATION_REQUIRED",
        httpStatus: 401,
      };
    }
    throw error;
  }
}

function isRedirect(error: unknown): boolean {
  return (
    typeof error === "object"
    && error !== null
    && typeof (error as { digest?: unknown }).digest === "string"
    && (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}
