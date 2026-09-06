type AnalyticsQuota = {
  allowed: boolean;
  retryAfterSeconds: number;
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

export function createAnalyticsQuota({
  clientLimit = 30,
  globalLimit = 600,
  maxClientBuckets = 2_000,
  now = Date.now,
  windowMs = 60_000,
}: QuotaOptions = {}) {
  const clients = new Map<string, Bucket>();
  let global: Bucket | null = null;

  return (request: Request): AnalyticsQuota => {
    const currentTime = now();
    if (!global || global.expiresAt <= currentTime) {
      global = { count: 0, expiresAt: currentTime + windowMs };
      clients.clear();
    }
    if (global.count >= globalLimit) return denied(global.expiresAt, currentTime);

    const client = clientKey(request);
    let bucket = clients.get(client);
    if (bucket && bucket.expiresAt <= currentTime) {
      clients.delete(client);
      bucket = undefined;
    }

    if (!bucket) {
      if (clients.size >= maxClientBuckets) {
        return denied(nearestExpiry(clients, global.expiresAt), currentTime);
      }
      bucket = { count: 0, expiresAt: currentTime + windowMs };
      clients.set(client, bucket);
    }
    if (bucket.count >= clientLimit) return denied(bucket.expiresAt, currentTime);

    bucket.count += 1;
    global.count += 1;
    return { allowed: true, retryAfterSeconds: 0 };
  };
}

export const takeAnalyticsQuota = createAnalyticsQuota();

function clientKey(request: Request): string {
  const forwarded = request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",", 1)[0];
  const candidate = forwarded?.trim();

  // Başlık kontrolü belleğe sınırsız/kişisel bir değer taşınmasını engeller.
  if (candidate && candidate.length <= 64 && /^[0-9a-f.:]+$/i.test(candidate)) {
    return candidate;
  }
  return "unknown-client";
}

function denied(expiresAt: number, now: number): AnalyticsQuota {
  return {
    allowed: false,
    retryAfterSeconds: Math.max(1, Math.ceil((expiresAt - now) / 1000)),
  };
}

function nearestExpiry(clients: Map<string, Bucket>, fallback: number): number {
  let nearest = fallback;
  for (const bucket of clients.values()) nearest = Math.min(nearest, bucket.expiresAt);
  return nearest;
}
