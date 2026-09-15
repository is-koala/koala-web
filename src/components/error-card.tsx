import Link from "next/link";

import { errorRecoveryAction, type ErrorPresentation } from "@/lib/error-presentation";

import { ErrorRetryAction } from "./error-retry-action";

/**
 * Hata kartının katalogsuz gövdesi.
 *
 * Hangi kataloğun okunacağına çağıran karar verir: `ErrorState` (kabuk,
 * `@/lib/errors`) ve `PublicErrorState` (herkese açık yüzeyler,
 * `@/lib/public-errors`) aynı kartı çizer, yalnız metni farklı yerden alır.
 * Kart bu yüzden katalog içe aktarmıyor; aksi hâlde ilan sayfası kabuğun
 * bütün cümlelerini yeniden taşırdı (is-koala/koala-web#177).
 */
export function ErrorCard({
  presentation,
  onRetry,
}: {
  presentation: ErrorPresentation;
  /** Yalnız Client Component çağıranları retry kararının gerçek davranışını sağlar. */
  onRetry?: () => void;
}) {
  const recovery = errorRecoveryAction(presentation.action);
  return (
    <div role="alert" className="state-card state-card-error">
      <h2>{presentation.title}</h2>
      <p>{presentation.message}</p>
      {recovery?.kind === "link" ? (
        <Link className="text-link state-action" href={recovery.href}>
          {recovery.label}
        </Link>
      ) : null}
      {recovery?.kind === "retry" && onRetry ? (
        <ErrorRetryAction label={recovery.label} onRetry={onRetry} />
      ) : null}
    </div>
  );
}
