import Link from "next/link";

import { formatDateTime } from "@/lib/dates";
import { formatMoney, sumMoney } from "@/lib/money";
import {
  payoutStatusDescription,
  payoutStatusLabel,
  type WorkerPayout,
} from "@/payments/payouts";
import { StatusBadge, payoutStatusTone } from "@/components/ui";

export function EarningsList({ payouts }: { payouts: readonly WorkerPayout[] }) {
  const completedTotals = totalsFor(payouts, (payout) => payout.status === "COMPLETED");
  const pendingTotals = totalsFor(
    payouts,
    (payout) => payout.status === "PENDING" || payout.status === "PROCESSING",
  );

  return (
    <>
      <section className="earnings-summary" aria-label="Kazanç özeti">
        <MoneyTotal
          testId="completed-total"
          label="Tamamlanan kazanç"
          totals={completedTotals}
        />
        <MoneyTotal
          testId="pending-total"
          label="Bekleyen aktarım"
          totals={pendingTotals}
        />
      </section>

      <aside className="escrow-notice">
        <strong>Ödemen güvende tutulur.</strong>
        <p>
          İşverenin ödediği çalışan ücreti iş tamamlanana kadar Koala’da tutulur.
          Açık bir uyuşmazlık varsa para aktarımı uyuşmazlık çözülene kadar bekler.
        </p>
      </aside>

      <ul className="earnings-list">
        {payouts.map((payout) => (
          <li key={payout.id} className="earnings-item">
            <div className="earnings-item-heading">
              <strong>{formatMoney(payout.amount, payout.currency)}</strong>
              <StatusBadge tone={payoutStatusTone(payout.status)}>
                {payoutStatusLabel[payout.status]}
              </StatusBadge>
            </div>
            {payout.jobTitle || payout.employerName ? (
              <p className="earnings-item-job">
                {payout.jobTitle ? <strong>{payout.jobTitle}</strong> : null}
                {payout.jobTitle && payout.employerName ? " · " : null}
                {payout.employerName ? <span>{payout.employerName}</span> : null}
              </p>
            ) : null}
            {/*
              İki an ayrı satır: emanetten çıkış anı ile paranın hesaba geçtiği
              an aynı şey değil ve tek bir tarih hangisi olduğunu söylemiyordu.
              Backend 0.9.25 ikisini `releasedAt`/`settledAt` diye adlandırıyor
              (`createdAt`/`completedAt` ile aynı değer); eski sunucuda ad yok,
              değer var — ikincisine düşülüyor. Tamamlanmamış aktarımda ikinci
              satır yok.
            */}
            <dl className="earnings-item-dates">
              <PayoutMoment term="Çıkışa alındı" at={payout.releasedAt ?? payout.createdAt} />
              <PayoutMoment term="Tamamlandı" at={payout.settledAt ?? payout.completedAt} />
            </dl>
            <PayoutDetail payout={payout} />
            {payout.failureMessage || payout.status === "FAILED" ? (
              <div className="payout-failure">
                <p>{payout.failureMessage ?? "Aktarım tamamlanamadı. Destekten yardım alabilirsin."}</p>
                <Link className="text-link" href="/iletisim">Destekten yardım al</Link>
              </div>
            ) : null}
            <Link className="text-link" href={`/panel/is/${payout.assignmentId}`}>
              İşi görüntüle
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

function PayoutMoment({ term, at }: { term: string; at: string | null }) {
  if (!at) return null;
  return (
    <div>
      <dt>{term}</dt>
      <dd><time dateTime={at}>{formatDateTime(at)}</time></dd>
    </div>
  );
}

/**
 * Satır ayrıntısı: paranın gittiği hesap, sağlayıcının referansı ve durumun
 * ne demek olduğu. Hesap kaydı silinmişse ya da sunucu alanı hiç
 * göndermiyorsa "—": boş bırakmak "hesap yok" ile "bilgi yok"u aynı gösterir,
 * tire ikisini de "burada gösterilemiyor" diye okutur ve tam IBAN zaten
 * hiçbir yanıtta gelmiyor. Başarısız çıkışta sağlayıcının nedeni burada
 * yinelenmiyor: güvenli biçimi (`failureMessage`) ve destek bağlantısı
 * hemen üstteki `payout-failure` bloğunda, durum satırı sözlük cümlesini
 * söyler.
 */
function PayoutDetail({ payout }: { payout: WorkerPayout }) {
  return (
    <details className="earnings-item-detail" data-testid="payout-detail">
      <summary>Hakediş ayrıntısı</summary>
      <dl className="earnings-item-dates">
        <div>
          <dt>Banka hesabı</dt>
          <dd>{payout.maskedIban ?? missingDetail}</dd>
        </div>
        <div>
          <dt>Sağlayıcı referansı</dt>
          <dd>{payout.providerReference ?? missingDetail}</dd>
        </div>
        <div>
          <dt>Durum</dt>
          <dd>{payoutStatusDescription[payout.status]}</dd>
        </div>
      </dl>
    </details>
  );
}

const missingDetail = "—";

function MoneyTotal({
  testId,
  label,
  totals,
}: {
  testId: string;
  label: string;
  totals: ReadonlyMap<string, readonly string[]>;
}) {
  return (
    <div data-testid={testId}>
      <span>{label}</span>
      <strong>{formatTotals(totals)}</strong>
    </div>
  );
}

function totalsFor(
  payouts: readonly WorkerPayout[],
  include: (payout: WorkerPayout) => boolean,
): ReadonlyMap<string, readonly string[]> {
  const totals = new Map<string, string[]>();
  for (const payout of payouts) {
    if (!include(payout)) continue;
    const amounts = totals.get(payout.currency) ?? [];
    amounts.push(payout.amount);
    totals.set(payout.currency, amounts);
  }
  return totals;
}

function formatTotals(totals: ReadonlyMap<string, readonly string[]>): string {
  if (totals.size === 0) return formatMoney("0.00", "TRY");
  return [...totals]
    .map(([currency, amounts]) => {
      const total = sumMoney(amounts);
      return total === null ? "—" : formatMoney(total, currency);
    })
    .join(" · ");
}
