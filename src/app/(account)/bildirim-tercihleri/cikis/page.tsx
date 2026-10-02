import type { Metadata } from "next";

import { UnsubscribePanel } from "@/components/unsubscribe-panel";
import { unsubscribeContent } from "@/content/unsubscribe";

export const metadata: Metadata = {
  title: "Abonelikten Çık",
  robots: { index: false, follow: false },
  // Başlık `private-routes.ts`'ten de geliyor; token 90 gün geçerli olduğu
  // için kural ters vekil başlığı düşürse bile belgenin içinde durur.
  referrer: "no-referrer",
};

/**
 * Ticari e-postadaki tek tıklık çıkış bağlantısının indiği sayfa
 * (is-koala/koala-web#54).
 *
 * Adres kalıcı: backend bağlantıyı yalnız bu yola üretiyor
 * (`AuthLinkManager.UNSUBSCRIBE_WEB_PATH`, `?token=`); değiştirmek gönderilmiş
 * e-postaları kırar.
 *
 * Sayfa bilerek statik ve `searchParams` okumuyor: açılış hiçbir şeyi
 * değiştirmiyor — e-posta tarayıcıları ve önizleyiciler bağlantıyı GET ile
 * açıyor — ve token sunucu render'ına hiç girmiyor. Tercih yalnız kullanıcı
 * onayladığında, panelin BFF'ye attığı POST ile kapanır.
 */
export default function Page() {
  return (
    <section className="account-card">
      <p className="eyebrow">{unsubscribeContent.eyebrow}</p>
      <h1>{unsubscribeContent.title}</h1>
      <p className="lede">{unsubscribeContent.intro}</p>
      <UnsubscribePanel />
      <noscript>
        <p className="trust-note">{unsubscribeContent.noScript}</p>
      </noscript>
    </section>
  );
}
