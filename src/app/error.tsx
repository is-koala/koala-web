"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { ErrorState } from "@/components/states";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  return <main className="account-shell"><section className="account-card"><ErrorState status={500} /><button className="button button-primary" type="button" onClick={reset}>Yeniden dene</button></section></main>;
}
