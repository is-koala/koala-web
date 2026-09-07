import { unstable_rethrow } from "next/navigation";

import { ShellGate } from "@/app/(uygulama)/shell";
import { TalentPoolList } from "@/components/talent-pool-list";
import { ErrorState } from "@/components/states";
import { talentPoolPath } from "@/lib/app-routes";
import { failureView } from "@/server/form";
import { readTalentPool } from "@/server/applications/employer-review";
import { enterShell } from "@/server/session/viewer";

import { removeTalentPoolEntryAction } from "./actions";

type TalentPoolPageProps = {
  searchParams: Promise<{ sayfa?: string | string[] }>;
};

/**
 * Yetenek havuzu.
 *
 * Havuz bir ilana bağlı değil: bir kez beğenilen aday ilan kapandıktan sonra
 * da burada duruyor. Ekleme başvuru listesinde yapılıyor, bu sayfa yalnız
 * listeliyor ve çıkarıyor.
 */
export default function Page({ searchParams }: TalentPoolPageProps) {
  return (
    <ShellGate shell="employer" href={talentPoolPath}>
      <TalentPoolPageBody searchParams={searchParams} />
    </ShellGate>
  );
}

export async function TalentPoolPageBody({ searchParams }: TalentPoolPageProps) {
  const context = await enterShell();
  if (context.viewer === null) return null;

  const query = await searchParams;
  const result = await readTalentPool(pageIndex(query.sayfa))
    .then((pool) => ({ pool }))
    .catch((error: unknown) => {
      unstable_rethrow(error);
      return { failure: failureView(error) };
    });

  if ("failure" in result) {
    return <ErrorState errorCode={result.failure.errorCode} status={result.failure.httpStatus} />;
  }

  return (
    <section className="app-panel talent-pool-page">
      <p className="eyebrow">İşveren paneli</p>
      <h1>Yetenek havuzu</h1>
      <p className="lede">
        Başvuru listesinde beğendiğin adaylar burada birikiyor; yeni bir ilan açtığında
        onlara buradan ulaşabilirsin.
      </p>

      {result.pool.content.length === 0 ? (
        <div role="status" className="state-card">
          <h2>Yetenek havuzun boş</h2>
          <p>Bir ilanın başvuru listesinden adayları havuza ekleyebilirsin.</p>
        </div>
      ) : (
        <TalentPoolList pool={result.pool} action={removeTalentPoolEntryAction} />
      )}
    </section>
  );
}

/** Adres çubuğu bire dayalı sayar; backend sıfıra. Okunamayan değer ilk sayfa. */
function pageIndex(value: string | string[] | undefined): number {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return 0;
  return Math.max(0, Number(value) - 1);
}
