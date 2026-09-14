import type { CanonicalAddress } from "@/address/contract";
import type { FormState } from "@/lib/form-state";

/**
 * Form ile eylemin paylaştığı durum. `actions.ts`'ten ayrı, çünkü bir
 * `"use server"` dosyası yalnız async fonksiyon dışa açabiliyor ve sayfa
 * eylemi doğrudan içe aktarıyor.
 */
export type CompanyAddressState =
  | { status: "idle" }
  | { status: "done"; address: CanonicalAddress }
  | Extract<FormState, { status: "error" }>;

export const idleCompanyAddressState: CompanyAddressState = { status: "idle" };
