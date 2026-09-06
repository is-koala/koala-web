import { unstable_rethrow } from "next/navigation";

import { ShellGate } from "@/app/(uygulama)/shell";
import { EarningsList } from "@/components/earnings-list";
import { EmptyState, ErrorState } from "@/components/states";
import { failureView } from "@/server/form";
import { readWorkerPayouts } from "@/server/payments/payouts";
import { enterShell } from "@/server/session/viewer";

export default function Page() {
  return (
    <ShellGate shell="worker" href="/panel/kazanclarim">
      <EarningsPage />
    </ShellGate>
  );
}

export async function EarningsPage() {
  const context = await enterShell();
  if (context.failure !== null || context.viewer === null) return null;

  const result = await readWorkerPayouts()
    .then((payouts) => ({ payouts }))
    .catch((error: unknown) => {
      unstable_rethrow(error);
      return { failure: failureView(error) };
    });

  if ("failure" in result) {
    return <ErrorState errorCode={result.failure.errorCode} status={result.failure.httpStatus} />;
  }

  return (
    <section className="app-panel earnings-page">
      <p className="eyebrow">Çalışan paneli</p>
      <h1>Kazançlarım</h1>
      <p className="lede">
        Tamamlanan ve aktarımı süren çalışan ücretlerini burada takip edebilirsin.
      </p>
      {result.payouts.length === 0 ? (
        <EmptyState kind="payouts" />
      ) : (
        <EarningsList payouts={result.payouts} />
      )}
    </section>
  );
}
