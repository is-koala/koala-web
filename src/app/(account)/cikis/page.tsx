import type { Metadata } from "next";
import Link from "next/link";

import { logoutAction } from "./actions";

export const metadata: Metadata = {
  title: "Çıkış Yap",
  robots: { index: false, follow: false },
};

/**
 * Çıkış durum değiştiren bir işlem: bağlantıyla değil, aynı origin'den gelen
 * bir POST ile yapılır (`src/proxy.ts` origin denetimi). Başlıktaki bağlantı
 * bu sayfaya getirir, işlemi kullanıcı burada onaylar.
 */
export default function Page() {
  return (
    <section className="account-card">
      <p className="eyebrow">Koala hesabın</p>
      <h1>Çıkış yap</h1>
      <p className="lede">Bu tarayıcıdaki oturumun kapanacak.</p>
      <form className="form" action={logoutAction}>
        <button className="button button-primary" type="submit">Çıkış yap</button>
      </form>
      <p className="trust-note">
        <Link className="text-link" href="/">Vazgeç ve ana sayfaya dön</Link>
      </p>
    </section>
  );
}
