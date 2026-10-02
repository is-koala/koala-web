import { Suspense, use } from "react";

import { loadBackendErrorFamilies } from "@/lib/backend-error-families";
import { publicCatalogPresentation, publicErrorPresentation } from "@/lib/public-errors";

import { ErrorCard } from "./error-card";

type PublicErrorStateProps = {
  errorCode?: string;
  status: number;
  onRetry?: () => void;
};

/**
 * Herkese açık yüzeylerin hata kartı.
 *
 * `states.tsx`'teki `ErrorState` ile aynı görünüm, farklı katalog: bu
 * `@/lib/public-errors`'ı okur ve kabuğun ödeme, şirket, mesajlaşma
 * cümlelerini taşımaz. İlan listesi ve hesap doğrulama sunucuda, giriş/kayıt
 * ve başvuru formları `PublicFormAlert` üzerinden istemcide çizer; `(uygulama)`
 * kabuğu kullanmaz — kabuk kodu buradan içe aktarırsa kabuk cümleleri aile
 * metnine düşer (sınır testi `src/lib/error-catalog-boundary.test.ts`).
 *
 * Kod küçük katalogdaysa kart hemen çizilir. Değilse doğru metin 244 kodun
 * aile haritasında ve harita ilk yüke girmiyor (is-koala/koala-web#184):
 * kart harita gelene kadar hiç çizilmez (`fallback={null}`), durum koduna
 * göre seçilmiş geçici ve yanlış bir cümle göstermez. `role="alert"` metinle
 * birlikte bir kez duyurulur.
 */
export function PublicErrorState({ errorCode, status, onRetry }: PublicErrorStateProps) {
  const presentation = publicCatalogPresentation(errorCode, status);
  if (presentation) return <ErrorCard presentation={presentation} onRetry={onRetry} />;

  return (
    <Suspense fallback={null}>
      <FamilyErrorCard errorCode={errorCode} status={status} onRetry={onRetry} />
    </Suspense>
  );
}

function FamilyErrorCard({ errorCode, status, onRetry }: PublicErrorStateProps) {
  const families = use(loadBackendErrorFamilies());
  return (
    <ErrorCard
      presentation={publicErrorPresentation(errorCode, status, families)}
      onRetry={onRetry}
    />
  );
}
