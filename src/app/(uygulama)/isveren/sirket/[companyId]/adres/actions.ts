"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";

import type { CanonicalAddress } from "@/address/contract";
import { readAddressWrite, writeFieldErrors } from "@/address/write";
import { companyAddressPath, companyProfilePath, editCompanyPath } from "@/lib/app-routes";
import { companyAddressApplied } from "@/lib/company";
import { companyAddressNotAppliedErrorCode } from "@/lib/errors";
import { isUuid } from "@/lib/identifiers";
import { updateCompany } from "@/server/company/company";
import { failureState, validationState } from "@/server/form";
import { requireSessionForCurrentPath } from "@/server/session/guard";

import { idleCompanyAddressState, type CompanyAddressState } from "./state";

/**
 * Şirket adresini `PATCH /companies/{companyId}` `{ address }` ile değiştirir.
 *
 * Yetki burada tekrar denetlenmiyor: uç `requireCompanyAdmin` taşıyor ve
 * geçemeyene 404 dönüyor; sayfa zaten `ADMIN` olmayanı `notFound()` ile
 * çeviriyor. İstemcide ikinci bir denetim, ekrandaki rol ile gerçek yetkinin
 * ayrışabildiği bir yer daha açardı.
 *
 * Yanıt gönderilen adresle karşılaştırılıyor. `address` alanı 0.9.24 ile
 * geldi ve daha eski sunucu bilinmeyen alanı reddetmek yerine **sessizce
 * düşürüp** 200 ile eski adresi döndürüyor; "kaydedildi" deyip eski adresi
 * göstermek kullanıcıyı ödeme anında yeniden aynı kapıya çarptırırdı.
 */
export async function saveCompanyAddressAction(
  companyId: string,
  _state: CompanyAddressState,
  formData: FormData,
): Promise<CompanyAddressState> {
  void _state;

  await requireSessionForCurrentPath();
  if (!isUuid(companyId)) return invalid({ record: "Kayıt kimliği geçerli değil." });

  const address = readAddressWrite(formData);
  if (address === null) return invalid({ address: "Adresi onaylaman gerekiyor." });

  try {
    const company = await updateCompany(companyId, { address });
    if (!companyAddressApplied(address, company.address)) {
      return { status: "error", errorCode: companyAddressNotAppliedErrorCode, httpStatus: 200 };
    }
    refresh(companyId);
    // `companyAddressApplied` yanıtta adres olduğunu zaten kanıtladı.
    return { status: "done", address: company.address as CanonicalAddress };
  } catch (error) {
    unstable_rethrow(error);
    const failure = failureState(error);
    if (failure.status !== "error") return idleCompanyAddressState;
    return failure.fieldErrors
      ? { ...failure, fieldErrors: companyAddressFieldErrors(failure.fieldErrors) }
      : failure;
  }
}

function invalid(fieldErrors: Record<string, string>): CompanyAddressState {
  const state = validationState(fieldErrors);
  return state.status === "error" ? state : idleCompanyAddressState;
}

/**
 * Üç ekran da tazeleniyor: bu sayfa yeni adresi göstermeli, profil ve
 * düzenleme ekranı da aynı adresi çiziyor ve bayat kalmamalı.
 */
function refresh(companyId: string): void {
  revalidatePath(companyAddressPath(companyId));
  revalidatePath(companyProfilePath(companyId));
  revalidatePath(editCompanyPath(companyId));
}

/**
 * `UpdateCompanyRequestDto` içinde adres iç içe: `details[]` yolları
 * `address.components.postalCode` biçiminde geliyor. Form alanları düz
 * adlandırıldığı için önce `address.` öneki, sonra bileşen yolu kırpılır.
 * Adresin kendisine ait hata (`address`) olduğu gibi kalır ve formun altında
 * yazılır.
 */
function companyAddressFieldErrors(
  fieldErrors: Readonly<Record<string, string>>,
): Record<string, string> {
  return writeFieldErrors(
    Object.fromEntries(
      Object.entries(fieldErrors).map(([field, message]) => [
        field.startsWith("address.") ? field.slice("address.".length) : field,
        message,
      ]),
    ),
  );
}
