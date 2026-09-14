import Link from "next/link";

import { EmptyStateCard, LinkTabs } from "@/components/ui";
import { formatMoney, sumMoney } from "@/lib/money";
import type { EmployerAssignment } from "@/payments/contract";

import { PaymentStatusBadge } from "./employer-payment";

const filters = [
  ["all", "Tümü"],
  ["PENDING_COLLECTION", "Tahsilat bekleyen"],
  ["HELD_IN_ESCROW", "Emanette"],
  ["RELEASED_TO_WORKER", "Aktarılan"],
  ["FAILED", "Başarısız"],
  ["REFUNDED", "İade sürecinde"],
] as const;

export function EmployerPaymentsOverview({
  assignments,
  filter,
  totalsComplete,
}: {
  assignments: readonly EmployerAssignment[];
  filter: string;
  totalsComplete: boolean;
}) {
  const visible = filter === "all"
    ? assignments
    : assignments.filter((assignment) => assignment.paymentStatus === filter);
  const collected = moneyTotals(assignments.filter((assignment) =>
    assignment.paymentStatus === "HELD_IN_ESCROW" ||
    assignment.paymentStatus === "RELEASED_TO_WORKER"));
  const held = moneyTotals(assignments.filter((assignment) =>
    assignment.paymentStatus === "HELD_IN_ESCROW"));

  return (
    <div className="payments-overview">
      {!totalsComplete ? (
        <p role="status" className="state-card">
          Bu özet yalnız listelenen atamaları kapsar; tam toplam değildir.
        </p>
      ) : null}
      <div className="payment-summary-grid">
        <SummaryCard
          title={totalsComplete ? "Toplam tahsil edilen" : "Listelenen atamalarda tahsil edilen"}
          totals={collected}
        />
        <SummaryCard title="Emanette bekleyen" totals={held} />
      </div>

      <LinkTabs
        label="Ödeme durumu filtresi"
        items={filters.map(([value, label]) => ({
          href: value === "all" ? "/isveren/odemeler" : `/isveren/odemeler?durum=${value}`,
          label,
          current: filter === value,
        }))}
      />

      {visible.length === 0 ? (
        <EmptyStateCard
          title="Bu durumda ödeme yok"
          message="Başka bir durum filtresi seçebilirsin."
          mascot="employer"
        />
      ) : (
        <div className="payment-overview-list">
          {visible.map((assignment) => (
            <article key={assignment.id} className="payment-overview-card">
              <div>
                <h2>{assignment.title}</h2>
                <p>{assignment.workerName || "İşçi bilgisi bekleniyor"}</p>
              </div>
              <PaymentStatusBadge status={assignment.paymentStatus} />
              <strong>
                {assignment.pricing
                  ? formatMoney(assignment.pricing.employerTotal, assignment.pricing.currency)
                  : "Tutar bekleniyor"}
              </strong>
              <Link className="text-link" href={`/isveren/atama/${encodeURIComponent(assignment.id)}/odemeler`}>
                Deneme geçmişi
              </Link>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  title,
  totals,
}: {
  title: string;
  totals: ReadonlyMap<string, readonly string[]>;
}) {
  return (
    <section className="payment-summary-card">
      <h2>{title}</h2>
      {totals.size === 0 ? (
        <p>0,00 ₺</p>
      ) : [...totals].map(([currency, amounts]) => {
        const total = sumMoney(amounts);
        return <p key={currency}>{total === null ? "—" : formatMoney(total, currency)}</p>;
      })}
    </section>
  );
}

/** Backend tutarlarını ikili kayan noktaya çevirmeden yalnız özet için toplar. */
function moneyTotals(assignments: readonly EmployerAssignment[]): ReadonlyMap<string, readonly string[]> {
  const totals = new Map<string, string[]>();
  for (const assignment of assignments) {
    if (!assignment.pricing) continue;
    const amounts = totals.get(assignment.pricing.currency) ?? [];
    amounts.push(assignment.pricing.employerTotal);
    totals.set(assignment.pricing.currency, amounts);
  }
  return totals;
}
