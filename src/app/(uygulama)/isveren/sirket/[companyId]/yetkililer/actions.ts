"use server";

import { revalidatePath } from "next/cache";

import type { FormState } from "@/lib/form-state";
import { removeCompanyContact } from "@/server/company/contacts";
import { failureState, validationState } from "@/server/form";
import { requireSessionForCurrentPath } from "@/server/session/guard";

import { contactsPath, isCompanyRecordId } from "./paths";

/**
 * Bir yetkiliyi şirketten çıkarır.
 *
 * Yetkiyi burada tekrar denetlemiyoruz: `DELETE /companies/{companyId}/contacts/{userId}`
 * kendi kapısını taşıyor (`requireCompanyAdmin`) ve geçemeyen çağrıya 404
 * dönüyor. İstemcide ikinci bir denetim kurmak, ekrandaki rol ile gerçek
 * yetkinin ayrışabildiği bir yer daha açardı — kararı hep uç veriyor.
 *
 * `userId` **kişinin** kimliği (`CompanyContactDto.user.id`), üyelik
 * kaydınınki değil.
 */
export async function removeContactAction(
  companyId: string,
  userId: string,
  _state: FormState,
  _formData: FormData,
): Promise<FormState> {
  void _state;
  void _formData;

  await requireSessionForCurrentPath();

  // İki kimlik de adres çubuğundan ve form gövdesinden geliyor. Uydurulmuş
  // bir değer doğrulanmadan geçseydi kullanıcıya `errorCode` taşımayan bir
  // sunucu hatası dönerdi.
  if (!isCompanyRecordId(companyId) || !isCompanyRecordId(userId)) {
    return validationState({ record: "Kayıt kimliği geçerli değil." });
  }

  try {
    await removeCompanyContact(companyId, userId);
  } catch (error) {
    return failureState(error);
  }

  revalidatePath(contactsPath(companyId));
  return { status: "done" };
}
