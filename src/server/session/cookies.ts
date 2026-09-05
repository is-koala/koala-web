import "server-only";

import { cookies } from "next/headers";

import { secureCookieOptions, sessionCookies } from "@/server/contract";

import type { TokenPair } from "./refresh";

/**
 * Yenileme süresi backend yanıtından gelir; erişim çerezi de aynı ana
 * kadar yaşar, çünkü `/auth/refresh-token` süresi dolmuş erişim tokenını
 * `Authorization` başlığında görmek ister. Erişim çerezi önce ölseydi
 * oturum yenilenemez hâle gelirdi.
 */
export async function writeSessionCookies(pair: TokenPair) {
  const options = { ...secureCookieOptions, ...expiryOf(pair.refreshExpiresAt) };
  await mutateCookies((store) => {
    store.set(sessionCookies.accessToken, pair.token, options);
    store.set(sessionCookies.refreshToken, pair.refreshToken, options);
  });
}

export async function clearSessionCookies() {
  await mutateCookies((store) => {
    store.delete(sessionCookies.accessToken);
    store.delete(sessionCookies.refreshToken);
  });
}

function expiryOf(refreshExpiresAt: string) {
  const seconds = Math.floor((Date.parse(refreshExpiresAt) - Date.now()) / 1000);
  return Number.isFinite(seconds) && seconds > 0 ? { maxAge: seconds } : {};
}

/**
 * Next, server component render'ı sırasında çerez yazmayı yasaklar.
 *
 * Yazılamayan tazeleme oturum kaybı değil: backend yenileme tokenını
 * döndürmediği için bir sonraki istek yeniden yeniler. Temizlik de
 * yazılamayabilir; kullanıcıyı oturumdan çıkaran şey çerezin silinmesi
 * değil, girişe yönlendirilmesidir ve giriş sayfası çerezleri üzerine
 * yazar.
 */
async function mutateCookies(mutate: (store: Awaited<ReturnType<typeof cookies>>) => void) {
  const store = await cookies();
  try {
    mutate(store);
  } catch {
    return;
  }
}
