import { unstable_rethrow } from "next/navigation";

import { ShellGate } from "@/app/(uygulama)/shell";
import { EmployerPaymentsOverview } from "@/components/payments/employer-payments-overview";
import { EmptyState, ErrorState } from "@/components/states";
import { PageHeader, PagePanel } from "@/components/ui";
import { failureView } from "@/server/form";
import { readAllEmployerAssignments } from "@/server/payments/payments";
import { enterShell } from "@/server/session/viewer";

type EmployerPaymentsPageProps = {
  searchParams: Promise<{ durum?: string | string[] }>;
};

const knownFilters = new Set([
  "PENDING_COLLECTION",
  "HELD_IN_ESCROW",
  "RELEASED_TO_WORKER",
  "FAILED",
  "REFUNDED",
]);

export default function Page({ searchParams }: EmployerPaymentsPageProps) {
  return (
    <ShellGate shell="employer" href="/isveren/odemeler">
      <EmployerPaymentsPage searchParams={searchParams} />
    </ShellGate>
  );
}

export async function EmployerPaymentsPage({ searchParams }: EmployerPaymentsPageProps) {
  const context = await enterShell();
  if (context.failure !== null || context.viewer === null) return null;

  const result = await readAllEmployerAssignments()
    .then((collection) => ({ collection }))
    .catch((error: unknown) => {
      unstable_rethrow(error);
      return { failure: failureView(error) };
    });
  if ("failure" in result) {
    return <ErrorState errorCode={result.failure.errorCode} status={result.failure.httpStatus} />;
  }

  const { durum } = await searchParams;
  const filter = typeof durum === "string" && knownFilters.has(durum) ? durum : "all";

  return (
    <PagePanel className="employer-payments-page">
      <PageHeader
        eyebrow="İşveren paneli"
        title="Ödemeler"
        lede="Tahsil edilen, emanette bekleyen ve işçiye aktarılan ödemeleri atamalarıyla birlikte gör."
      />
      {result.collection.assignments.length === 0 ? (
        <EmptyState kind="employerAssignments" />
      ) : (
        <EmployerPaymentsOverview
          assignments={result.collection.assignments}
          filter={filter}
          totalsComplete={result.collection.totalsComplete}
        />
      )}
    </PagePanel>
  );
}
