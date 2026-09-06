import type { Metadata } from "next";
import Link from "next/link";

import { RegistrationForm } from "@/components/registration-form";
import { registrationContent } from "@/content/account";

import { startRegistrationAction } from "./actions";

export const metadata: Metadata = {
  title: "Kayıt Ol",
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <section className="account-card">
      <p className="eyebrow">{registrationContent.eyebrow}</p>
      <h1>{registrationContent.title}</h1>
      <p className="lede">{registrationContent.intro}</p>
      <RegistrationForm action={startRegistrationAction} />
      <p className="trust-note">
        Hesabın var mı? <Link className="text-link" href="/giris">Giriş yap</Link>
      </p>
    </section>
  );
}
