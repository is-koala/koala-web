import * as Sentry from "@sentry/nextjs";

import { serverEnvironment } from "@/server/env";

/**
 * Yanlış yapılandırılmış BFF'i açılışta durdurur.
 *
 * Eksik `API_URL` ya da sürüm kapısının okuyamayacağı `APP_VERSION` ilk
 * kullanıcı isteğinde 500 olarak değil, sunucu ayağa kalkarken görünür.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    serverEnvironment();
    await import("../sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
