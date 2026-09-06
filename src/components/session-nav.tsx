"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * Başlıktaki oturum bağlantısı.
 *
 * Statik üretilen sayfaların kabuğunda durduğu için çerezi sunucuda okuyamaz;
 * durumu `/api/session`'dan sorar. Cevap gelene kadar — ve JavaScript hiç
 * çalışmazsa — "Giriş yap" görünür: oturumu olmayan ziyaretçi çoğunluk ve
 * bağlantı her hâlükârda doğru yere gider.
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
    <Link className="nav-auth-link" href="/cikis">Çıkış</Link>
  ) : (
    <Link className="nav-auth-link" href="/giris">Giriş yap</Link>
  );
}
