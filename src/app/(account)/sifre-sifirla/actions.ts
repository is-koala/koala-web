"use server";

import type { FormState } from "@/lib/form-state";
import { passwordProblem, passwordRequirement, passwordsDoNotMatch } from "@/lib/password";
import { resetPassword } from "@/server/auth/password";
import { failureState, textField, validationState } from "@/server/form";

/**
 * Yeni parolanın sunucu tarafı.
 *
 * Kural kayıttakiyle aynı modülden geliyor. Denetimler backend'e gitmeden
 * yapılıyor çünkü sıfırlama tokenı tek kullanımlık
 * (`PasswordResetTokenManager.consume`): eşleşmeyen bir tekrar yüzünden
 * yapılan gönderim bağlantıyı yakardı.
 */
export async function resetPasswordAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const newPassword = textField(formData, "newPassword");
  const problem = passwordProblem(newPassword, textField(formData, "newPasswordConfirmation"));

  if (problem === "weak") return validationState({ newPassword: passwordRequirement });
  if (problem === "mismatch") {
    return validationState({ newPasswordConfirmation: passwordsDoNotMatch });
  }

  try {
    await resetPassword({ resetToken: textField(formData, "resetToken"), newPassword });
  } catch (error) {
    return failureState(error);
  }

  return { status: "done" };
}
