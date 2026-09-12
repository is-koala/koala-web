import { NextResponse, type NextRequest } from "next/server";

import { isSameOriginRequest } from "@/lib/same-origin";
import { deviceIdCookieOptions, requestPathHeader, sessionCookies } from "@/server/contract";
import { createDeviceId, isValidDeviceId } from "@/server/session/device-id";

/** Durum değiştirmeyen yöntemler; çapraz origin gezinmeyle çalışabilirler. */
const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * İsteğin en önündeki BFF kapısı.
 *
 * Üç işi var: cookie tabanlı oturumun doğurduğu CSRF yüzeyine karşı
 * `SameSite=Lax` üstüne origin doğrulaması koymak, cihaz kimliğini çözmek ve
 * isteğin yolunu ileri taşımak. Server component'ler render sırasında çerez
 * yazamadığı için kimlik burada üretilip hem yanıta hem gelen isteğe konur;
 * böylece SSR ile sonraki kullanıcı eylemleri aynı kimliği taşır.
 */
export function proxy(request: NextRequest) {
  if (!safeMethods.has(request.method) && !isSameOriginRequest(request)) {
    return new NextResponse(null, { status: 403 });
  }

  // Yolu tarayıcı değil vekil söyler: aynı adla gelen bir başlık üzerine
  // yazılır, yoksa kullanıcı kendi dönüş hedefini uydurabilirdi.
  request.headers.set(requestPathHeader, `${request.nextUrl.pathname}${request.nextUrl.search}`);

  const existing = request.cookies.get(sessionCookies.deviceId)?.value;
  if (isValidDeviceId(existing)) {
    return NextResponse.next({ request });
  }

  // Kimlik yalnız çerez yokken üretilir, ama üretim istekler arası
  // koordinasyonsuzdur: boş kavanozla aynı anda gelen iki gezinme iki ayrı
  // kimlik alır ve tarayıcıda son gelen `Set-Cookie` kazanır. Yavaş yanıt
  // veren gezinmenin çerezi giriş yapıldıktan SONRA düşerse, oturum did1'e
  // bağlıyken çerez did2 olur ve backend oturumu pasifleştirir
  // (`AUTH_SESSION_NOT_MATCHING_CURRENT_DEVICE`, geri dönüşü yok). Vekil bunu
  // tek başına kapatamaz — tarayıcıda atomik çerez denetimi yok. Kapanacağı
  // yer giriş akışı (#15): oturum kurulduğunda `koala_did`, oturumun gerçekte
  // bağlandığı kimlikle yeniden yazılmalı; geç düşen çerez böylece düzeltilir.
  const deviceId = createDeviceId();
  request.cookies.set(sessionCookies.deviceId, deviceId);

  const response = NextResponse.next({ request });
  response.cookies.set(sessionCookies.deviceId, deviceId, deviceIdCookieOptions);
  return response;
}

/**
 * Eksik origin de reddedilir: tarayıcı durum değiştiren isteklerde bu
 * başlığı her zaman gönderir, yokluğu isteğin tarayıcıdan gelmediğini
 * ya da araya girildiğini gösterir.
 */
export const config = {
  // Kimlik gövdesi 42 MiB'a çıkabilir. Proxy bu rotayı klonlarsa Next'in
  // genel 10 MiB sınırında kesilir; rota aynı CSRF kapısını kendisi uygular.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/users/me/identity-documents$).*)"],
};
