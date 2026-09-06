"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ErrorState } from "@/components/states";

export type PaymentResultCheck =
  | { status: "pending" }
  | { status: "resolved" }
  | { status: "error"; errorCode: string; httpStatus: number };

export type PaymentResultCheckAction = () => Promise<PaymentResultCheck>;

const defaultRetryDelays = [1_000, 2_000, 4_000] as const;

export function PaymentResultWait({
  assignmentId,
  check,
  retryDelaysMs = defaultRetryDelays,
}: {
  assignmentId: string;
  check: PaymentResultCheckAction;
  retryDelaysMs?: readonly number[];
}) {
  const router = useRouter();
  const [state, setState] = useState<"checking" | "timed-out" | PaymentResultCheck>("checking");

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      for (const delay of retryDelaysMs) {
        await wait(delay);
        if (cancelled) return;

        const result = await check();
        if (cancelled) return;

        if (result.status === "resolved") {
          router.replace(`/isveren/atama/${encodeURIComponent(assignmentId)}?paymentReturn=1`);
          return;
        }
        if (result.status === "error") {
          setState(result);
          return;
        }
      }

      if (!cancelled) setState("timed-out");
    }

    void poll();
    return () => {
      cancelled = true;
    };
  }, [assignmentId, check, retryDelaysMs, router]);

  if (typeof state === "object" && state.status === "error") {
    return <ErrorState errorCode={state.errorCode} status={state.httpStatus} />;
  }

  return (
    <section className="account-card payment-result-wait" role="status" aria-live="polite">
      <p className="eyebrow">Güvenli ödeme dönüşü</p>
      <h1>Ödeme sonucunu bekliyoruz</h1>
      <p className="lede">
        Banka dönüşündeki bilgi sonuç sayılmaz. Koala, atamayı ve ödeme denemesini
        backend&apos;den doğruluyor.
      </p>
      {state === "timed-out" ? (
        <p>
          Otomatik kontrol süresi doldu. Ödeme kesinleşene kadar yeni bir ödeme başlatma;
          atama ayrıntısından durumu yeniden kontrol edebilirsin.
        </p>
      ) : (
        <p className="payment-wait-pulse">Sonuç doğrulanıyor…</p>
      )}
      <Link className="text-link" href={`/isveren/atama/${encodeURIComponent(assignmentId)}`}>
        Atama ayrıntısına dön
      </Link>
    </section>
  );
}

function wait(delay: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delay));
}
