"use client";

import Link from "next/link";
import { useEffect, useRef, useSyncExternalStore } from "react";

import {
  consentChangedEvent,
  consentStorageKey,
  parseConsent,
  writeConsent,
} from "@/analytics/consent";
import { sendHandoffEvent } from "@/analytics/events";
import { resolvePlatform } from "@/handoff/links";

const handoffPaths = new Set([
  "/hesap-dogrula",
  "/sifre-belirle",
  "/sifre-sifirla",
  "/eposta-onayla",
  "/payment/result",
]);

export function ConsentManager() {
  const consent = useConsent();
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const trackedPath = useRef<string | null>(null);

  useEffect(() => {
    if (!consent?.analytics || !handoffPaths.has(window.location.pathname)) return;
    if (trackedPath.current === window.location.pathname) return;
    trackedPath.current = window.location.pathname;
    const platform = resolvePlatform(navigator.userAgent);
    sendHandoffEvent("handoff_viewed", platform);
    if (platform === "desktop") {
      sendHandoffEvent("desktop_fallback", platform);
    }
  }, [consent]);

  if (!hydrated || consent) return null;

  return (
    <section className="consent-banner" role="region" aria-label="Çerez tercihleri">
      <div>
        <h2>Ölçümleme tercihin</h2>
        <p>
          Zorunlu depolama siteyi çalıştırır. İzin verirsen yalnız uygulamaya
          geçişin çalışıp çalışmadığını, token veya kişisel veri olmadan ölçeriz.
          Ayrıntılar <Link href="/cerez-politikasi">Çerez Politikası</Link>nda.
        </p>
      </div>
      <div className="consent-actions">
        <button className="button button-secondary" type="button" onClick={() => writeConsent(false)}>
          Yalnız zorunlu
        </button>
        <button className="button button-primary" type="button" onClick={() => writeConsent(true)}>
          Ölçümlemeye izin ver
        </button>
      </div>
    </section>
  );
}

export function ConsentPreferences() {
  const consent = useConsent();

  return (
    <section className="consent-preferences" aria-labelledby="consent-preferences-title">
      <h2 id="consent-preferences-title">Çerez tercihini değiştir</h2>
      <p>
        Ölçümleme şu anda {consent?.analytics ? "açık" : "kapalı"}. Tercihin bu
        tarayıcı profilinde politika sürümüyle birlikte saklanır.
      </p>
      <div className="button-row">
        <button className="button button-secondary" type="button" onClick={() => writeConsent(false)}>
          Ölçümlemeyi reddet
        </button>
        <button className="button button-primary" type="button" onClick={() => writeConsent(true)}>
          Ölçümlemeye izin ver
        </button>
      </div>
    </section>
  );
}

function noopSubscribe() {
  return () => undefined;
}

function useConsent() {
  const serialized = useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener(consentChangedEvent, onStoreChange);
      window.addEventListener("storage", onStoreChange);
      return () => {
        window.removeEventListener(consentChangedEvent, onStoreChange);
        window.removeEventListener("storage", onStoreChange);
      };
    },
    () => window.localStorage.getItem(consentStorageKey),
    () => null,
  );
  return parseConsent(serialized);
}
