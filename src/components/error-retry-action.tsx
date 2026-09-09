"use client";

/**
 * Ortak hata kartındaki tek etkileşimli yaprak.
 *
 * `states.tsx` hem Server hem Client Component ağaçlarında kullanılıyor;
 * event handler'ı bu küçük sınırda tutmak salt link gösteren sunucu
 * sayfalarının tüm ortak durum bileşenlerini hydrate etmesini engeller.
 */
export function ErrorRetryAction({ label, onRetry }: { label: string; onRetry: () => void }) {
  return (
    <button
      type="button"
      className="button button-secondary button-small state-action"
      onClick={onRetry}
    >
      {label}
    </button>
  );
}
