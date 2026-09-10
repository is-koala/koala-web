"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { MainContent } from "@/components/main-content";
import { ErrorState } from "@/components/states";

type ErrorPageProps = {
  error: Error & { digest?: string };
  retry: () => void;
  reset: () => void;
};

export default function ErrorPage({ error, retry }: ErrorPageProps) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  return (
    <MainContent className="account-shell">
      <section className="account-card">
        <ErrorState status={500} onRetry={retry} />
      </section>
    </MainContent>
  );
}
