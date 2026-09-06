import type { SettingsAction } from "@/app/(uygulama)/hesap-actions";
import { NotificationPreferencesForm } from "@/components/profile/notification-preferences-form";
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
      />
      <section className="settings-card" aria-labelledby="bildirim-tercihleri-baslik">
        <h2 id="bildirim-tercihleri-baslik">Bildirim tercihleri</h2>
        <p className="muted">İşlemsel bildirimler hesap güvenliği için kapatılamaz.</p>
        <NotificationPreferencesForm preferences={preferences} />
      </section>
    </>
  );
}

function NotificationCenter({
  feed,
  markReadAction,
  markAllReadAction,
}: {
  feed: NotificationFeed;
  markReadAction: SettingsAction;
  markAllReadAction: SettingsAction;
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
        <p className="settings-empty">Henüz bildirimin yok.</p>
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
