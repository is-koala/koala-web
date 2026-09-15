import Link from "next/link";

import type { SettingsAction } from "@/app/(uygulama)/hesap-actions";
import { LinkPending } from "@/components/link-pending";
import { sessionDetailPath, type AppShellId } from "@/lib/app-routes";
import type { AccountSession } from "@/server/account-settings/settings";

import { ResourceAction, SimpleAction } from "./action-controls";
import { deviceTypeLabel, formatAccountDate, sessionLocationLabel } from "./presentation";

export function SessionSettings({
  shell,
  sessions,
  detailAvailable,
  revokeAction,
  revokeOtherAction,
}: {
  shell: AppShellId;
  sessions: readonly AccountSession[];
  /** Eski sunucuda ayrıntı ucu yok; satır o zaman bağlantısız kalır, uyarı da yok. */
  detailAvailable: boolean;
  revokeAction: SettingsAction;
  revokeOtherAction: SettingsAction;
}) {
  return (
    <section className="settings-card" id="oturumlar" aria-label="Oturumlar ve cihazlar">
      <div className="settings-heading">
        <div>
          <h2>Oturumlar ve cihazlar</h2>
          <p>Hesabının açık olduğu cihazları gözden geçir.</p>
        </div>
        {sessions.some((session) => !session.current) ? (
          <SimpleAction
            action={revokeOtherAction}
            label="Diğer tüm oturumları kapat"
            pendingLabel="Kapatılıyor…"
          />
        ) : null}
      </div>
      {sessions.length === 0 ? (
        <p className="settings-empty">Açık oturum bulunamadı.</p>
      ) : (
        <ul className="settings-list">
          {sessions.map((session) => (
            <li className="settings-list-item" key={session.id}>
              <div>
                <strong>
                  {detailAvailable ? (
                    // Bekleme göstergesi bağlantının içinde: ayrıntı sayfası
                    // `notFound()` çağırdığı için yanına `loading.tsx` konamıyor.
                    <Link className="text-link" href={sessionDetailPath(shell, session.id)}>
                      {session.deviceName || deviceTypeLabel(session.deviceType)}
                      <LinkPending />
                    </Link>
                  ) : (
                    session.deviceName || deviceTypeLabel(session.deviceType)
                  )}
                </strong>
                <p className="muted">
                  {sessionLocationLabel(session.location)} · Son kullanım{" "}
                  {formatAccountDate(session.lastAccessedAt)}
                </p>
                {session.current ? <span className="status-pill">Bu cihaz</span> : null}
              </div>
              {session.current ? (
                <Link className="button button-secondary button-small" href="/cikis">
                  Bu cihazdan çıkış yap
                </Link>
              ) : (
                <ResourceAction
                  action={revokeAction}
                  field="sessionId"
                  value={session.id}
                  label={`${session.deviceName || "Cihaz"} oturumunu kapat`}
                  pendingLabel="Kapatılıyor…"
                  secondary
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
