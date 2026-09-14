import { unstable_rethrow } from "next/navigation";

import { ShellGate } from "@/app/(uygulama)/shell";
import type { ApplicationFilter } from "@/applications/contract";
import { ApplicationList } from "@/components/application-list";
import { ErrorState } from "@/components/states";
import { PageHeader, PagePanel } from "@/components/ui";
import { readWorkerApplications } from "@/server/applications/applications";
import { failureView } from "@/server/form";
import { enterShell } from "@/server/session/viewer";

import { withdrawApplicationAction } from "./actions";

const filters = new Set<ApplicationFilter>(["ALL", "APPLIED", "ACCEPTED", "REJECTED", "WITHDRAWN"]);

type ApplicationsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function Page({ searchParams }: ApplicationsPageProps) {
  return (
    <ShellGate shell="worker" href="/panel/basvurularim">
      <ApplicationsPage searchParams={searchParams} />
    </ShellGate>
  );
}

export async function ApplicationsPage({ searchParams }: ApplicationsPageProps) {
  const context = await enterShell();
  if (context.failure !== null || context.viewer === null) return null;

  const query = await searchParams;
  const filter = parseFilter(query.status);
  const page = parsePage(query.page);
  const result = await readWorkerApplications({ status: filter, page })
    .then((applications) => ({ applications }))
    .catch((error: unknown) => {
      unstable_rethrow(error);
      return { failure: failureView(error) };
    });

  if ("failure" in result) {
    return <ErrorState errorCode={result.failure.errorCode} status={result.failure.httpStatus} />;
  }

  return (
    <PagePanel className="applications-page">
      <PageHeader
        eyebrow="İş arayan paneli"
        title="Başvurularım"
        lede="Başvurularının durumunu izle, açık başvurularını yönet."
      />
      <ApplicationList
        initialPage={result.applications}
        filter={filter}
        requestPage={page}
        action={withdrawApplicationAction}
      />
    </PagePanel>
  );
}

function parseFilter(value: string | string[] | undefined): ApplicationFilter {
  return typeof value === "string" && filters.has(value as ApplicationFilter)
    ? (value as ApplicationFilter)
    : "ALL";
}

function parsePage(value: string | string[] | undefined): number {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return 0;
  const page = Number(value);
  return Number.isSafeInteger(page) ? page : 0;
}
