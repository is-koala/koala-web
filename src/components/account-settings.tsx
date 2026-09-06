"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import type {
  SettingsAction,
  SettingsActionState,
} from "@/app/(uygulama)/hesap-actions";
import { FieldError, FormAlert, SubmitButton, TextField } from "@/components/form-controls";
import { NotificationPreferencesForm } from "@/components/profile/notification-preferences-form";
import { fieldError } from "@/lib/form-state";
import { minPasswordLength, passwordPattern, passwordRequirement } from "@/lib/password";
import type {
  AccountSession,
  AccountSettingsData,
  BankAccount,
  Notification,
} from "@/server/account-settings/settings";
import type { PendingVerification } from "@/server/profile/profile";

export type AccountSettingsViewer = {
  email: string;
  phoneNumber: string;
  emailVerified: boolean;
  phoneVerified: boolean;
};

export type AccountSettingsActions = {
  addBankAccount: SettingsAction;
  selectPrimaryBankAccount: SettingsAction;
  deleteBankAccount: SettingsAction;
  updateContact: SettingsAction;
  confirmVerification: SettingsAction;
  updatePassword: SettingsAction;
  markNotificationRead: SettingsAction;
  markAllNotificationsRead: SettingsAction;
  revokeSession: SettingsAction;
  revokeOtherSessions: SettingsAction;
};

const initialState: SettingsActionState = { status: "idle" };

export function AccountSettings({
  viewer,
  data,
  actions,
}: {
  viewer: AccountSettingsViewer;
  data: AccountSettingsData;
  actions: AccountSettingsActions;
}) {
  return (
    <section className="app-panel account-settings">
      <p className="eyebrow">Hesap</p>
      <h1>Hesap ve ayarlar</h1>
      <p className="lede">Ödeme hesabını, güvenliğini ve bildirimlerini tek yerden yönet.</p>

      <nav className="settings-jump" aria-label="Ayar bölümleri">
        <a href="#banka-hesaplari">Banka hesapları</a>
        <a href="#iletisim">İletişim</a>
        <a href="#guvenlik">Güvenlik</a>
        <a href="#bildirimler">Bildirimler</a>
        <a href="#oturumlar">Oturumlar</a>
      </nav>

      <BankAccounts accounts={data.bankAccounts} actions={actions} />
      <ContactSettings viewer={viewer} actions={actions} />
      <PasswordSettings action={actions.updatePassword} />
      <NotificationCenter feed={data.notifications} actions={actions} />
      <section className="settings-card" aria-labelledby="bildirim-tercihleri-baslik">
        <h2 id="bildirim-tercihleri-baslik">Bildirim tercihleri</h2>
        <p className="muted">İşlemsel bildirimler hesap güvenliği için kapatılamaz.</p>
        <NotificationPreferencesForm preferences={data.preferences} />
      </section>
      <Sessions sessions={data.sessions} actions={actions} />
    </section>
  );
}

function BankAccounts({
  accounts,
  actions,
}: {
  accounts: readonly BankAccount[];
  actions: AccountSettingsActions;
}) {
  const [state, submit] = useActionState(actions.addBankAccount, initialState);

  return (
    <section className="settings-card" id="banka-hesaplari" aria-labelledby="banka-hesaplari-baslik">
      <div className="settings-heading">
        <div>
          <h2 id="banka-hesaplari-baslik">Banka hesapları</h2>
          <p>Ödemeler birincil hesabına yönlendirilir.</p>
        </div>
      </div>

      {accounts.length === 0 ? (
        <p className="settings-empty">Henüz banka hesabın yok.</p>
      ) : (
        <ul className="settings-list">
          {accounts.map((account) => (
            <BankAccountRow key={account.id} account={account} actions={actions} />
          ))}
        </ul>
      )}

      <form className="form settings-form" action={submit}>
        <FormAlert state={state} />
        {state.status === "done" ? (
          <p className="inline-success" role="status" aria-label="Banka hesabı sonucu">
            Banka hesabın eklendi.
          </p>
        ) : null}
        <TextField
          name="iban"
          label="IBAN"
          autoComplete="off"
          maxLength={34}
          hint="TR ile başlayan 26 haneli IBAN'ını gir. Kaydettikten sonra yalnız maskeli hâli görünür."
          error={fieldError(state, "iban")}
        />
        <SubmitButton label="Hesap ekle" pendingLabel="Ekleniyor…" />
      </form>
    </section>
  );
}

function BankAccountRow({
  account,
  actions,
}: {
  account: BankAccount;
  actions: AccountSettingsActions;
}) {
  return (
    <li className="settings-list-item">
      <div>
        <strong className="masked-value">{account.maskedIban}</strong>
        <div className="status-row">
          {account.primary ? <span className="status-pill">Birincil hesap</span> : null}
          <span className="muted">{bankVerificationLabel(account.verificationStatus)}</span>
        </div>
      </div>
      <div className="compact-actions">
        {!account.primary ? (
          <ResourceAction
            action={actions.selectPrimaryBankAccount}
            field="accountId"
            value={account.id}
            label="Birincil yap"
            pendingLabel="Seçiliyor…"
          />
        ) : null}
        <ResourceAction
          action={actions.deleteBankAccount}
          field="accountId"
          value={account.id}
          label="Sil"
          pendingLabel="Siliniyor…"
          secondary
        />
      </div>
    </li>
  );
}

function ContactSettings({
  viewer,
  actions,
}: {
  viewer: AccountSettingsViewer;
  actions: AccountSettingsActions;
}) {
  return (
    <section className="settings-card" id="iletisim" aria-labelledby="iletisim-baslik">
      <h2 id="iletisim-baslik">İletişim bilgileri</h2>
      <div className="contact-grid">
        <ContactForm
          kind="email"
          title="E-posta"
          current={viewer.email}
          verified={viewer.emailVerified}
          action={actions.updateContact}
          confirmAction={actions.confirmVerification}
        />
        <ContactForm
          kind="phone"
          title="Telefon"
          current={viewer.phoneNumber}
          verified={viewer.phoneVerified}
          action={actions.updateContact}
          confirmAction={actions.confirmVerification}
        />
      </div>
    </section>
  );
}

function ContactForm({
  kind,
  title,
  current,
  verified,
  action,
  confirmAction,
}: {
  kind: "email" | "phone";
  title: string;
  current: string;
  verified: boolean;
  action: SettingsAction;
  confirmAction: SettingsAction;
}) {
  const [state, submit] = useActionState(action, initialState);

  return (
    <div className="contact-card">
      <h3>{title}</h3>
      <p className="masked-value">{current || "Eklenmemiş"}</p>
      <p className={verified ? "status-pill" : "status-pill status-pill-warn"}>
        {verified ? "Doğrulandı" : "Doğrulanmadı"}
      </p>
      <form className="form settings-form" action={submit}>
        <FormAlert state={state} />
        <input type="hidden" name="kind" value={kind} readOnly />
        <TextField
          id={`new-${kind}`}
          name="value"
          label={kind === "email" ? "Yeni e-posta" : "Yeni telefon"}
          type={kind === "email" ? "email" : "text"}
          inputMode={kind === "email" ? "email" : "text"}
          autoComplete={kind === "email" ? "email" : "tel"}
          maxLength={kind === "email" ? 254 : 32}
          error={fieldError(state, "value")}
        />
        <SubmitButton
          label={kind === "email" ? "E-postayı değiştir" : "Telefonu değiştir"}
          pendingLabel="Gönderiliyor…"
        />
      </form>
      {state.status === "done" && state.verification ? (
        <VerificationForm verification={state.verification} action={confirmAction} />
      ) : state.status === "done" ? (
        <p className="inline-success" role="status">Bilgin güncellendi.</p>
      ) : null}
    </div>
  );
}

function VerificationForm({
  verification,
  action,
}: {
  verification: PendingVerification;
  action: SettingsAction;
}) {
  const [state, submit] = useActionState(action, initialState);
  return (
    <form className="form verification-form" action={submit}>
      <p>
        {verification.sentTo} {verification.type === "PHONE" ? "numarasına" : "adresine"} gönderilen
        kodu gir.
      </p>
      <FormAlert state={state} />
      {state.status === "done" ? <p className="inline-success" role="status">Doğrulama tamamlandı.</p> : null}
      <input type="hidden" name="verificationId" value={verification.id} readOnly />
      <TextField
        id={`verification-${verification.id}-token`}
        name="token"
        label="Doğrulama kodu"
        inputMode="text"
        autoComplete="one-time-code"
        maxLength={128}
        error={fieldError(state, "token")}
      />
      <SubmitButton label="Kodu doğrula" pendingLabel="Doğrulanıyor…" />
    </form>
  );
}

function PasswordSettings({ action }: { action: SettingsAction }) {
  const [state, submit] = useActionState(action, initialState);
  return (
    <section className="settings-card" id="guvenlik" aria-labelledby="guvenlik-baslik">
      <h2 id="guvenlik-baslik">Parola</h2>
      <form className="form settings-form" action={submit}>
        <FormAlert state={state} />
        {state.status === "done" ? <p className="inline-success" role="status">Parolan güncellendi.</p> : null}
        <TextField
          name="currentPassword"
          label="Mevcut parola"
          type="password"
          autoComplete="current-password"
          error={fieldError(state, "currentPassword")}
        />
        <TextField
          name="newPassword"
          label="Yeni parola"
          type="password"
          autoComplete="new-password"
          minLength={minPasswordLength}
          pattern={passwordPattern}
          hint={passwordRequirement}
          error={fieldError(state, "newPassword")}
        />
        <TextField
          name="confirmNewPassword"
          label="Yeni parola (tekrar)"
          type="password"
          autoComplete="new-password"
          minLength={minPasswordLength}
          error={fieldError(state, "confirmNewPassword")}
        />
        <SubmitButton label="Parolayı güncelle" pendingLabel="Güncelleniyor…" />
      </form>
    </section>
  );
}

function NotificationCenter({
  feed,
  actions,
}: {
  feed: AccountSettingsData["notifications"];
  actions: AccountSettingsActions;
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
            action={actions.markAllNotificationsRead}
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
              action={actions.markNotificationRead}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function NotificationRow({ notification, action }: { notification: Notification; action: SettingsAction }) {
  return (
    <li className={notification.readAt ? "notification-item is-read" : "notification-item"}>
      <div>
        <p className="notification-meta">{notificationCategoryLabel(notification.category)} · {formatDate(notification.sentAt)}</p>
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

function Sessions({
  sessions,
  actions,
}: {
  sessions: readonly AccountSession[];
  actions: AccountSettingsActions;
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
            action={actions.revokeOtherSessions}
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
                <p className="muted">{session.location || "Konum bilgisi yok"} · Son kullanım {formatDate(session.lastAccessedAt)}</p>
                {session.current ? <span className="status-pill">Bu cihaz</span> : null}
              </div>
              {session.current ? (
                <Link className="button button-secondary button-small" href="/cikis">Bu cihazdan çıkış yap</Link>
              ) : (
                <ResourceAction
                  action={actions.revokeSession}
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

function ResourceAction({
  action,
  field,
  value,
  label,
  pendingLabel,
  secondary = false,
}: {
  action: SettingsAction;
  field: string;
  value: string;
  label: string;
  pendingLabel: string;
  secondary?: boolean;
}) {
  const [state, submit] = useActionState(action, initialState);
  return (
    <form className="compact-form" action={submit}>
      <FormAlert state={state} />
      <FieldError message={fieldError(state, field)} />
      <input type="hidden" name={field} value={value} readOnly />
      <CompactSubmitButton
        label={label}
        pendingLabel={pendingLabel}
        secondary={secondary}
      />
      {state.status === "done" ? <span className="sr-only" role="status">İşlem tamamlandı.</span> : null}
    </form>
  );
}

function CompactSubmitButton({
  label,
  pendingLabel,
  secondary,
}: {
  label: string;
  pendingLabel: string;
  secondary: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      className={`button button-small ${secondary ? "button-secondary" : "button-primary"}`}
      type="submit"
      disabled={pending}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

function SimpleAction({
  action,
  label,
  pendingLabel,
}: {
  action: SettingsAction;
  label: string;
  pendingLabel: string;
}) {
  const [state, submit] = useActionState(action, initialState);
  return (
    <form className="compact-form" action={submit}>
      <FormAlert state={state} />
      <SubmitButton label={label} pendingLabel={pendingLabel} />
    </form>
  );
}

function bankVerificationLabel(status: string) {
  if (status === "VERIFIED") return "Doğrulandı";
  if (status === "PENDING") return "Doğrulama bekliyor";
  if (status === "REJECTED") return "Doğrulanamadı";
  if (status === "UNVERIFIED") return "Doğrulanmadı";
  if (status === "EXPIRED") return "Doğrulama süresi doldu";
  return `Durum: ${status}`;
}

function notificationCategoryLabel(category: string) {
  return {
    ACCOUNT_SECURITY: "Hesap güvenliği",
    APPLICATION_UPDATES: "Başvuru güncellemeleri",
    IDENTITY_VERIFICATION: "Kimlik doğrulama",
    MARKETINGS: "Kampanyalar",
    COMPANY_UPDATES: "Şirket güncellemeleri",
    JOB_ALERTS: "İş ilanı uyarıları",
    NEWSLETTER: "Bülten",
  }[category] ?? category;
}

function deviceLabel(type: string) {
  return { WEB: "Web tarayıcısı", MOBILE: "Mobil cihaz" }[type] ?? "Bilinmeyen cihaz";
}

function formatDate(value: string | null) {
  if (!value) return "Tarih yok";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "Tarih yok";
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
