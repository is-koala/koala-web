import Link from "next/link";

import { formatDateTime } from "@/lib/dates";
import { formatMoney, sumMoney } from "@/lib/money";
import type { PayoutStatus, WorkerPayout } from "@/payments/payouts";
import { StatusBadge, payoutStatusTone } from "@/components/ui";

const payoutStatusLabel: Readonly<Record<PayoutStatus, string>> = {
  PENDING: "Aktarım bekliyor",
  PROCESSING: "Aktarılıyor",
  COMPLETED: "Ödendi",
  FAILED: "Aktarılamadı",
  UNKNOWN: "Durum güncelleniyor",
};

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
              İki an ayrı satır: kaydın açıldığı an ile paranın hesaba geçtiği
              an aynı şey değil ve tek bir tarih hangisi olduğunu söylemiyordu.
              Tamamlanmamış aktarımda ikinci satır yok.
            */}
            <dl className="earnings-item-dates">
              <div>
                <dt>Oluşturuldu</dt>
                <dd><time dateTime={payout.createdAt}>{formatDateTime(payout.createdAt)}</time></dd>
              </div>
              {payout.completedAt ? (
                <div>
                  <dt>Tamamlandı</dt>
                  <dd><time dateTime={payout.completedAt}>{formatDateTime(payout.completedAt)}</time></dd>
                </div>
              ) : null}
            </dl>
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
