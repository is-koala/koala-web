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

  return { apiUrl: apiUrl.replace(/\/+$/, ""), appVersion };
}
