import Link from "next/link";

import { formatDateTime } from "@/lib/dates";
import { formatMoney, sumMoney } from "@/lib/money";
import type { PayoutStatus, WorkerPayout } from "@/payments/payouts";

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
              <span className={`payout-status payout-status-${payout.status.toLowerCase()}`}>
                {payoutStatusLabel[payout.status]}
              </span>
            </div>
            <time dateTime={payout.completedAt ?? payout.createdAt}>
              {formatDateTime(payout.completedAt ?? payout.createdAt)}
            </time>
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
