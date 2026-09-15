"use server";

import { redirect, unstable_rethrow } from "next/navigation";

import { readAddressWrite } from "@/address/write";
import { newCompanyJobPath } from "@/lib/app-routes";
import type { FormState } from "@/lib/form-state";
import { isUuid } from "@/lib/identifiers";
import { companyJobBody, companyJobErrors, withJobFieldAliases } from "@/lib/job-posting";
import { failureState, validationState } from "@/server/form";
import { createCompanyJob } from "@/server/jobs/jobs";
import {
  closedGateState,
  loadJobCategories,
  readJobDraft,
  finishJobPublish,
  readTransportPlanForPublish,
} from "@/server/jobs/submission";
import { corporateJobGate, currentGates } from "@/server/session/gates";

/**
 * Şirket adına ilan yayımlar.
 *
 * Şirket kimliği ilk argüman ve rotadan `bind` ile geliyor: gövdeye konsaydı
 * gönderim sırasında değiştirilebilirdi ve kapı başka bir şirket için
 * okunmuş olurdu.
 *
 * Kapı burada ikinci kez okunuyor. Formdaki devre dışı düğme bir kolaylık;
 * devre dışı bir düğmenin arkasındaki form yine de gönderilebilir. Şirket
 * onayı kuralının backend'de karşılığı **yok** (`company.isApproved()` iş
 * mantığında hiç okunmuyor), yani onaysız şirketin ilanını durduran tek yer
 * burası.
 */
export async function publishCompanyJobAction(
  companyId: string,
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  void _state;

  // Kimlik adres çubuğundan geliyor; UUID olmayan bir değeri backend'e hiç
  // sormuyoruz ve kapı da onu tanımıyor.
  if (!isUuid(companyId)) return closedGateState(["companyContact"]);

  const { gates } = await currentGates();
  const verdict = gates === null ? undefined : corporateJobGate(gates, companyId);
  if (verdict === undefined || !verdict.open) {
    return closedGateState(verdict?.blockedBy ?? []);
  }

  const draft = readJobDraft(formData);
  const address = readAddressWrite(formData);
  const transport = readTransportPlanForPublish(formData);
  const categories = await loadJobCategories();

  const errors = companyJobErrors(draft, categories);
  if (address === null) errors.address = "Adresi onaylaman gerekiyor.";
  if (transport.status === "invalid") Object.assign(errors, transport.fieldErrors);
  if (Object.keys(errors).length > 0) return validationState(errors);

  // Sigorta değeri gövdeyi kuran işlevde kategoriden türetiliyor: formdan
  // gelen tercih tek başına gövdeye giremiyor.
  const body = companyJobBody(draft, address, categories);
  if (body === null) return validationState(errors);

  let created;
  try {
    created = await createCompanyJob(companyId, body);
  } catch (error) {
    unstable_rethrow(error);
    const failure = failureState(error);
    return failure.status === "error" && failure.fieldErrors
      ? { ...failure, fieldErrors: withJobFieldAliases(failure.fieldErrors) }
      : failure;
  }

  // Yayımdan sonra kullanıcı ilanın kendi sayfasına düşer: fiyat orada
  // kilitlenmiş hâliyle duruyor ve form durumu geride kalmıyor.
  if (!created.id) redirect(newCompanyJobPath(companyId));
  return finishJobPublish(created.id, transport);
}
