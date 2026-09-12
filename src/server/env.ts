import "server-only";

import { assertAbsoluteUrl, requiredEnvironmentValue } from "@/lib/env";

import { parsableAppVersion } from "./contract";

export type ServerEnvironment = {
  apiUrl: string;
  appVersion: string;
};

/**
 * Sunucu tarafı BFF yapılandırması.
 *
 * `API_URL` sırdır ve `NEXT_PUBLIC_` öneki taşımaz; tarayıcı bundle'ına
 * girmesin diye yalnız `server-only` modüllerden okunur.
 */
export function serverEnvironment(): ServerEnvironment {
  const apiUrl = requiredEnvironmentValue("API_URL");
  const appVersion = requiredEnvironmentValue("APP_VERSION");

  assertAbsoluteUrl(apiUrl, "API_URL");

  // Backend sürüm kapısı okunamayan sürümü 426 ile reddeder; yanlış
  // yapılandırmayı ilk istekte değil açılışta görmek gerekir.
  if (!parsableAppVersion.test(appVersion)) {
    throw new Error("APP_VERSION 1.4.0 gibi noktayla ayrılmış sayılarla başlamalı.");
  }

  // İsteğe bağlı olsa da yanlış allowlist güvenlik sınırıdır; uygulama açılışında
  // doğrulanır, ilk kanıt indirmesinde sürpriz bir yapılandırma hatasına bırakılmaz.
  evidenceStorageOrigins();
  bffUpstreamTimeoutMs();
  identityUploadMaxConcurrentOperations();
  identityUploadBodyIdleTimeoutMs();

  return { apiUrl: apiUrl.replace(/\/+$/, ""), appVersion };
}

/** Kanıt BFF'sinin backend veya özel depo bağlantısını sonsuza dek açık tutmasını önler. */
export function bffUpstreamTimeoutMs(): number {
  const raw = process.env.BFF_UPSTREAM_TIMEOUT_MS?.trim() || "15000";
  if (!/^\d+$/.test(raw)) {
    throw new Error("BFF_UPSTREAM_TIMEOUT_MS 1000 ile 60000 arasında bir tam sayı olmalı.");
  }
  const timeout = Number(raw);
  if (timeout < 1000 || timeout > 60_000) {
    throw new Error("BFF_UPSTREAM_TIMEOUT_MS 1000 ile 60000 arasında bir tam sayı olmalı.");
  }
  return timeout;
}

/** Aynı süreçte bellekte tutulabilen büyük kimlik multipart işlemlerini sınırlar. */
export function identityUploadMaxConcurrentOperations(): number {
  const raw = process.env.IDENTITY_UPLOAD_MAX_CONCURRENT_OPERATIONS?.trim() || "2";
  if (!/^\d+$/.test(raw)) {
    throw new Error(
      "IDENTITY_UPLOAD_MAX_CONCURRENT_OPERATIONS 1 ile 8 arasında bir tam sayı olmalı.",
    );
  }
  const limit = Number(raw);
  if (limit < 1 || limit > 8) {
    throw new Error(
      "IDENTITY_UPLOAD_MAX_CONCURRENT_OPERATIONS 1 ile 8 arasında bir tam sayı olmalı.",
    );
  }
  return limit;
}

/** Büyük gövdenin iki parçası arasında istemcinin kapasiteyi tutabileceği süre. */
export function identityUploadBodyIdleTimeoutMs(): number {
  const raw = process.env.IDENTITY_UPLOAD_BODY_IDLE_TIMEOUT_MS?.trim() || "15000";
  if (!/^\d+$/.test(raw)) {
    throw new Error(
      "IDENTITY_UPLOAD_BODY_IDLE_TIMEOUT_MS 1000 ile 60000 arasında bir tam sayı olmalı.",
    );
  }
  const timeout = Number(raw);
  if (timeout < 1000 || timeout > 60_000) {
    throw new Error(
      "IDENTITY_UPLOAD_BODY_IDLE_TIMEOUT_MS 1000 ile 60000 arasında bir tam sayı olmalı.",
    );
  }
  return timeout;
}

/** İmzalı kanıt URL'leri için sunucu tarafında açıkça güvenilen özel origin'ler. */
export function evidenceStorageOrigins(): ReadonlySet<string> {
  const origins = process.env.EVIDENCE_STORAGE_ORIGINS?.split(",")
    .map((value) => value.trim())
    .filter(Boolean) ?? [];

  return new Set(origins.map((origin) => {
    let url: URL;
    try {
      url = new URL(origin);
    } catch {
      throw new Error("EVIDENCE_STORAGE_ORIGINS yalnız geçerli HTTPS origin'leri içermeli.");
    }
    if (
      url.protocol !== "https:" ||
      url.username !== "" ||
      url.password !== "" ||
      url.pathname !== "/" ||
      url.search !== "" ||
      url.hash !== ""
    ) {
      throw new Error("EVIDENCE_STORAGE_ORIGINS yalnız geçerli HTTPS origin'leri içermeli.");
    }
    return url.origin;
  }));
}
