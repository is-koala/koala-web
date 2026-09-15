import type { Metadata } from "next";
import Link from "next/link";

import { InvalidLinkCard } from "@/components/invalid-link-card";
import { OpenInAppPanel } from "@/components/open-in-app-panel";
import { SetPasswordForm } from "@/components/set-password-form";
import { PublicErrorState } from "@/components/public-states";
import { secureLinkEyebrow, setPasswordContent, trustMessage } from "@/content/account";
import { readUuidToken } from "@/handoff/token";
import type { Agreement } from "@/lib/consents";
import type { VerifiedRegistration } from "@/server/auth/registration";
import { verifyRegistrationToken } from "@/server/auth/registration";
import { failureView } from "@/server/form";
import { readAgreements } from "@/server/legal/agreements";

import { completeRegistrationAction } from "./actions";

export const metadata: Metadata = {
  title: "Hesabını Doğrula",
  robots: { index: false, follow: false },
};

/**
 * Kayıt bağlantısının indiği sayfa.
 *
 * Adres kalıcı: backend kayıt e-postasını yalnız bu yola üretiyor
 * (`AuthLinkManager.REGISTRATION_WEB_PATH`) ve eski uygulama bağlantıları da
 * buraya 301'leniyor. Değişen şey davranış: iş artık uygulamaya
 * devredilmiyor, web'de bitiyor.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { token } = await searchParams;
  const parsed = readUuidToken(token);
  if (!parsed.ok) return <InvalidLinkCard />;

  const registration = await loadRegistration(parsed.value);
  if (!registration.ok) {
    return <RejectedCard errorCode={registration.errorCode} status={registration.httpStatus} />;
  }

  return (
    <>
      <section className="account-card">
        <p className="eyebrow">{setPasswordContent.eyebrow}</p>
        <h1>{setPasswordContent.title}</h1>
        <p className="lede">{setPasswordContent.intro}</p>
        <SetPasswordForm
          setPasswordToken={registration.verified.setPasswordToken}
          agreements={registration.agreements}
          action={completeRegistrationAction}
        />
        <p className="trust-note">{trustMessage}</p>
      </section>
      <OpenInAppPanel destination="hesap-dogrula" token={parsed.value} />
    </>
  );
}

type LoadedRegistration =
  | { ok: true; verified: VerifiedRegistration; agreements: Agreement[] }
  | { ok: false; errorCode: string; httpStatus: number };

/**
 * Doğrulama tokenı tüketilmiyor (`AuthManager.verifyRegistrationToken` yalnız
 * yeni bir parola tokenı üretiyor), bu yüzden sayfa yenilenebilir — ama her
 * yenileme `AUTH` hız kovasından bir hak yakar.
 */
async function loadRegistration(registrationToken: string): Promise<LoadedRegistration> {
  try {
    const verified = await verifyRegistrationToken(registrationToken);
    return { ok: true, verified, agreements: await readAgreements() };
  } catch (error) {
    return { ok: false, ...failureView(error) };
  }
}

function RejectedCard({ errorCode, status }: { errorCode: string; status: number }) {
  return (
    <section className="account-card">
      <p className="eyebrow">{secureLinkEyebrow}</p>
      <h1>{setPasswordContent.rejectedTitle}</h1>
      {/* Metin `errorCode` ile seçilir: süresi dolmuş bağlantı için hazır
          Türkçe karşılık `src/lib/errors.ts` içinde duruyor. */}
      <PublicErrorState errorCode={errorCode} status={status} />
      <p>{setPasswordContent.rejectedBody}</p>
      <Link className="button button-primary" href="/kayit">Yeni bağlantı iste</Link>
      <p className="trust-note">{trustMessage}</p>
    </section>
  );
}
