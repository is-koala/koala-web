import "server-only";

import { loginPath } from "@/lib/site";

/**
 * Giriş sonrası kullanıcıyı bıraktığı yere döndürür. Yalnız site içi mutlak
 * yollar kabul edilir: dışarıya çıkan bir `next` değeri, giriş sayfasını
 * açık yönlendirme aracına çevirirdi.
 *
 * Yolun kaynağı iki yolda farklı — korumalı rota kapısı çağıranından,
 * render ortasında yakalanan oturum bitişi vekilin yazdığı başlıktan alır —
 * ama hedefin biçimi ve güvenlik denetimi burada birleşir. Ayrışsalardı
 * kullanıcı giriş sonrası iki yoldan iki farklı yere düşerdi.
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
