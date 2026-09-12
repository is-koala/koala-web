import "server-only";

type IdentityUploadQuota = {
  readonly allowed: boolean;
  readonly retryAfterSeconds: number;
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

/** Büyük multipart gövdesi ayrıştırılmadan önce çalışan süreç-içi koruma. */
export function createIdentityUploadQuota({
  clientLimit = 5,
  globalLimit = 40,
  maxClientBuckets = 2_000,
  now = Date.now,
  windowMs = 15 * 60_000,
}: QuotaOptions = {}) {
  const clients = new Map<string, Bucket>();
  let global: Bucket | null = null;

  return (deviceId: string): IdentityUploadQuota => {
    const currentTime = now();
    if (!global || global.expiresAt <= currentTime) {
      global = { count: 0, expiresAt: currentTime + windowMs };
      clients.clear();
    }
    if (global.count >= globalLimit) return denied(global.expiresAt, currentTime);

    const key = /^[A-Za-z0-9._:-]{8,128}$/.test(deviceId) ? deviceId : "unknown-device";
    let bucket = clients.get(key);
    if (bucket && bucket.expiresAt <= currentTime) {
      clients.delete(key);
      bucket = undefined;
    }
    if (!bucket) {
      if (clients.size >= maxClientBuckets) return denied(global.expiresAt, currentTime);
      bucket = { count: 0, expiresAt: currentTime + windowMs };
      clients.set(key, bucket);
    }
    if (bucket.count >= clientLimit) return denied(bucket.expiresAt, currentTime);

    bucket.count += 1;
    global.count += 1;
    return { allowed: true, retryAfterSeconds: 0 };
  };
}

export const takeIdentityUploadQuota = createIdentityUploadQuota();

function denied(expiresAt: number, now: number): IdentityUploadQuota {
  return {
    allowed: false,
    retryAfterSeconds: Math.max(1, Math.ceil((expiresAt - now) / 1000)),
  };
}
