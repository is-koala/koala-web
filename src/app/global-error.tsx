"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { MainContent } from "@/components/main-content";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  retry: () => void;
  reset: () => void;
};

export default function GlobalError({ error, retry }: GlobalErrorProps) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  return <html lang="tr"><body><MainContent className="account-shell"><section className="account-card"><h1>Bir sorun oluştu</h1><p>İşlemi şu anda tamamlayamadık.</p><button className="button button-primary" type="button" onClick={retry}>Yeniden dene</button></section></MainContent></body></html>;
}
