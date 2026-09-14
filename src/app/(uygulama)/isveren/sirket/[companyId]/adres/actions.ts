"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";

import { readAddressWrite, writeFieldErrors } from "@/address/write";
import { companyAddressPath, companyProfilePath, editCompanyPath } from "@/lib/app-routes";
import { idleAddressFormState, type AddressFormState } from "@/lib/form-state";
import { isUuid } from "@/lib/identifiers";
import { updateCompany } from "@/server/company/company";
import { unexpectedError } from "@/server/contract";
import { failureState, validationState } from "@/server/form";
import { requireSessionForCurrentPath } from "@/server/session/guard";


/**
 * Şirket adresini `PATCH /companies/{companyId}` `{ address }` ile değiştirir.
 *
 * Yetki burada tekrar denetlenmiyor: uç `requireCompanyAdmin` taşıyor ve
 * geçemeyene 404 dönüyor; sayfa zaten `ADMIN` olmayanı `notFound()` ile
 * çeviriyor. İstemcide ikinci bir denetim, ekrandaki rol ile gerçek yetkinin
 * ayrışabildiği bir yer daha açardı.
 *
 * Yanıttaki `CompanyDto.address` güncel kaydı taşıyor ve onay kartı onu
 * çiziyor. Adres alanını tanımayan (0.9.24 öncesi) sunucuya karşı bir
 * denetim yok: bu ekran o sürüm canlıya çıkmadan yayına girmiyor.
 */
export async function saveCompanyAddressAction(
  companyId: string,
  _state: AddressFormState,
  formData: FormData,
): Promise<AddressFormState> {
  void _state;

  await requireSessionForCurrentPath();
  if (!isUuid(companyId)) return invalid({ record: "Kayıt kimliği geçerli değil." });

  const address = readAddressWrite(formData);
  if (address === null) return invalid({ address: "Adresi onaylaman gerekiyor." });

  try {
    const company = await updateCompany(companyId, { address });
    // Sözleşme adresi her zaman döndürüyor; yokluğu bir arıza, "kaydedildi"
    // deyip boş kart çizmek değil.
    if (company.address === null) {
      return { status: "error", errorCode: unexpectedError, httpStatus: 500 };
    }
    refresh(companyId);
    return { status: "done", address: company.address };
  } catch (error) {
    unstable_rethrow(error);
    const failure = failureState(error);
    if (failure.status !== "error") return idleAddressFormState;
    return failure.fieldErrors
      ? { ...failure, fieldErrors: companyAddressFieldErrors(failure.fieldErrors) }
      : failure;
  }
}

function invalid(fieldErrors: Record<string, string>): AddressFormState {
  const state = validationState(fieldErrors);
  return state.status === "error" ? state : idleAddressFormState;
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
