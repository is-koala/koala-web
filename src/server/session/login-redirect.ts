import "server-only";

import { headers } from "next/headers";

import { loginPath } from "@/lib/site";
import { requestPathHeader } from "@/server/contract";

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

/**
 * Render edilen sayfanın yolu.
 *
 * Server component'ler — layout'lar dahil — kendi adreslerini okuyamaz. Yolu
 * `src/proxy.ts` her isteğe yazıyor ve tarayıcıdan gelen aynı adlı başlığın
 * üzerine geçiyor, yani kullanıcı kendi dönüş hedefini uyduramıyor.
 */
export async function currentRequestPath(): Promise<string> {
  const requestHeaders = await headers();
  return requestHeaders.get(requestPathHeader) ?? "";
}

/**
 * Oturum render ortasında geçersizleştiğinde gidilecek giriş adresi.
 *
 * Üç çağıranı var — kabuk kapısı, oturumlu çağrının yenileme yolu ve profil
 * okuyucusu — ve üçü de kullanıcıyı aynı yere bırakmak zorunda. Ayrı ayrı
 * yazılsalardı biri dönüş hedefini taşımayı unuttuğunda kullanıcı sessizce
 * ana sayfaya düşerdi.
 */
export async function currentPathLoginRedirect(): Promise<string> {
  return loginRedirect(await currentRequestPath());
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

/** Dönüş hedefi yokken kullanıcının bırakılacağı yer. */
const defaultDestination = "/";

/**
 * `?next=` parametresinin okunmuş hâli.
 *
 * Giriş formuna gelen değer tarayıcıdan geçtiği için `loginRedirect`'in
 * ürettiği hedefle aynı olduğu varsayılamaz: kullanıcı adres çubuğunda
 * değiştirebilir. Aynı `sameSitePath` denetiminden geçirmek, giriş sayfasının
 * açık yönlendirme aracına dönmesini engeller; hedef yoksa ana sayfaya düşer.
 */
export function returnDestination(candidate: string | undefined | null): string {
  return (candidate && sameSitePath(candidate)) || defaultDestination;
}
