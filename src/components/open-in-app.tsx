"use client";

import QRCode from "qrcode";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { sendHandoffEvent } from "@/analytics/events";
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
  const [qrCode, setQrCode] = useState<string | null>(null);
  const attempted = useRef(false);
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
    const recordSuccess = () => {
      if (!attempted.current || settled.current || !platform) return;
      settled.current = true;
      sendHandoffEvent("app_opened", platform);
    };
    const onVisibilityChange = () => {
      if (document.hidden) recordSuccess();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", recordSuccess);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", recordSuccess);
    };
  }, [platform]);

  const openIosApp = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    settled.current = false;
    attempted.current = true;
    sendHandoffEvent("deep_link_attempted", "ios");
    navigate(deepLink);
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
        <a
          className="button button-primary"
          href={androidIntentLink ?? deepLink}
          onClick={() => {
            settled.current = false;
            attempted.current = true;
            sendHandoffEvent("deep_link_attempted", "android");
          }}
        >
          Uygulamada aç
        </a>
        <StoreAvailability storeLink={androidStoreLink ?? storeLink} platform="android" />
      </div>
    );
  }

  return (
    <div className="handoff-panel">
      <a className="button button-primary" href={deepLink} onClick={openIosApp}>
        Uygulamada aç
      </a>
      <StoreAvailability storeLink={storeLink} platform="ios" />
    </div>
  );
}

function StoreAvailability({
  storeLink,
  platform,
}: {
  storeLink: string | null;
  platform?: Platform;
}) {
  if (!storeLink) {
    return (
      <p className="muted">Koala mağazada yayımlandığında burada görünecek.</p>
    );
  }
  return (
    <a
      className="text-link"
      href={storeLink}
      onClick={() => platform && sendHandoffEvent("store_fallback", platform)}
    >
      Mağazaya git
    </a>
  );
}
