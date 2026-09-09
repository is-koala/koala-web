"use server";

import { redirect, unstable_rethrow } from "next/navigation";

import { readAddressWrite } from "@/address/write";
import { companyProfilePath, companySectionPath } from "@/lib/app-routes";
import {
  companyCreateBody,
  companyDraftErrors,
  createCompanyFields,
  emptyCompanyDraft,
  type CompanyDraft,
} from "@/lib/company";
import type { FormState } from "@/lib/form-state";
import { createCompany } from "@/server/company/company";
import { failureState, textField, validationState } from "@/server/form";

/**
 * Şirketi kurar.
 *
 * Kural formda da okunuyor; buradaki denetim ondan bağımsız çünkü devre dışı
 * bir düğmenin arkasındaki form yine de gönderilebilir ve **şirket
 * silinemiyor**: `DELETE /companies/{id}` yok, ret ucu yok ve `taxNumber`
 * üzerinde tekillik kısıtı yok. Yarısı geçerli bir gövdeyle sunucuya çıkmak,
 * geri alınamayan bir kayıt üretme riskini taşır.
 *
 * Kimlik kapısı burada tekrar okunmuyor: `POST /companies` kapısını kendisi
 * taşıyor (`CompanyManager.java:103-105`) ve reddi `USER_MUST_VERIFY_IDENTITY`
 * koduyla geliyor — o kod `@/lib/errors` içinde kapının kendi metnine
 * bağlanmış durumda. İkinci bir istemci denetimi, kapının kararının backend
 * koşulundan ayrışabildiği bir yer daha açardı.
 */
export async function createCompanyAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  void _state;

  const draft = readDraft(formData);
  const address = readAddressWrite(formData);

  const errors = companyDraftErrors(draft, createCompanyFields);
  if (address === null) errors.address = "Adresi onaylaman gerekiyor.";
  if (Object.keys(errors).length > 0) return validationState(errors);

  const body = companyCreateBody(draft, address);
  if (body === null) return validationState(errors);

  let created;
  try {
    created = await createCompany(body, logoOf(formData));
  } catch (error) {
    unstable_rethrow(error);
    return failureState(error);
  }

  /*
   * Kayıt açıldı: form geride kalmamalı. Aynı formun ikinci gönderimi
   * silinemeyen ikinci bir şirket doğururdu. Kimlik okunamazsa bölüm girişi
   * üyelik listesinden doğru şirkete dallanıyor.
   */
  redirect(created.id ? companyProfilePath(created.id) : companySectionPath);
}

/** Form alanlarının adları DTO alan adlarıyla aynı; taslak birebir okunur. */
function readDraft(formData: FormData): CompanyDraft {
  return Object.fromEntries(
    Object.keys(emptyCompanyDraft).map((field) => [field, textField(formData, field)]),
  ) as CompanyDraft;
}

/**
 * Seçilmemiş dosya alanı tarayıcıda boş bir `File` olarak geliyor; onu
 * göndermek `uploadValidator`'ın "boş dosya" reddine düşerdi ve şirket hiç
 * kurulmazdı.
 */
function logoOf(formData: FormData): File | null {
  const logo = formData.get("logo");
  return logo instanceof File && logo.size > 0 ? logo : null;
}
