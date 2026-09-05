import type { Metadata } from "next";

import { OpenInApp } from "@/components/open-in-app";
import { openAppContent } from "@/content/account";
import { buildAndroidIntentUrl, buildAppLink, buildOpenAppLink, storeUrl, type AppDestination } from "@/handoff/links";
import { readSingleToken } from "@/handoff/token";
import { publicEnvironment } from "@/lib/env";

export const metadata: Metadata = { title: "Uygulamayı Aç", robots: { index: false, follow: false } };

const allowedDestinations = new Set<AppDestination>(["hesap-dogrula", "sifre-sifirla"]);

export default async function Page({ searchParams }: { searchParams: Promise<{ hedef?: string | string[]; token?: string | string[] }> }) {
  const { hedef, token: tokenValue } = await searchParams;
  const env = publicEnvironment();
  let deepLink = buildOpenAppLink(env.appUrlScheme);
  let androidIntentLink: string | undefined;
  if (hedef !== undefined || tokenValue !== undefined) {
    const token = readSingleToken(tokenValue);
    if (typeof hedef !== "string" || !allowedDestinations.has(hedef as AppDestination) || !token.ok) {
      return <section className="account-card"><h1>{openAppContent.invalidTitle}</h1><p>{openAppContent.invalidBody}</p></section>;
    }
    deepLink = buildAppLink({ destination: hedef as AppDestination, token: token.value, scheme: env.appUrlScheme });
    const androidStore = storeUrl("android", env);
    if (env.androidPackageId && androidStore) {
      androidIntentLink = buildAndroidIntentUrl({ destination: hedef as AppDestination, token: token.value, scheme: env.appUrlScheme, packageId: env.androidPackageId, fallbackUrl: androidStore });
    }
  }
  const iosStore = storeUrl("ios", env);
  const androidStore = storeUrl("android", env);
  return (
    <section className="account-card">
      <p className="eyebrow">{openAppContent.eyebrow}</p>
      <h1>{openAppContent.title}</h1>
      <p className="lede">{openAppContent.body}</p>
      <OpenInApp deepLink={deepLink} androidIntentLink={androidIntentLink} storeLink={iosStore} androidStoreLink={androidStore} />
      <noscript>
        <p><a href={deepLink}>Koala uygulamasını aç</a></p>
        {iosStore && <p><a href={iosStore}>App Store&apos;a git</a></p>}
        {androidStore && <p><a href={androidStore}>Play Store&apos;a git</a></p>}
      </noscript>
    </section>
  );
}
