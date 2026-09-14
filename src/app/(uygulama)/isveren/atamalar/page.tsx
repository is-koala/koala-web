import { unstable_rethrow } from "next/navigation";

import { ShellGate } from "@/app/(uygulama)/shell";
import { EmployerAssignmentList } from "@/components/payments/employer-assignment-list";
import { EmptyState, ErrorState } from "@/components/states";
import { PageHeader, PagePanel } from "@/components/ui";
import { failureView } from "@/server/form";
import { readEmployerAssignments } from "@/server/payments/payments";
import { enterShell } from "@/server/session/viewer";

type EmployerAssignmentsPageProps = {
  searchParams: Promise<{ sayfa?: string | string[] }>;
};

export default function Page({ searchParams }: EmployerAssignmentsPageProps) {
  return (
    <ShellGate shell="employer" href="/isveren/atamalar">
      <EmployerAssignmentsPage searchParams={searchParams} />
    </ShellGate>
  );
}

export async function EmployerAssignmentsPage({ searchParams }: EmployerAssignmentsPageProps) {
  const context = await enterShell();
  if (context.failure !== null || context.viewer === null) return null;

  const query = await searchParams;
  const pageNumber = pageIndex(query.sayfa);
  const result = await readEmployerAssignments(pageNumber)
    .then((assignments) => ({ assignments }))
    .catch((error: unknown) => {
      unstable_rethrow(error);
      return { failure: failureView(error) };
    });

  if ("failure" in result) {
    return <ErrorState errorCode={result.failure.errorCode} status={result.failure.httpStatus} />;
  }

  return (
    <PagePanel className="assignments-page">
      <PageHeader
        eyebrow="İşveren paneli"
        title="Atamalar"
        lede="İşçilerin onay durumunu ve her atamanın ödeme adımını takip et."
      />
      {result.assignments.content.length === 0 ? (
        <EmptyState kind="employerAssignments" />
      ) : (
        <EmployerAssignmentList assignments={result.assignments} />
      )}
    </PagePanel>
  );
}

function pageIndex(value: string | string[] | undefined): number {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return 0;
  return Math.max(0, Number(value) - 1);
}
