"use server";

import { redirect } from "next/navigation";

import { consentDecisions, missingMandatoryConsents } from "@/lib/consents";
import type { FormState } from "@/lib/form-state";
import { passwordProblem, passwordRequirement, passwordsDoNotMatch } from "@/lib/password";
import { postRegistrationPath } from "@/lib/site";
import { completeRegistration } from "@/server/auth/registration";
import { failureState, textField, validationState } from "@/server/form";
import { readAgreements } from "@/server/legal/agreements";

const mandatoryConsentMissing = "Devam etmek için zorunlu sözleşmeleri onaylaman gerekiyor.";

/**
 * Parola belirleme ve rıza kararlarının sunucu tarafı.
 *
 * Rıza gövdesi formdan değil backend'in kendi listesinden kurulur:
 * işaretlenmeyen sözleşmeler de `granted: false` ile gitmeli ve eksik bir
 * gizli alan "sormadık" ile "sorduk reddetti" ayrımını bozmamalı.
 */
export async function completeRegistrationAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const password = textField(formData, "password");
  const grantedIds = formData.getAll("consents").filter((id) => typeof id === "string");

  let agreements;
  try {
    agreements = await readAgreements();
  } catch (error) {
    return failureState(error);
  }

  const localFailure = firstLocalFailure({
    password,
    confirmation: textField(formData, "passwordConfirmation"),
    missingMandatory: missingMandatoryConsents(agreements, grantedIds).length > 0,
  });
  if (localFailure) return localFailure;

  try {
    await completeRegistration({
      setPasswordToken: textField(formData, "setPasswordToken"),
      password,
      consents: consentDecisions(agreements, grantedIds),
    });
  } catch (error) {
    return failureState(error);
  }

  // Backend 201 ile oturum da açıyor; kullanıcı "şimdi giriş yap" adımı
  // görmeden içeri girer.
  redirect(postRegistrationPath);
}

/**
 * Kural ihlalleri backend'e hiç gitmeden yakalanır: kayıt ucu parolayı
 * doğrulamıyor (`AuthCompleteRegistrationDto` yalnız `@NotNull`), yani zayıf
 * parola sessizce kabul edilir ve kullanıcı onu sonradan sıfırlama
 * ekranından geri koyamaz.
 */
function firstLocalFailure({
  password,
  confirmation,
  missingMandatory,
}: {
  password: string;
  confirmation: string;
  missingMandatory: boolean;
}): FormState | null {
  const problem = passwordProblem(password, confirmation);
  if (problem === "weak") return validationState({ password: passwordRequirement });
  if (problem === "mismatch") {
    return validationState({ passwordConfirmation: passwordsDoNotMatch });
  }
  if (missingMandatory) return validationState({ consents: mandatoryConsentMissing });
  return null;
}
