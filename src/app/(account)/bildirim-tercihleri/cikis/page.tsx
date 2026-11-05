import type { Metadata } from "next";

import { UnsubscribePanel } from "@/components/unsubscribe-panel";
import { unsubscribeContent } from "@/content/unsubscribe";

export const metadata: Metadata = {
  title: "Abonelikten Çık",
  robots: { index: false, follow: false },
  // Gizli rotaların başlığı `strict-origin` (`private-routes.ts`, #199); bu
  // sayfa onu `no-referrer`'a sıkılaştırıyor. Bunu yapabiliyor, çünkü düz bir
  // form POST'u yok: onay `cors` kipindeki bir `fetch` ile gidiyor ve o kipte
  // tarayıcı `Origin`'i politikadan bağımsız olarak gerçek değeriyle yazıyor
  // (Fetch standardı `null`'u yalnız `cors` olmayan istekte yazdırıyor). Token
  // 90 gün geçerli; kural ters vekil başlığı düşürse bile belgenin içinde durur.
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
