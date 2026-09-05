"use client";

import { ErrorState } from "@/components/states";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="account-shell"><section className="account-card"><ErrorState status={500} /><button className="button button-primary" type="button" onClick={reset}>Yeniden dene</button></section></main>;
}
