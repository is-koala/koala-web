"use server";

import type { FormState } from "@/lib/form-state";
import { startRegistration } from "@/server/auth/registration";
import { failureState, textField } from "@/server/form";

/** Rol seçiminde işvereni temsil eden değer; formdaki radyo düğmesiyle aynı. */
const employerRole = "isveren";

/**
 * Kayıt başlatma formunun sunucu tarafı.
 *
 * Başarıda sayfa değişmez, form yerine onay paneli çizilir: uç adres kayıtlı
 * olsa da 200 döndüğü için ekran "hesabın oluşturuldu" diyemez, yalnız
 * e-postanın gönderilmiş olabileceğini söyler.
 */
export async function startRegistrationAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    await startRegistration({
      firstName: textField(formData, "firstName"),
      lastName: textField(formData, "lastName"),
      email: textField(formData, "email"),
      isEmployer: textField(formData, "role") === employerRole,
    });
  } catch (error) {
    return failureState(error);
  }

  return { status: "done" };
}
