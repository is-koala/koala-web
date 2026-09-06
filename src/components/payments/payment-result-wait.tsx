"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ErrorState } from "@/components/states";
import { paymentReturnToneTitle } from "@/payments/checkout";

type PaymentResultCheck =
  | { status: "pending" }
  | { status: "resolved" }
  | { status: "error"; errorCode: string; httpStatus: number };

const retryDelaysMs = [1_000, 2_000, 4_000] as const;

export function PaymentResultWait({
  assignmentId,
  initialTone,
}: {
  assignmentId: string;
  initialTone: "success" | "failed";
}) {
  const router = useRouter();
  const [state, setState] = useState<"checking" | "timed-out" | PaymentResultCheck>("checking");

  useEffect(() => {
    const controller = new AbortController();

    async function poll() {
      for (const delay of retryDelaysMs) {
        if (!(await wait(delay, controller.signal))) return;

        const result = await checkPaymentResult(assignmentId, controller.signal);
        if (controller.signal.aborted) return;

        if (result.status === "resolved") {
          router.replace(`/isveren/atama/${encodeURIComponent(assignmentId)}?paymentReturn=1`);
          return;
        }
        if (result.status === "error") {
          setState(result);
          return;
        }
      }

      setState("timed-out");
    }

    void poll();
    return () => controller.abort();
  }, [assignmentId, router]);

  if (typeof state === "object" && state.status === "error") {
    return <ErrorState errorCode={state.errorCode} status={state.httpStatus} />;
  }

  return (
    <section className="account-card payment-result-wait" role="status" aria-live="polite">
      <p className="eyebrow">Güvenli ödeme dönüşü</p>
      <h1>{paymentReturnToneTitle(initialTone)}</h1>
      <p className="lede">
        Bu ilk bildirim sonuç sayılmaz. Koala, atamayı ve ödeme denemesini backend&apos;den
        doğruluyor.
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

async function checkPaymentResult(
  assignmentId: string,
  signal: AbortSignal,
): Promise<PaymentResultCheck> {
  try {
    const response = await fetch(
      `/api/payments/${encodeURIComponent(assignmentId)}/result`,
      { cache: "no-store", signal },
    );
    const body = await response.json() as Partial<PaymentResultCheck>;
    if (body.status === "pending" || body.status === "resolved") return { status: body.status };
    if (
      body.status === "error" &&
      typeof body.errorCode === "string" &&
      typeof body.httpStatus === "number"
    ) return { status: "error", errorCode: body.errorCode, httpStatus: body.httpStatus };
  } catch (error) {
    if (signal.aborted) return { status: "pending" };
    void error;
  }
  return { status: "error", errorCode: "UNEXPECTED_ERROR", httpStatus: 500 };
}

function wait(delay: number, signal: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      signal.removeEventListener("abort", cancel);
      resolve(true);
    }, delay);
    const cancel = () => {
      window.clearTimeout(timer);
      resolve(false);
    };
    signal.addEventListener("abort", cancel, { once: true });
  });
}
