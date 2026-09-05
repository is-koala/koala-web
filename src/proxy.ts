import { NextResponse, type NextRequest } from "next/server";

import {
  deviceIdMaxAgeSeconds,
  secureCookieOptions,
  sessionCookies,
} from "@/server/contract";
import { createDeviceId, isValidDeviceId } from "@/server/session/device-id";

/** Durum değiştirmeyen yöntemler; çapraz origin gezinmeyle çalışabilirler. */
const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * İsteğin en önündeki BFF kapısı.
 *
 * İki işi var: cookie tabanlı oturumun doğurduğu CSRF yüzeyine karşı
 * `SameSite=Lax` üstüne origin doğrulaması koymak ve cihaz kimliğini
 * çözmek. Server component'ler render sırasında çerez yazamadığı için
 * kimlik burada üretilip hem yanıta hem gelen isteğe konur; böylece SSR
 * ile sonraki kullanıcı eylemleri aynı kimliği taşır.
 */
export function proxy(request: NextRequest) {
  if (!safeMethods.has(request.method) && !isSameOrigin(request)) {
    return new NextResponse(null, { status: 403 });
  }

  const existing = request.cookies.get(sessionCookies.deviceId)?.value;
  if (isValidDeviceId(existing)) {
    return NextResponse.next();
  }

  const deviceId = createDeviceId();
  request.cookies.set(sessionCookies.deviceId, deviceId);

  const response = NextResponse.next({ request });
  response.cookies.set(sessionCookies.deviceId, deviceId, {
    ...secureCookieOptions,
    maxAge: deviceIdMaxAgeSeconds,
  });
  return response;
}

/**
 * Eksik origin de reddedilir: tarayıcı durum değiştiren isteklerde bu
 * başlığı her zaman gönderir, yokluğu isteğin tarayıcıdan gelmediğini
 * ya da araya girildiğini gösterir.
 */
function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  const host = request.headers.get("host") ?? request.nextUrl.host;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
