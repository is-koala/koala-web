import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { OpenInApp } from "@/components/open-in-app";
import { identityHandoffContent } from "@/content/account";
import { buildOpenAppLink, storeUrl } from "@/handoff/links";
import { identityVerificationPath } from "@/identity/handoff";
import { publicEnvironment } from "@/lib/env";
import { safeInternalPath } from "@/lib/urls";
import { enterShell } from "@/server/session/viewer";

export const metadata: Metadata = {
  title: "Kimlik Doğrulama",
  robots: { index: false, follow: false },
};

/**
 * Kimlik kapısının web ekranı.
 *
 * Çip PA tarayıcıda tamamlanamaz (`src/identity/handoff.ts`); bu sayfa
 * doğrulanmamış kullanıcıyı uygulamaya bırakır ve `next` ile geldiği eyleme
 * dönüş yolunu taşır.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { viewer } = await enterShell();
  const { next } = await searchParams;
  const nextPath = typeof next === "string" ? safeInternalPath(next) : null;
  const destination =
    nextPath && nextPath !== identityVerificationPath ? nextPath : "/";

  if (viewer?.identityVerified) redirect(destination);

  const env = publicEnvironment();
  const deepLink = buildOpenAppLink(env.appUrlScheme);
  const iosStore = storeUrl("ios", env);
  const androidStore = storeUrl("android", env);

  return (
    <section className="account-card">
      <p className="eyebrow">{identityHandoffContent.eyebrow}</p>
      <h1>{identityHandoffContent.title}</h1>
      <p className="lede">{identityHandoffContent.body}</p>
      <OpenInApp
        deepLink={deepLink}
        storeLink={iosStore}
        androidStoreLink={androidStore}
      />
      {nextPath && nextPath !== identityVerificationPath ? (
        <p>
          <Link className="text-link" href={nextPath}>
            {identityHandoffContent.continueLabel}
          </Link>
        </p>
      ) : null}
      <noscript>
        <p>
          <a href={deepLink}>Koala uygulamasını aç</a>
        </p>
        {iosStore ? (
          <p>
            <a href={iosStore}>App Store&apos;a git</a>
          </p>
        ) : null}
        {androidStore ? (
          <p>
            <a href={androidStore}>Play Store&apos;a git</a>
          </p>
        ) : null}
      </noscript>
    </section>
  );
}
