import Link from "next/link";

import type { SettingsAction } from "@/app/(uygulama)/hesap-actions";
import { NotificationPreferencesForm } from "@/components/profile/notification-preferences-form";
import { notificationPreferencesAnchor } from "@/lib/notification-routes";
import { notificationCategoryLabel, type NotificationPreference } from "@/lib/profile";
import type { Notification, NotificationFeed } from "@/server/account-settings/settings";

import { ResourceAction, SimpleAction } from "./action-controls";
import { formatAccountDate } from "./presentation";

export function NotificationSettings({
  feed,
  preferences,
  markReadAction,
  markAllReadAction,
}: {
  feed: NotificationFeed;
  preferences: readonly NotificationPreference[];
  markReadAction: SettingsAction;
  markAllReadAction: SettingsAction;
}) {
  return (
    <>
      <NotificationCenter
        feed={feed}
        markReadAction={markReadAction}
        markAllReadAction={markAllReadAction}
        pageHref={(page) => `?bildirimSayfasi=${page}#bildirimler`}
      />
      <section
        className="settings-card"
        id={notificationPreferencesAnchor}
        aria-labelledby="bildirim-tercihleri-baslik"
      >
        <h2 id="bildirim-tercihleri-baslik">Bildirim tercihleri</h2>
        <p className="muted">İşlemsel bildirimler hesap güvenliği için kapatılamaz.</p>
        <NotificationPreferencesForm preferences={preferences} contactHref="#iletisim" />
      </section>
    </>
  );
}

/**
 * Bildirim akışı: okunmamış sayısı, liste ve sayfalama.
 *
 * İki adreste çiziliyor — hesap sayfasında bir kart olarak ve `/panel/bildirimler`
 * altında sayfanın kendisi olarak. Sayfa bağlantısını çağıran kuruyor: hesap
 * kartı kendi çıpasına dönerken bölüm sayfası düz `?sayfa=` taşıyor, ve aynı
 * listeyi iki kez yazmak iki sayfayı sessizce ayrıştırırdı.
 */
export function NotificationCenter({
  feed,
  markReadAction,
  markAllReadAction,
  pageHref,
}: {
  feed: NotificationFeed;
  markReadAction: SettingsAction;
  markAllReadAction: SettingsAction;
  /** 1 tabanlı, kullanıcıya görünen sayfa numarasından bağlantı üretir. */
  pageHref: (page: number) => string;
}) {
  return (
    <section className="settings-card" id="bildirimler" aria-label="Bildirim merkezi">
      <div className="settings-heading">
        <div>
          <h2>Bildirim merkezi</h2>
          <p>{feed.unreadCount} okunmamış bildirim</p>
        </div>
        {feed.unreadCount > 0 ? (
          <SimpleAction
            action={markAllReadAction}
            label="Tümünü okundu işaretle"
            pendingLabel="İşaretleniyor…"
          />
        ) : null}
      </div>
      {feed.notifications.content.length === 0 ? (
        <p className="settings-empty" role="status">Henüz bildirimin yok.</p>
      ) : (
        <ul className="notification-list">
          {feed.notifications.content.map((notification) => (
            <NotificationRow
              key={notification.id}
              notification={notification}
              action={markReadAction}
            />
          ))}
        </ul>
      )}
      {!feed.notifications.first || !feed.notifications.last ? (
        <nav className="compact-actions" aria-label="Bildirim sayfaları">
          {!feed.notifications.first ? (
            <Link
              className="button button-secondary button-small"
              href={pageHref(feed.notifications.page)}
            >
              Daha yeni bildirimler
            </Link>
          ) : null}
          {!feed.notifications.last ? (
            <Link
              className="button button-secondary button-small"
              href={pageHref(feed.notifications.page + 2)}
            >
              Daha eski bildirimler
            </Link>
          ) : null}
        </nav>
      ) : null}
    </section>
  );
}

function NotificationRow({
  notification,
  action,
}: {
  notification: Notification;
  action: SettingsAction;
}) {
  return (
    <li className={notification.readAt ? "notification-item is-read" : "notification-item"}>
      <div>
        <p className="notification-meta">
          {notificationCategoryLabel(notification.category)} · {formatAccountDate(notification.sentAt)}
        </p>
        <h3>{notification.subject || "Koala bildirimi"}</h3>
        <p>{notification.body}</p>
      </div>
      {!notification.readAt ? (
        <ResourceAction
          action={action}
          field="notificationId"
          value={notification.id}
          label="Okundu işaretle"
          pendingLabel="İşaretleniyor…"
          secondary
        />
      ) : null}
    </li>
  );
}
