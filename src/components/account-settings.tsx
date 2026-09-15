"use client";

import { BankAccounts } from "@/components/account-settings/bank-accounts";
import { AccountDeletionSettings } from "@/components/account-settings/account-deletion-settings";
import { ContactSettings } from "@/components/account-settings/contact-settings";
import { NotificationSettings } from "@/components/account-settings/notification-settings";
import { PasswordSettings } from "@/components/account-settings/password-settings";
import { SessionSettings } from "@/components/account-settings/session-settings";
import { PageHeader, PagePanel } from "@/components/ui";
import type {
  AccountSettingsActions,
  AccountSettingsViewer,
} from "@/components/account-settings/types";
import type { AppShellId } from "@/lib/app-routes";
import type { AccountSettingsData } from "@/server/account-settings/settings";

export type { AccountSettingsActions, AccountSettingsViewer } from "@/components/account-settings/types";

export function AccountSettings({
  shell,
  viewer,
  data,
  actions,
}: {
  /** Oturum satırları kendi kabuğunun ayrıntı adresine bağlanır. */
  shell: AppShellId;
  viewer: AccountSettingsViewer;
  data: AccountSettingsData;
  actions: AccountSettingsActions;
}) {
  return (
    <PagePanel className="account-settings">
      <PageHeader
        eyebrow="Hesap"
        title="Hesap ve ayarlar"
        lede="Ödeme hesabını, güvenliğini ve bildirimlerini tek yerden yönet."
      />

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
        verifyAction={actions.startBankAccountVerification}
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
        shell={shell}
        sessions={data.sessions}
        detailAvailable={data.sessionDetailAvailable}
        revokeAction={actions.revokeSession}
        revokeOtherAction={actions.revokeOtherSessions}
      />
      <AccountDeletionSettings
        initialStatus={data.accountDeletion}
        action={actions.requestAccountDeletion}
      />
    </PagePanel>
  );
}
