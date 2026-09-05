"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <html lang="tr"><body><main className="account-shell"><section className="account-card"><h1>Bir sorun oluştu</h1><p>İşlemi şu anda tamamlayamadık.</p><button className="button button-primary" type="button" onClick={reset}>Yeniden dene</button></section></main></body></html>;
}
