import { addressErrors } from "@/address/errors";
import { disputeErrors } from "@/assignments/errors";
import { identityErrors } from "@/identity/errors";
import { jobManagementErrors } from "@/jobs/errors";
import { messagingErrors } from "@/messaging/errors";
import { paymentErrors } from "@/payments/errors";

import { accountErrors } from "./account-errors";
import { companyErrors } from "./company-errors";
import type { ErrorCatalog, ErrorPresentation } from "./error-presentation";
import { galleryErrors } from "./gallery-errors";
import { catalogErrorPresentation, publicErrors } from "./public-errors";

// Kabuk kodu `errorRecoveryAction`'ı kart üzerinden, `gateNotice`'i kendi
// modülünden okur; ikisi burada `errors.test.ts`'in tek kapıdan baktığı
// katalog arayüzü için duruyor.
export { errorRecoveryAction } from "./error-presentation";
export { gateNotice } from "./gate-notices";

/**
 * Oturumlu kabuğun tam hata kataloğu.
 *
 * Bu modül **yalnız kabuk** için: `(uygulama)` sayfaları, kabuk bileşenleri
 * ve oturumlu form eylemleri. Herkese açık yüzeyler (`(marketing)`,
 * giriş/kayıt formları) `@/lib/public-errors` okur, kök `error.tsx` yalnız
 * `error-presentation`'ın kodsuz yedeğini; ilan ayrıntısının betik bütçesi
 * bu ayrımla korunuyor (is-koala/koala-web#177,
 * sınır testi `src/lib/error-catalog-boundary.test.ts`). Yeni bir kabuk
 * cümlesi ait olduğu alan modülüne yazılır (alanı yoksa `account-errors.ts`
 * gibi yeni bir dosya açılır) ve burada birleşir; herkese açık
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
  ...accountErrors,
};

export function errorPresentation(
  errorCode: string | null | undefined,
  status: number,
): ErrorPresentation {
  return catalogErrorPresentation(appErrors, errorCode, status);
}
