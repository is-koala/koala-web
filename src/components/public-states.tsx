import type { FormState } from "@/lib/form-state";
import { publicErrorPresentation } from "@/lib/public-errors";

import { ErrorCard } from "./error-card";

/**
 * Herkese açık yüzeylerin hata kartı ve form bandı.
 *
 * `states.tsx`'teki `ErrorState`/`FormAlert` ile aynı görünüm, farklı
 * katalog: bunlar `@/lib/public-errors`'ı okur ve kabuğun ödeme, şirket,
 * mesajlaşma cümlelerini taşımaz. İlan ayrıntısı, kök `error.tsx` ve
 * giriş/kayıt formları bunları kullanır; `(uygulama)` kabuğu kullanmaz —
 * kabuk kodu buradan içe aktarırsa kabuk cümleleri aile metnine düşer
 * (sınır testi `src/lib/error-catalog-boundary.test.ts`).
 */
export function PublicErrorState({
  errorCode,
  status,
  onRetry,
}: {
  errorCode?: string;
  status: number;
  onRetry?: () => void;
}) {
  return <ErrorCard presentation={publicErrorPresentation(errorCode, status)} onRetry={onRetry} />;
}

/** Formun üst bandındaki hata; alan bazlı mesajlar kendi alanlarının altında. */
export function PublicFormAlert({ state }: { state: FormState }) {
  if (state.status !== "error") return null;
  return <PublicErrorState errorCode={state.errorCode} status={state.httpStatus} />;
}
