"use server";

import { revalidatePath } from "next/cache";

import { companyProfilePath, editCompanyPath } from "@/lib/app-routes";
import {
  companyDraftErrors,
  companyUpdateBody,
  editableCompanyFields,
  emptyCompanyDraft,
  type CompanyDraft,
} from "@/lib/company";
import type { FormState } from "@/lib/form-state";
import { isUuid } from "@/lib/identifiers";
import { removeCompanyLogo, replaceCompanyLogo, updateCompany } from "@/server/company/company";
import { failureState, textField, validationState } from "@/server/form";
import { requireSessionForCurrentPath } from "@/server/session/guard";

/**
 * Şirketin beş düzenlenebilir alanı.
 *
 * Yetkiyi burada tekrar denetlemiyoruz: `PATCH /companies/{companyId}` kendi
 * kapısını taşıyor (`requireCompanyAdmin`) ve geçemeyen çağrıya 404 dönüyor.
 * İstemcide ikinci bir denetim, ekrandaki rol ile gerçek yetkinin
 * ayrışabildiği bir yer daha açardı — kararı hep uç veriyor.
 */
export async function updateCompanyAction(
  companyId: string,
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  void _state;

  await requireSessionForCurrentPath();
  if (!isUuid(companyId)) return validationState({ record: "Kayıt kimliği geçerli değil." });

  const draft = readDraft(formData);
  const errors = companyDraftErrors(draft, editableCompanyFields);
  if (Object.keys(errors).length > 0) return validationState(errors);

  try {
    await updateCompany(companyId, companyUpdateBody(draft));
  } catch (error) {
    return failureState(error);
  }

  refresh(companyId);
  return { status: "done" };
}

/**
 * Logoyu değiştirir.
 *
 * Şirket bilgilerinin kaydedilmesinden ayrı bir eylem, çünkü backend'de de
 * ayrı bir uç: kaydetmeye bağlanmış olsaydı yalnız logo değiştirmek isteyen
 * kullanıcı beş alanı yeniden gönderir ve o gönderimin kendi hatalarını da
 * karşılardı.
 */
export async function replaceCompanyLogoAction(
  companyId: string,
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  void _state;

  await requireSessionForCurrentPath();
  if (!isUuid(companyId)) return validationState({ record: "Kayıt kimliği geçerli değil." });

  const logo = formData.get("logo");
  // Boş dosya alanı backend'in "boş dosya" reddine düşerdi; kullanıcı bunu
  // bir arıza gibi okur.
  if (!(logo instanceof File) || logo.size === 0) {
    return validationState({ logo: "Yüklenecek bir dosya seç." });
  }

  try {
    await replaceCompanyLogo(companyId, logo);
  } catch (error) {
    return failureState(error);
  }

  refresh(companyId);
  return { status: "done" };
}

/** `DELETE /companies/{companyId}/logo` — bağlantı düşer, depodaki nesne kalır. */
export async function removeCompanyLogoAction(
  companyId: string,
  _state: FormState,
  _formData: FormData,
): Promise<FormState> {
  void _state;
  void _formData;

  await requireSessionForCurrentPath();
  if (!isUuid(companyId)) return validationState({ record: "Kayıt kimliği geçerli değil." });

  try {
    await removeCompanyLogo(companyId);
  } catch (error) {
    return failureState(error);
  }

  refresh(companyId);
  return { status: "done" };
}

/**
 * İki ekran da tazeleniyor: düzenleme formu kaydedilen değerlerle yeniden
 * çizilmeli ve kullanıcının bir sonraki durağı olan profil bayat kalmamalı.
 */
function refresh(companyId: string): void {
  revalidatePath(editCompanyPath(companyId));
  revalidatePath(companyProfilePath(companyId));
}

/** Form alanlarının adları DTO alan adlarıyla aynı; taslak birebir okunur. */
function readDraft(formData: FormData): CompanyDraft {
  return Object.fromEntries(
    Object.keys(emptyCompanyDraft).map((field) => [field, textField(formData, field)]),
  ) as CompanyDraft;
}
