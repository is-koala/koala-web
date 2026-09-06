import { OpenInApp } from "@/components/open-in-app";
import { openInAppContent } from "@/content/account";
import {
  buildAndroidIntentUrl,
  buildAppLink,
  storeUrl,
  type AppDestination,
} from "@/handoff/links";
import { publicEnvironment } from "@/lib/env";

/**
 * Web'de tamamlanabilen akışın ikincil yolu.
 *
 * İşlem artık sitede bitiyor, ama uygulaması olan kullanıcı akışını orada
 * sürdürebilmeli; bu yüzden aktarım kalıyor, yalnız ana eylem olmaktan
 * çıkıyor.
 */
export function OpenInAppPanel({
  destination,
  token,
}: {
  destination: AppDestination;
  token: string;
}) {
  const env = publicEnvironment();
  const deepLink = buildAppLink({ destination, token, scheme: env.appUrlScheme });
  const iosStore = storeUrl("ios", env);
  const androidStore = storeUrl("android", env);
  const intent =
    env.androidPackageId && androidStore
      ? buildAndroidIntentUrl({
          destination,
          token,
          scheme: env.appUrlScheme,
          packageId: env.androidPackageId,
          fallbackUrl: androidStore,
        })
      : undefined;

  return (
    <section className="app-handoff">
      <p className="eyebrow">{openInAppContent.title}</p>
      <p className="muted">{openInAppContent.body}</p>
      <OpenInApp
        deepLink={deepLink}
        androidIntentLink={intent}
        storeLink={iosStore}
        androidStoreLink={androidStore}
      />
      <noscript>
        <p><a href={deepLink}>Koala uygulamasını aç</a></p>
      </noscript>
    </section>
  );
}
