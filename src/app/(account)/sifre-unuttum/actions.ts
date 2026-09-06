"use server";

import type { FormState } from "@/lib/form-state";
import { requestPasswordReset } from "@/server/auth/password";
import { failureState, textField } from "@/server/form";

/**
 * Sıfırlama e-postası isteğinin sunucu tarafı.
 *
 * Yanıt her adres için aynı: backend kayıtlı olmayan adresi sessizce yutup
 * 200 döndüğü için ekran da adresin kayıtlı olup olmadığını ele vermez.
 */
export async function forgotPasswordAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    await requestPasswordReset(textField(formData, "email"));
  } catch (error) {
    return failureState(error);
  }

  return { status: "done" };
}
