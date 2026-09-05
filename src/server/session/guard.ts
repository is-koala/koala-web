import "server-only";

import { redirect } from "next/navigation";

import { loginPath } from "@/lib/site";

import { readSession, type Session } from "./session";

/**
 * Korumalı sayfanın oturum kapısı.
 *
 * Erişim tokenı süresi dolmuş olabilir ve ilk çağrıda yenilenir; kapının
 * baktığı şey yenileme tokenının varlığıdır, çünkü oturumu ayakta tutan
 * odur.
 */
export async function requireSession(currentPath: string): Promise<Session> {
  const session = await readSession();
  if (!session.refreshToken) {
    redirect(loginRedirect(currentPath));
  }
  return session;
}

/**
 * Giriş sonrası kullanıcıyı bıraktığı yere döndürür. Yalnız site içi mutlak
 * yollar kabul edilir: dışarıya çıkan bir `next` değeri, giriş sayfasını
 * açık yönlendirme aracına çevirirdi.
 */
export function loginRedirect(nextPath: string): string {
  const safe = sameSitePath(nextPath);
  return safe ? `${loginPath}?next=${encodeURIComponent(safe)}` : loginPath;
}

/** Çözümde kullanılan, gerçekte var olmayan origin. */
const probeOrigin = "https://koala.invalid";

/**
 * Karakter denetimi yerine adresi gerçekten çözer.
 *
 * "//host", "/\host" ve sekme/satır sonu saklayan "/<TAB>/host" hepsi
 * tarayıcıda dış adrese açılır; elle kalıp aramak bu biçimlerin ardından
 * koşmak demek. Çözülen adres kendi origin'imizde kalmıyorsa hedef
 * değildir. Ham değer değil, normalleştirilmiş yol döner: aksi hâlde sekme
 * `next` içinde saklanıp giriş sonrası yeniden çözülürdü.
 */
function sameSitePath(candidate: string): string | null {
  if (!candidate.startsWith("/")) return null;

  try {
    const resolved = new URL(candidate, probeOrigin);
    if (resolved.origin !== probeOrigin) return null;
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return null;
  }
}
