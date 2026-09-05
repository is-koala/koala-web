"use client";

import QRCode from "qrcode";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { resolvePlatform, type Platform } from "@/handoff/links";

type OpenInAppProps = {
  deepLink: string;
  androidIntentLink?: string;
  storeLink: string | null;
  androidStoreLink?: string | null;
  platformOverride?: Platform;
  navigate?: (target: string) => void;
};

export function OpenInApp({
  deepLink,
  androidIntentLink,
  storeLink,
  androidStoreLink,
  platformOverride,
  navigate = (target) => {
    window.location.href = target;
  },
}: OpenInAppProps) {
  const [clientPlatform, setClientPlatform] = useState<Platform | null>(null);
  const platform = platformOverride ?? clientPlatform;
  const [stalled, setStalled] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  const settled = useRef(false);

  useEffect(() => {
    const detection = window.setTimeout(() => {
      setClientPlatform(resolvePlatform(navigator.userAgent));
    }, 0);
    return () => window.clearTimeout(detection);
  }, []);

  useEffect(() => {
    if (platform !== "desktop") return;
    let active = true;
    QRCode.toDataURL(deepLink, { margin: 1, width: 192 }).then((value) => {
      if (active) setQrCode(value);
    });
    return () => {
      active = false;
    };
  }, [deepLink, platform]);

  useEffect(() => {
    const stopFallback = () => {
      settled.current = true;
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
    const onVisibilityChange = () => {
      if (document.hidden) stopFallback();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", stopFallback);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", stopFallback);
      stopFallback();
    };
  }, []);

  const openIosApp = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    settled.current = false;
    setStalled(false);
    navigate(deepLink);
    timer.current = window.setTimeout(() => {
      if (settled.current || document.hidden) return;
      if (storeLink) navigate(storeLink);
      else setStalled(true);
    }, 1500);
  };

  if (!platform) return <p role="status">Cihaz bilgisi okunuyor…</p>;

  if (platform === "desktop") {
    return (
      <div className="handoff-panel">
        <h2>Telefonunda devam et</h2>
        <p>Koala uygulamasında bu işlemi açmak için kodu telefonunla tara.</p>
        {qrCode ? (
          <Image unoptimized width={192} height={192} src={qrCode} alt="Koala uygulama bağlantısı QR kodu" />
        ) : (
          <p role="status">QR kod hazırlanıyor…</p>
        )}
        <StoreAvailability storeLink={storeLink ?? androidStoreLink ?? null} />
      </div>
    );
  }

  if (platform === "android") {
    return (
      <div className="handoff-panel">
        <a className="button button-primary" href={androidIntentLink ?? deepLink}>
          Uygulamada aç
        </a>
        <StoreAvailability storeLink={androidStoreLink ?? storeLink} />
      </div>
    );
  }

  return (
    <div className="handoff-panel">
      <a className="button button-primary" href={deepLink} onClick={openIosApp}>
        Uygulamada aç
      </a>
      {stalled && (
        <p role="status">Uygulama açılmadı. Koala henüz bu mağazada olmayabilir.</p>
      )}
      <StoreAvailability storeLink={storeLink} />
    </div>
  );
}

function StoreAvailability({ storeLink }: { storeLink: string | null }) {
  if (!storeLink) {
    return (
      <p className="muted">Koala mağazada yayımlandığında burada görünecek.</p>
    );
  }
  return (
    <a className="text-link" href={storeLink}>
      Mağazaya git
    </a>
  );
}
