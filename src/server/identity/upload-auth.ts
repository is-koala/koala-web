import "server-only";

import type { FormState } from "@/lib/form-state";
import { loadViewer } from "@/server/session/viewer";

/** Büyük yükleme gövdesi okunmadan önce tokenları backend'de gerçekten doğrular. */
export async function verifyIdentityUploadSession(): Promise<FormState | null> {
  const { viewer, failure } = await loadViewer();
  if (viewer) return null;
  return {
    status: "error",
    errorCode: failure?.errorCode ?? "UNEXPECTED",
    httpStatus: failure?.status ?? 500,
  };
}
