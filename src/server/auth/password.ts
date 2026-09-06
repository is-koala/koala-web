import "server-only";

import { apiFetch } from "@/server/api/client";
import { backendPaths } from "@/server/contract";
import { anonymousCaller } from "@/server/session/session";

export type ResetPasswordInput = {
  /** E-postadaki tek kullanımlık ham token. */
  resetToken: string;
  newPassword: string;
};

/**
 * Sıfırlama e-postasını ister.
 *
 * Adres kayıtlı olmasa da backend 200 dönüyor (`AuthManager.requestPasswordReset`
 * bilinmeyen adresi sessizce yutuyor); ekran da bu ikiliği bozmamalı.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  await apiFetch<null>(backendPaths.forgotPassword, {
    ...(await anonymousCaller()),
    method: "POST",
    body: { email },
  });
}

/**
 * Parolayı değiştirir.
 *
 * Token tek kullanımlık (`PasswordResetTokenManager.consume`): sayfa açılışında
 * doğrulanamaz, yalnız gönderimde harcanır. Başarıda backend kullanıcının
 * bütün oturumlarını kapatıyor.
 */
export async function resetPassword(input: ResetPasswordInput): Promise<void> {
  await apiFetch<null>(backendPaths.resetPassword, {
    ...(await anonymousCaller()),
    method: "POST",
    body: input,
  });
}
