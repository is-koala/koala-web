"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  return <html lang="tr"><body><main className="account-shell"><section className="account-card"><h1>Bir sorun oluştu</h1><p>İşlemi şu anda tamamlayamadık.</p><button className="button button-primary" type="button" onClick={reset}>Yeniden dene</button></section></main></body></html>;
}
