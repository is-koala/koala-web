import Link from "next/link";

import { invalidLinkContent, secureLinkEyebrow, trustMessage } from "@/content/account";

/**
 * Biçimi bozuk karşılama bağlantısı.
 *
 * Yinelenen, boş ya da aşırı uzun token backend'e hiç sorulmaz: kullanıcının
 * yapabileceği tek şey e-postadaki bağlantıyı yeniden açmak, ve gereksiz bir
 * çağrı `AUTH` hız kovasından hak yakardı.
 */
export function InvalidLinkCard() {
  return (
    <section className="account-card">
      <p className="eyebrow">{secureLinkEyebrow}</p>
      <h1>{invalidLinkContent.title}</h1>
      <p>{invalidLinkContent.body}</p>
      <Link className="text-link" href="/iletisim">İletişime geç</Link>
      <p className="trust-note">{trustMessage}</p>
    </section>
  );
}
