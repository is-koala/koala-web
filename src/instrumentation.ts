import { serverEnvironment } from "@/server/env";

/**
 * Yanlış yapılandırılmış BFF'i açılışta durdurur.
 *
 * Eksik `API_URL` ya da sürüm kapısının okuyamayacağı `APP_VERSION` ilk
 * kullanıcı isteğinde 500 olarak değil, sunucu ayağa kalkarken görünür.
 */
export function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  serverEnvironment();
}
