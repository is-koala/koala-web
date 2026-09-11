"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { companySectionPath, workerJobsPath } from "@/lib/app-routes";

/**
 * Başlıktaki oturum bağlantıları.
 *
 * Statik üretilen sayfaların kabuğunda durduğu için çerezi sunucuda okuyamaz;
 * durumu `/api/session`'dan sorar. Cevap gelene kadar — ve JavaScript hiç
 * çalışmazsa — "Giriş yap" görünür: oturumu olmayan ziyaretçi çoğunluk ve
 * bağlantı her hâlükârda doğru yere gider.
 *
 * Oturum açıkken İşlerim ve Şirketim de durur. Kabuk menüsü kendi
 * adresinden açılıyor; girişten sonra kullanıcı tanıtım sayfasında kalınca
 * bu iki hazır bölümü keşfedecek başka bir yer yok. Rol değiştirici değil
 * (is-koala/koala-web#25): var olan adresleri gösteriyor.
 */
export function SessionNav() {
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/session", { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { authenticated?: boolean } | null) => {
        setAuthenticated(body?.authenticated === true);
      })
      .catch(() => {
        // Durum okunamadı: giriş bağlantısı görünmeye devam eder.
      });
    return () => controller.abort();
  }, []);

  return authenticated ? (
    <>
      <Link className="nav-auth-link" href={workerJobsPath}>
        İşlerim
      </Link>
      <Link className="nav-auth-link" href={companySectionPath}>
        Şirketim
      </Link>
      <Link className="nav-auth-link" href="/cikis">
        Çıkış
      </Link>
    </>
  ) : (
    <Link className="nav-auth-link" href="/giris">
      Giriş yap
    </Link>
  );
}
