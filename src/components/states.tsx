import { errorPresentation } from "@/lib/errors";
import type { FormState } from "@/lib/form-state";

import { ErrorCard } from "./error-card";

export { EmptyState, LoadingState } from "./placeholder-states";

/**
 * Kabuğun hata kartı: `@/lib/errors` içindeki tam kataloğu okur.
 *
 * Herkese açık yüzeyler (`(marketing)`, kök `error.tsx`, giriş/kayıt
 * formları) bunu değil `PublicErrorState`'i kullanır (`public-states.tsx`);
 * bu dosya tam kataloğu taşıdığı için ilan ayrıntısının betik bütçesine
 * sığmıyor (is-koala/koala-web#177).
 */
export function ErrorState({
  errorCode,
  status,
  onRetry,
}: {
  errorCode?: string;
  status: number;
  /** Yalnız Client Component çağıranları retry kararının gerçek davranışını sağlar. */
  onRetry?: () => void;
}) {
  return <ErrorCard presentation={errorPresentation(errorCode, status)} onRetry={onRetry} />;
}

/**
 * Kabuk formunun üst bandındaki hata.
 *
 * Metin `errorPresentation` üzerinden `errorCode` ile seçilir; alan bazlı
 * mesajlar ayrıca kendi alanlarının altında görünür. `form-controls.tsx`'te
 * değil burada, çünkü katalog okuyan tek form denetimi bu ve öbür denetimler
 * herkese açık formlarda da kullanılıyor.
 */
export function FormAlert({ state }: { state: FormState }) {
  if (state.status !== "error") return null;
  return <ErrorState errorCode={state.errorCode} status={state.httpStatus} />;
}
