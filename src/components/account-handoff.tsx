import Link from "next/link";

import { OpenInApp } from "@/components/open-in-app";
import { invalidLinkContent, trustMessage } from "@/content/account";
import {
  buildAndroidIntentUrl,
  buildAppLink,
  storeUrl,
  type AppDestination,
} from "@/handoff/links";
import { readSingleToken, type SearchValue } from "@/handoff/token";
import { publicEnvironment } from "@/lib/env";

export function AccountHandoff({
  title,
  intro,
  destination,
  tokenValue,
}: {
  title: string;
  intro: string;
  destination: AppDestination;
  tokenValue: SearchValue;
}) {
  const token = readSingleToken(tokenValue);
  if (!token.ok) {
    return (
      <section className="account-card">
        <p className="eyebrow">Koala güvenli bağlantı</p>
        <h1>{invalidLinkContent.title}</h1>
        <p>{invalidLinkContent.body}</p>
        <Link className="text-link" href="/iletisim">İletişime geç</Link>
        <p className="trust-note">{trustMessage}</p>
      </section>
    );
  }

  const env = publicEnvironment();
  const deepLink = buildAppLink({ destination, token: token.value, scheme: env.appUrlScheme });
  const iosStore = storeUrl("ios", env);
  const androidStore = storeUrl("android", env);
  const intent = env.androidPackageId && androidStore
    ? buildAndroidIntentUrl({
        destination,
        token: token.value,
        scheme: env.appUrlScheme,
        packageId: env.androidPackageId,
        fallbackUrl: androidStore,
      })
    : undefined;

  return (
    <section className="account-card">
      <p className="eyebrow">Koala güvenli bağlantı</p>
      <h1>{title}</h1>
      <p className="lede">{intro}</p>
      <OpenInApp
        deepLink={deepLink}
        androidIntentLink={intent}
        storeLink={iosStore}
        androidStoreLink={androidStore}
      />
      <p className="trust-note">{trustMessage}</p>
      <noscript>
        <p><a href={deepLink}>Koala uygulamasını aç</a></p>
        {iosStore && <p><a href={iosStore}>App Store&apos;a git</a></p>}
        {androidStore && <p><a href={androidStore}>Play Store&apos;a git</a></p>}
      </noscript>
    </section>
  );
}
