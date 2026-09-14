import type { Metadata } from "next";
import { unstable_rethrow } from "next/navigation";

import { ShellGate } from "@/app/(uygulama)/shell";
import { EarningsList } from "@/components/earnings-list";
import { EarningsRefresh } from "@/components/earnings-refresh";
import { EmptyState, ErrorState } from "@/components/states";
import { PageHeader, PagePanel } from "@/components/ui";
import { listBankAccounts } from "@/server/account-settings/settings";
import { failureView } from "@/server/form";
import { readWorkerPayouts } from "@/server/payments/payouts";
import { enterShell } from "@/server/session/viewer";

import { BankAccountsSection } from "./bank-accounts-section";

export const metadata: Metadata = {
  title: "Kazançlarım",
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <ShellGate shell="worker" href="/panel/kazanclarim">
      <EarningsPage />
    </ShellGate>
  );
}

type Loaded<T> = { data: T } | { failure: { errorCode: string; httpStatus: number } };

/**
 * Kazançlar ve ödeme hesabı bir arada.
 *
 * İki liste ayrı sonuçlar: banka hesapları okunamazsa ödeme çıkışları yine
 * çizilir, tersi de öyle. Kullanıcının asıl geldiği şey ödemesi; IBAN kartı
 * ödemenin **nereye** gideceğini söylüyor ve eksikse ödeme çıkışı hiç
 * başlamıyor (`JOB_ASSIGNMENT_IBAN_NOT_PROVIDED_FOR_WORKER`).
 */
export async function EarningsPage() {
  const context = await enterShell();
  if (context.failure !== null || context.viewer === null) return null;

  const [payouts, bankAccounts] = await Promise.all([
    load(readWorkerPayouts()),
    load(listBankAccounts()),
  ]);

  return (
    <PagePanel className="earnings-page">
      <EarningsRefresh />
      <PageHeader
        eyebrow="Çalışan paneli"
        title="Kazançlarım"
        lede="Tamamlanan ve aktarımı süren çalışan ücretlerini burada takip edebilirsin."
      />
      {"failure" in payouts ? (
        <ErrorState errorCode={payouts.failure.errorCode} status={payouts.failure.httpStatus} />
      ) : payouts.data.length === 0 ? (
        <EmptyState kind="payouts" />
      ) : (
        <EarningsList payouts={payouts.data} />
      )}
      {"failure" in bankAccounts ? (
        <ErrorState
          errorCode={bankAccounts.failure.errorCode}
          status={bankAccounts.failure.httpStatus}
        />
      ) : (
        <BankAccountsSection accounts={bankAccounts.data} />
      )}
    </PagePanel>
  );
}

async function load<T>(request: Promise<T>): Promise<Loaded<T>> {
  try {
    return { data: await request };
  } catch (error) {
    unstable_rethrow(error);
    return { failure: failureView(error) };
  }
}
