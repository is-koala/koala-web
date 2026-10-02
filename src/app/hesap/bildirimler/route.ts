import { redirect } from "next/navigation";

import { accountNotificationPreferencesHref } from "@/lib/app-routes";
import { notificationPreferencesEntryPath } from "@/lib/notification-routes";
import { loginRedirect } from "@/server/session/login-redirect";
import { readSession } from "@/server/session/session";
import { viewerShell } from "@/server/session/viewer";

export const dynamic = "force-dynamic";

/**
 * Rolü bilmeyen bağlantıların bildirim tercihleri adresi (is-koala/koala-web#54).
 *
 * Ticari e-postanın çıkış sayfası kullanıcının çalışan mı işveren mi olduğunu
 * bilmiyor ve tercihler iki kabukta ayrı adreste (`/panel/hesap`,
 * `/isveren/hesap`). Oturum yoksa ziyaretçi girişe, dönüşü bu adrese olacak
 * biçimde gider; `?next=` mevcut `safeInternalPath` denetiminden geçiyor.
 * Oturum varsa rol `GET /users/me`'den okunur. Rol okunamazsa kabuk tahmin
 * edilmez (`postLoginDestination` ile aynı kural): yanlış kabuk kullanıcıya
 * "hesabın işveren değil" şeridiyle açılırdı. Oturum render ortasında biterse
 * profil okuyucusunun giriş yönlendirmesi olduğu gibi geçer.
 */
export async function GET(): Promise<never> {
  const { refreshToken } = await readSession();
  if (!refreshToken) redirect(loginRedirect(notificationPreferencesEntryPath));

  const shell = await viewerShell();
  redirect(shell === null ? "/" : accountNotificationPreferencesHref(shell));
}
