import "server-only";

import { redirect } from "next/navigation";

import { currentRequestPath, loginRedirect } from "./login-redirect";
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
 * Aynı kapı, adresini kendisi bulan hâli.
 *
 * Kabuk layout'u hangi sayfanın altında çizildiğini bilmiyor: server
 * component'ler kendi adreslerini okuyamaz. Yol vekilin yazdığı başlıktan
 * gelir; başlık hiç yoksa `loginRedirect` hedefsiz giriş adresine düşer.
 */
export async function requireSessionForCurrentPath(): Promise<Session> {
  return requireSession(await currentRequestPath());
}
