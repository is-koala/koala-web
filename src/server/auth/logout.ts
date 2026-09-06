import "server-only";

import { backendPaths } from "@/server/contract";
import { clearSessionCookies } from "@/server/session/cookies";
import { apiRequest, readSession } from "@/server/session/session";

/**
 * Oturumu hem backend'de hem tarayıcıda kapatır.
 *
 * Backend `logout` süresi dolmamış bir erişim tokenı ister
 * (`jwtService.extractSessionId`, `AllowingExpired` değil) ve zaten
 * pasifleşmiş oturumda 404 döner. Bu yüzden çağrı oturum katmanı üzerinden
 * gider — süresi dolmuş token bir kez yenilenir — ve sonucu ne olursa olsun
 * yutulur: kullanıcının çıkmasını backend'in cevabı engellememeli. Cihaz
 * kimliği çerezi kalır; o oturumu değil tarayıcı profilini temsil eder.
 */
export async function signOut(): Promise<void> {
  const session = await readSession();

  if (session.accessToken || session.refreshToken) {
    try {
      await apiRequest(backendPaths.logout, { method: "POST" });
    } catch {
      // Yenileme de düşmüş olabilir; oturum katmanı bu durumda kendi
      // yönlendirmesini fırlatır. Çıkışın hedefi zaten oturumu bitirmek,
      // bu yüzden hata da yönlendirme de yutulur.
    }
  }

  await clearSessionCookies();
}
