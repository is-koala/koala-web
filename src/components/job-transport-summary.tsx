import { formatMoney } from "@/lib/money";
import {
  formatStopTime,
  methodFor,
  shuttlesFor,
  transportDirectionLabels,
  transportDirections,
  transportMethodLabels,
  type PublicTransportSummary,
  type TransportDirection,
} from "@/transport/contract";

/**
 * Herkese açık ilan sayfasının ulaşım özeti (is-koala/koala-web#187).
 *
 * Sunucu bileşeni ve öyle kalmalı: ilan ayrıntısının betik bütçesi
 * (`docs/performance-accessibility-budget.md`) yeni istemci kodu
 * kaldırmıyor ve bu bölümün etkileşimi yok. Model `PublicTransportSummary`
 * plaka, şoför, tam adres ve koordinat taşımıyor — sızıntı tipte kapanıyor,
 * bileşende değil. Durak "Kadıköy · Caferağa · 20 Eyl 06:40" biçiminde.
 *
 * İşverenin kendi ilan sayfası da aynı gövdeyi çiziyor (`JobDetailBody`);
 * orada plan düzenleyicisi ayrı bir bölüm.
 */
export function JobTransportSummary({
  transport,
}: {
  transport: PublicTransportSummary | null;
}) {
  if (transport === null) return null;
  return (
    <section className="job-transport" aria-labelledby="job-transport-heading">
      <h2 id="job-transport-heading">Ulaşım</h2>
      <dl className="job-transport-methods">
        {transportDirections.map((direction) => (
          <div key={direction}>
            <dt>{transportDirectionLabels[direction]}</dt>
            <dd>{methodLine(transport, direction)}</dd>
          </div>
        ))}
      </dl>
      {transport.shuttles.length > 0 ? (
        <ul className="job-transport-shuttles">
          {transportDirections.flatMap((direction) =>
            shuttlesFor(transport.shuttles, direction).map((shuttle, index) => (
              <li key={`${direction}-${index}`}>
                <strong>{shuttle.name}</strong>
                <span className="muted"> · {transportDirectionLabels[direction]}</span>
                {shuttle.stops.length > 0 ? (
                  <ul className="job-transport-stops">
                    {shuttle.stops.map((stop, stopIndex) => (
                      <li key={stopIndex}>
                        {[stop.districtName, stop.neighborhood].filter(Boolean).join(" · ")}
                        {stop.districtName || stop.neighborhood ? " · " : ""}
                        <time dateTime={stop.scheduledAt}>{formatStopTime(stop.scheduledAt)}</time>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            )),
          )}
        </ul>
      ) : null}
      <p className="field-hint">
        Plaka, şoför ve durakların tam adresi yalnızca işe alınan çalışanla paylaşılır.
      </p>
    </section>
  );
}

/** "Servis (2 servis)" · "Yol parası: 150,00 ₺" · "Kendi imkânıyla". */
function methodLine(transport: PublicTransportSummary, direction: TransportDirection): string {
  const method = methodFor(transport, direction);
  const label = transportMethodLabels[method];
  if (method === "CASH_ALLOWANCE" && transport.allowanceAmount !== null) {
    return `${label}: ${formatMoney(transport.allowanceAmount, "TRY")}`;
  }
  if (method === "SHUTTLE") {
    const count = shuttlesFor(transport.shuttles, direction).length;
    return count > 0 ? `${label} (${count} servis)` : label;
  }
  return label;
}
