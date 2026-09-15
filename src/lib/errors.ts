import { addressErrors } from "@/address/errors";
import { disputeErrors } from "@/assignments/errors";
import { identityErrors } from "@/identity/errors";
import { jobManagementErrors } from "@/jobs/errors";
import { messagingErrors } from "@/messaging/errors";
import { paymentErrors } from "@/payments/errors";

import { companyErrors } from "./company-errors";
import { galleryErrors } from "./gallery-errors";
import {
  catalogErrorPresentation,
  publicErrors,
  type ErrorCatalog,
  type ErrorPresentation,
} from "./public-errors";

export type {
  ErrorAction,
  ErrorCatalog,
  ErrorPresentation,
  ErrorRecoveryAction,
} from "./error-presentation";
export { errorRecoveryAction } from "./error-presentation";
export { gateNotice, type GateNotice } from "./gate-notices";

/**
 * Oturumlu kabuğun tam hata kataloğu.
 *
 * Bu modül **yalnız kabuk** için: `(uygulama)` sayfaları, kabuk bileşenleri
 * ve oturumlu form eylemleri. Herkese açık yüzeyler (`(marketing)`,
 * giriş/kayıt formları) `@/lib/public-errors` okur, kök `error.tsx` yalnız
 * `error-presentation`'ın kodsuz yedeğini; ilan ayrıntısının betik bütçesi
 * bu ayrımla korunuyor (is-koala/koala-web#177,
 * sınır testi `src/lib/error-catalog-boundary.test.ts`). Yeni bir kabuk
 * cümlesi ait olduğu alan modülüne yazılır ve burada birleşir; herkese açık
 * bir sayfada görünecek cümle `public-errors.ts`'e gider ve önce bütçe ölçülür.
 */
const appErrors: ErrorCatalog = {
  ...publicErrors,
  ...identityErrors,
  ...jobManagementErrors,
  ...paymentErrors,
  ...disputeErrors,
  ...galleryErrors,
  ...companyErrors,
  ...messagingErrors,
  ...addressErrors,
  LEGAL_DELETION_ALREADY_REQUESTED: {
    title: "Silme talebin zaten var",
    message: "Bekleyen talebinin güncel durumunu görmek için sayfayı yenileyebilirsin.",
    action: "retry",
  },
};

export function errorPresentation(
  errorCode: string | null | undefined,
  status: number,
): ErrorPresentation {
  return catalogErrorPresentation(appErrors, errorCode, status);
}
