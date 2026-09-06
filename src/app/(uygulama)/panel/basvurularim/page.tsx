import { unstable_rethrow } from "next/navigation";

import type { ApplicationFilter } from "@/applications/contract";
import { ApplicationList } from "@/components/application-list";
import { ErrorState } from "@/components/states";
import { readWorkerApplications } from "@/server/applications/applications";
import { failureView } from "@/server/form";
import { enterShell } from "@/server/session/viewer";

import { withdrawApplicationAction } from "./actions";

const filters = new Set<ApplicationFilter>(["ALL", "APPLIED", "ACCEPTED", "REJECTED", "WITHDRAWN"]);

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
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
    <section className="app-panel applications-page">
      <p className="eyebrow">İş arayan paneli</p>
      <h1>Başvurularım</h1>
      <p className="lede">Başvurularının durumunu izle, açık başvurularını yönet.</p>
      <ApplicationList
        initialPage={result.applications}
        filter={filter}
        action={withdrawApplicationAction}
      />
    </section>
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
