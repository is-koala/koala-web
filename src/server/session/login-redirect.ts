import "server-only";

import { headers } from "next/headers";

import { shellHomePath, type AppShellId } from "@/lib/app-routes";
import { loginPath } from "@/lib/site";
import { safeInternalPath } from "@/lib/urls";
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
  const safe = safeInternalPath(nextPath);
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

/** Rolü okunamayan kullanıcının bırakılacağı yer. */
const defaultDestination = "/";

/**
 * `?next=` parametresinin okunmuş hâli.
 *
 * Giriş formuna gelen değer tarayıcıdan geçtiği için `loginRedirect`'in
 * ürettiği hedefle aynı olduğu varsayılamaz: kullanıcı adres çubuğunda
 * değiştirebilir. Aynı `safeInternalPath` denetiminden geçirmek, giriş sayfasının
 * açık yönlendirme aracına dönmesini engeller. Hedef yoksa `null`: nereye
 * gidileceğine giriş **sonrası**, kullanıcının rolüyle karar veriliyor
 * (`postLoginDestination`).
 */
export function returnDestination(candidate: string | undefined | null): string | null {
  return safeInternalPath(candidate);
}

/**
 * Giriş sonrası hedef.
 *
 * Dönülecek bir sayfa varsa oraya — kullanıcı kapıya takıldığı yere geri
 * bırakılır. Yoksa kabuğuna: çalışan `/panel`, işveren `/isveren`
 * (is-koala/koala-web#154). Rolü okunamadıysa ana sayfa; kabuk tahmin
 * edilmez, çünkü yanlış kabuk kullanıcıya "hesabın işveren değil" şeridiyle
 * açılırdı.
 */
export function postLoginDestination(
  candidate: string | undefined | null,
  shell: AppShellId | null,
): string {
  return returnDestination(candidate) ?? (shell === null ? defaultDestination : shellHomePath(shell));
}
