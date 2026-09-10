import "server-only";

type SupportQuota = {
  allowed: boolean;
};

type Bucket = {
  count: number;
  expiresAt: number;
};

type QuotaOptions = {
  clientLimit?: number;
  globalLimit?: number;
  maxClientBuckets?: number;
  now?: () => number;
  windowMs?: number;
};

/**
 * Destek formu için sabit pencereli hız sınırı.
 *
 * Analytics kotasından ayrı duruyor: o uç dakikada onlarca olay bekler,
 * buradaysa bir insanın yazdığı başvuru var. Aynı kovayı paylaşmak destek
 * formunu ölçümleme trafiğiyle doldururdu.
 */
export function createSupportQuota({
  clientLimit = 5,
  globalLimit = 40,
  maxClientBuckets = 2_000,
  now = Date.now,
  windowMs = 15 * 60_000,
}: QuotaOptions = {}) {
  const clients = new Map<string, Bucket>();
  let global: Bucket | null = null;

  return (clientKey: string): SupportQuota => {
    const currentTime = now();
    if (!global || global.expiresAt <= currentTime) {
      global = { count: 0, expiresAt: currentTime + windowMs };
      clients.clear();
    }
    if (global.count >= globalLimit) return { allowed: false };

    const key = clientKey.trim() || "unknown-client";
    let bucket = clients.get(key);
    if (bucket && bucket.expiresAt <= currentTime) {
      clients.delete(key);
      bucket = undefined;
    }

    if (!bucket) {
      if (clients.size >= maxClientBuckets) return { allowed: false };
      bucket = { count: 0, expiresAt: currentTime + windowMs };
      clients.set(key, bucket);
    }
    if (bucket.count >= clientLimit) return { allowed: false };

    bucket.count += 1;
    global.count += 1;
    return { allowed: true };
  };
}

export const takeSupportQuota = createSupportQuota();
