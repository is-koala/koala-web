import Link from "next/link";

import type { SettingsAction } from "@/app/(uygulama)/hesap-actions";
import type { AccountSession } from "@/server/account-settings/settings";

import { ResourceAction, SimpleAction } from "./action-controls";
import { formatAccountDate } from "./presentation";

export function SessionSettings({
  sessions,
  revokeAction,
  revokeOtherAction,
}: {
  sessions: readonly AccountSession[];
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
                <strong>{session.deviceName || deviceLabel(session.deviceType)}</strong>
                <p className="muted">
                  {session.location || "Konum bilgisi yok"} · Son kullanım{" "}
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

function deviceLabel(type: string): string {
  return { WEB: "Web tarayıcısı", MOBILE: "Mobil cihaz" }[type] ?? "Bilinmeyen cihaz";
}
