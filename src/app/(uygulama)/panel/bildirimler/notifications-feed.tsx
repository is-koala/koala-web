"use client";

import type { SettingsAction } from "@/app/(uygulama)/hesap-actions";
import { NotificationCenter } from "@/components/account-settings/notification-settings";
import { workerNotificationsPath } from "@/lib/app-routes";
import type { NotificationFeed } from "@/server/account-settings/settings";

/**
 * Sayfanın istemci sınırı: okundu işaretleme düğmeleri `useActionState`
 * kullanıyor ve sunucu bileşeni onları doğrudan çizemez. Sayfa bağlantısı
 * düz `?sayfa=`; hesap kartındaki çıpa burada gereksiz, sayfa zaten akışın kendisi.
 */
export function NotificationsFeed({
  feed,
  markReadAction,
  markAllReadAction,
}: {
  feed: NotificationFeed;
  markReadAction: SettingsAction;
  markAllReadAction: SettingsAction;
}) {
  return (
    <NotificationCenter
      feed={feed}
      markReadAction={markReadAction}
      markAllReadAction={markAllReadAction}
      pageHref={(page) => (page <= 1 ? workerNotificationsPath : `${workerNotificationsPath}?sayfa=${page}`)}
    />
  );
}
