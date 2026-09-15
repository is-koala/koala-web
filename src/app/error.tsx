"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { MainContent } from "@/components/main-content";
import { ErrorCard } from "@/components/error-card";
import { unexpectedErrorPresentation } from "@/lib/error-presentation";

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
        <ErrorCard presentation={unexpectedErrorPresentation} onRetry={retry} />
      </section>
    </MainContent>
  );
}
