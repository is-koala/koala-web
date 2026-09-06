import type { Metadata } from "next";

import { InvalidLinkCard } from "@/components/invalid-link-card";
import { OpenInAppPanel } from "@/components/open-in-app-panel";
import { ResetPasswordForm } from "@/components/reset-password-form";
import { resetPasswordContent, trustMessage } from "@/content/account";
import { readSingleToken } from "@/handoff/token";

import { resetPasswordAction } from "./actions";

export const metadata: Metadata = {
  title: "Şifreni Sıfırla",
  robots: { index: false, follow: false },
};

/**
 * Parola sıfırlama bağlantısının indiği sayfa.
 *
 * Token sayfa açılışında doğrulanmaz: `PasswordResetTokenManager.consume`
 * onu tek kullanımlık tutuyor, yani doğrulamak tüketmek demek olurdu ve
 * sayfayı açmak bağlantıyı yakardı. Biçim denetimi yerelde yapılır, geçerlilik
 * yalnız gönderimde sınanır.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { token } = await searchParams;
  const parsed = readSingleToken(token);
  if (!parsed.ok) return <InvalidLinkCard />;

  return (
    <>
      <section className="account-card">
        <p className="eyebrow">{resetPasswordContent.eyebrow}</p>
        <h1>{resetPasswordContent.title}</h1>
        <p className="lede">{resetPasswordContent.intro}</p>
        <ResetPasswordForm resetToken={parsed.value} action={resetPasswordAction} />
        <p className="trust-note">{trustMessage}</p>
      </section>
      <OpenInAppPanel destination="sifre-sifirla" token={parsed.value} />
    </>
  );
}
