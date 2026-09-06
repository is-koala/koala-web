import Link from "next/link";

import { formatMoney } from "@/components/assignment-presenters";
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
          Açık bir uyuşmazlık varsa para aktarımı sonuçlanana kadar bekler.
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
              {formatPayoutDate(payout.completedAt ?? payout.createdAt)}
            </time>
            {payout.status === "FAILED" ? (
              <div className="payout-failure">
                <p>{payout.failureReason ?? "Aktarım tamamlanamadı."}</p>
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
  totals: ReadonlyMap<string, string>;
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
): ReadonlyMap<string, string> {
  const totals = new Map<string, string>();
  for (const payout of payouts) {
    if (!include(payout)) continue;
    const minorUnits = toMinorUnits(payout.amount);
    if (minorUnits === null) continue;
    totals.set(payout.currency, addUnsignedIntegers(totals.get(payout.currency) ?? "0", minorUnits));
  }
  return totals;
}

function toMinorUnits(amount: string): string | null {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(amount.trim());
  if (!match) return null;
  return `${match[1]}${(match[2] ?? "").padEnd(2, "0")}`.replace(/^0+(?=\d)/, "");
}

function formatTotals(totals: ReadonlyMap<string, string>): string {
  if (totals.size === 0) return formatMoney("0.00", "TRY");
  return [...totals]
    .map(([currency, minorUnits]) => formatMoney(fromMinorUnits(minorUnits), currency))
    .join(" · ");
}

function fromMinorUnits(amount: string): string {
  const padded = amount.padStart(3, "0");
  return `${padded.slice(0, -2)}.${padded.slice(-2)}`;
}

function addUnsignedIntegers(left: string, right: string): string {
  let carry = 0;
  let result = "";
  for (let offset = 1; offset <= Math.max(left.length, right.length); offset += 1) {
    const sum = Number(left.at(-offset) ?? 0) + Number(right.at(-offset) ?? 0) + carry;
    result = `${sum % 10}${result}`;
    carry = Math.floor(sum / 10);
  }
  return `${carry || ""}${result}`.replace(/^0+(?=\d)/, "");
}

function formatPayoutDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Istanbul",
  }).format(date);
}
