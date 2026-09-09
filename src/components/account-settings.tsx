"use client";

import { BankAccounts } from "@/components/account-settings/bank-accounts";
import { AccountDeletionSettings } from "@/components/account-settings/account-deletion-settings";
import { ContactSettings } from "@/components/account-settings/contact-settings";
import { NotificationSettings } from "@/components/account-settings/notification-settings";
import { PasswordSettings } from "@/components/account-settings/password-settings";
import { SessionSettings } from "@/components/account-settings/session-settings";
import type {
  AccountSettingsActions,
  AccountSettingsViewer,
} from "@/components/account-settings/types";
import type { AccountSettingsData } from "@/server/account-settings/settings";

export type { AccountSettingsActions, AccountSettingsViewer } from "@/components/account-settings/types";

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
        <a href="#hesap-silme">Hesap silme</a>
      </nav>

      <BankAccounts
        accounts={data.bankAccounts}
        addAction={actions.addBankAccount}
        selectPrimaryAction={actions.selectPrimaryBankAccount}
        deleteAction={actions.deleteBankAccount}
      />
      <ContactSettings
        viewer={viewer}
        updateAction={actions.updateContact}
        confirmAction={actions.confirmVerification}
      />
      <PasswordSettings action={actions.updatePassword} />
      <NotificationSettings
        feed={data.notifications}
        preferences={data.preferences}
        markReadAction={actions.markNotificationRead}
        markAllReadAction={actions.markAllNotificationsRead}
      />
      <SessionSettings
        sessions={data.sessions}
        revokeAction={actions.revokeSession}
        revokeOtherAction={actions.revokeOtherSessions}
      />
      <AccountDeletionSettings
        initialStatus={data.accountDeletion}
        action={actions.requestAccountDeletion}
      />
    </section>
  );
}
