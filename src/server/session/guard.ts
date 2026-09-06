import "server-only";

import { redirect } from "next/navigation";

import { loginRedirect } from "./login-redirect";
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
