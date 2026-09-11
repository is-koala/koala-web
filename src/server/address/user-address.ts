import "server-only";

import type { AddressWrite, CanonicalAddress } from "@/address/contract";
import { canonicalAddressFrom } from "@/address/read";
import { ApiError } from "@/server/api/errors";
import { backendPaths, unexpectedError } from "@/server/contract";
import { apiRequest } from "@/server/session/session";

/**
 * Kullanıcının kendi adresini yazar.
 *
 * Gövde çağıranda `readAddressWrite` ile süzülmüş olmalı: fazladan alan
 * `REQUEST_MALFORMED` olur ve kullanıcı nötr yedeği görür. Aynı uç hem
 * fatura (#28) hem başvuru (#133) ekranından çağrılır.
 */
export async function updateCurrentUserAddress(body: AddressWrite): Promise<CanonicalAddress> {
  const saved = canonicalAddressFrom(
    await apiRequest<unknown>(backendPaths.currentUserAddress, { method: "PUT", body }),
  );
  if (!saved) {
    throw new ApiError({
      status: 500,
      errorCode: unexpectedError,
      errorCategory: unexpectedError,
      message: "Kaydedilen adres okunamadı.",
    });
  }
  return saved;
}
