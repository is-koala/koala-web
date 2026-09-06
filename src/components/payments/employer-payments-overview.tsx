import Link from "next/link";

import { formatMoney } from "@/lib/money";
import type { EmployerAssignment } from "@/payments/contract";

import { PaymentStatusBadge } from "./employer-payment";

const filters = [
  ["all", "Tümü"],
  ["PENDING_COLLECTION", "Tahsilat bekleyen"],
  ["HELD_IN_ESCROW", "Emanette"],
  ["RELEASED_TO_WORKER", "Aktarılan"],
  ["FAILED", "Başarısız"],
  ["REFUNDED", "İade edilen"],
] as const;

export function EmployerPaymentsOverview({
  assignments,
  filter,
}: {
  assignments: readonly EmployerAssignment[];
  filter: string;
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
      <div className="payment-summary-grid">
        <SummaryCard title="Toplam tahsil edilen" totals={collected} />
        <SummaryCard title="Emanette bekleyen" totals={held} />
      </div>

      <nav className="payment-filters" aria-label="Ödeme durumu filtresi">
        {filters.map(([value, label]) => (
          <Link
            key={value}
            href={value === "all" ? "/isveren/odemeler" : `/isveren/odemeler?durum=${value}`}
            aria-current={filter === value ? "page" : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>

      {visible.length === 0 ? (
        <div role="status" className="state-card">
          <h2>Bu durumda ödeme yok</h2>
          <p>Başka bir durum filtresi seçebilirsin.</p>
        </div>
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

function SummaryCard({ title, totals }: { title: string; totals: ReadonlyMap<string, bigint> }) {
  return (
    <section className="payment-summary-card">
      <h2>{title}</h2>
      {totals.size === 0 ? (
        <p>0,00 ₺</p>
      ) : [...totals].map(([currency, minor]) => (
        <p key={currency}>{formatMoney(decimalFromMinor(minor), currency)}</p>
      ))}
    </section>
  );
}

/** Backend tutarlarını ikili kayan noktaya çevirmeden yalnız özet için toplar. */
function moneyTotals(assignments: readonly EmployerAssignment[]): ReadonlyMap<string, bigint> {
  const totals = new Map<string, bigint>();
  for (const assignment of assignments) {
    if (!assignment.pricing) continue;
    const minor = minorUnits(assignment.pricing.employerTotal);
    if (minor === null) continue;
    totals.set(
      assignment.pricing.currency,
      (totals.get(assignment.pricing.currency) ?? BigInt(0)) + minor,
    );
  }
  return totals;
}

function minorUnits(value: string): bigint | null {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) return null;
  return BigInt(match[1]) * BigInt(100) + BigInt(`${match[2] ?? ""}00`.slice(0, 2));
}

function decimalFromMinor(value: bigint): string {
  const whole = value / BigInt(100);
  const fraction = String(value % BigInt(100)).padStart(2, "0");
  return `${whole}.${fraction}`;
}
