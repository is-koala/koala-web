"use client";

import { useEffect, useState } from "react";

/**
 * Uygulamayı açmayı dener; açılmazsa mağazaya yönlendirir.
 *
 * Tarayıcı "uygulama kurulu mu" sorusunu doğrudan cevaplamıyor. Kullanılan
 * yöntem şu: derin bağlantıya git ve bir zamanlayıcı kur. Uygulama açılırsa
 * sayfa arka plana düşer ve zamanlayıcı çalışmadan `visibilitychange`
 * tetiklenir; hâlâ buradaysak uygulama yok demektir.
 */
export function OpenInApp({
  deepLink,
  storeLink,
}: {
  deepLink: string;
  storeLink: string | null;
}) {
  const [stalled, setStalled] = useState(false);

  useEffect(() => {
    let settled = false;
    const onHidden = () => {
      settled = true;
    };
    document.addEventListener("visibilitychange", onHidden);
    window.location.href = deepLink;

    const timer = window.setTimeout(() => {
      if (settled || document.hidden) return;
      if (storeLink) {
        window.location.href = storeLink;
      } else {
        setStalled(true);
      }
    }, 1500);

    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      window.clearTimeout(timer);
    };
  }, [deepLink, storeLink]);

  return (
    <div className="space-y-4 text-center">
      <p className="text-neutral-600">Koala uygulaması açılıyor…</p>
      {stalled && (
        <p className="text-sm text-neutral-500">
          Uygulama açılmadıysa cihazına Koala&apos;yı kurman gerekiyor.
        </p>
      )}
      <a href={deepLink} className="inline-block underline">
        Uygulamayı aç
      </a>
    </div>
  );
}
