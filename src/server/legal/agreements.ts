import "server-only";

import type { Agreement } from "@/lib/consents";
import { apiFetch } from "@/server/api/client";
import { backendPaths } from "@/server/contract";
import { anonymousCaller } from "@/server/session/session";

/** `AgreementVersionDto`; `locale` ve `effectiveFrom` ekranda kullanılmıyor. */
type AgreementVersionDto = {
  id: string;
  type: Agreement["type"];
  version: string;
  contentUrl: string | null;
  mandatory: boolean;
};

/**
 * Yürürlükteki sözleşmeleri okur.
 *
 * Uç herkese açık (`SecurityConfig`), ama backend web isteğinde cihaz
 * kimliğini beklediği için çağrı yine oturum bağlamıyla gider. Liste boş
 * gelirse kayıt formu rıza kutusu çizmez; zorunlu onay denetimini backend
 * yine de kendisi yapar.
 */
export async function readAgreements(): Promise<Agreement[]> {
  const versions = await apiFetch<AgreementVersionDto[] | null>(backendPaths.agreements, {
    ...(await anonymousCaller()),
  });

  return (versions ?? []).map((version) => ({
    id: version.id,
    type: version.type,
    version: version.version,
    mandatory: version.mandatory,
    contentUrl: version.contentUrl ?? null,
  }));
}
