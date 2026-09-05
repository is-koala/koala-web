import type { Metadata } from "next";
import Link from "next/link";

import { emailVerificationContent, trustMessage } from "@/content/account";

export const metadata: Metadata = { title: "E-posta Adresini Onayla", robots: { index: false, follow: false } };

export default function Page() {
  return (
    <section className="account-card">
      <p className="eyebrow">{emailVerificationContent.eyebrow}</p>
      <h1>{emailVerificationContent.title}</h1>
      <p className="lede">{emailVerificationContent.body}</p>
      <Link className="button button-primary" href="/uygulamayi-ac">{emailVerificationContent.action}</Link>
      <p className="trust-note">{trustMessage}</p>
    </section>
  );
}
