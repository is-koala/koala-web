"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { shellHomePath, type AppShellId } from "@/lib/app-routes";

type SessionState =
  | { authenticated: false }
  | { authenticated: true; shell: AppShellId | null };

const shellLabels: Readonly<Record<AppShellId, string>> = {
  worker: "Panelim",
  employer: "İşveren panelim",
};

/**
 * Başlıktaki oturum bağlantıları.
 *
 * Statik üretilen sayfaların kabuğunda durduğu için çerezi sunucuda okuyamaz;
 * durumu `/api/session`'dan sorar. Cevap gelene kadar — ve JavaScript hiç
 * çalışmazsa — "Giriş yap" görünür: oturumu olmayan ziyaretçi çoğunluk ve
 * bağlantı her hâlükârda doğru yere gider.
 *
 * Oturum açıkken tek bir çağrı var: kullanıcının kabuğu ("Panelim" ya da
 * "İşveren panelim", is-koala/koala-web#154). Rol değiştirici değil
 * (is-koala/koala-web#25): kabuk `isEmployer`'dan okunuyor ve öbür kabuk
 * adresinden hâlâ açılabiliyor. Kabuk okunamadıysa çalışan paneli gösterilir —
 * her oturum oraya girebiliyor ve boş bırakmak kullanıcıyı başlıkta
 * kabuksuz bırakırdı.
 */
export function SessionNav() {
  const [session, setSession] = useState<SessionState>({ authenticated: false });

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/session", { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { authenticated?: boolean; shell?: string | null } | null) => {
        if (body?.authenticated !== true) return;
        setSession({
          authenticated: true,
          shell: body.shell === "employer" || body.shell === "worker" ? body.shell : null,
        });
      })
      .catch(() => {
        // Durum okunamadı: giriş bağlantısı görünmeye devam eder.
      });
    return () => controller.abort();
  }, []);

  if (!session.authenticated) {
    return (
      <Link className="button button-primary button-small" href="/giris">
        Giriş yap
      </Link>
    );
  }

  const shell = session.shell ?? "worker";
  return (
    <>
      <Link className="button button-primary button-small" href={shellHomePath(shell)}>
        {shellLabels[shell]}
      </Link>
      <Link className="nav-auth-link nav-session-exit" href="/cikis">
        Çıkış
      </Link>
    </>
  );
}
