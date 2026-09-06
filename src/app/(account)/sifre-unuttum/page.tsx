import type { Metadata } from "next";
import Link from "next/link";

import { ForgotPasswordForm } from "@/components/forgot-password-form";
import { forgotPasswordContent } from "@/content/account";

import { forgotPasswordAction } from "./actions";

export const metadata: Metadata = {
  title: "Parolamı Unuttum",
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <section className="account-card">
      <p className="eyebrow">{forgotPasswordContent.eyebrow}</p>
      <h1>{forgotPasswordContent.title}</h1>
      <p className="lede">{forgotPasswordContent.intro}</p>
      <ForgotPasswordForm action={forgotPasswordAction} />
      <p className="trust-note">
        Parolanı hatırladın mı? <Link className="text-link" href="/giris">Giriş yap</Link>
      </p>
    </section>
  );
}
