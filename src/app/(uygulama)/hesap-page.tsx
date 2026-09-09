import { unstable_rethrow } from "next/navigation";

import { AccountSettings, type AccountSettingsActions } from "@/components/account-settings";
import { ErrorState } from "@/components/states";
import {
  loadAccountSettings,
  type AccountSettingsData,
} from "@/server/account-settings/settings";
import { failureView } from "@/server/form";
import { enterShell } from "@/server/session/viewer";

import {
  addBankAccountAction,
  confirmVerificationAction,
  deleteBankAccountAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
  revokeOtherSessionsAction,
  revokeSessionAction,
  requestAccountDeletionAction,
  selectPrimaryBankAccountAction,
  updateContactAction,
  updatePasswordAction,
} from "./hesap-actions";

const actions: AccountSettingsActions = {
  addBankAccount: addBankAccountAction,
  selectPrimaryBankAccount: selectPrimaryBankAccountAction,
  deleteBankAccount: deleteBankAccountAction,
  updateContact: updateContactAction,
  confirmVerification: confirmVerificationAction,
  updatePassword: updatePasswordAction,
  markNotificationRead: markNotificationReadAction,
  markAllNotificationsRead: markAllNotificationsReadAction,
  revokeSession: revokeSessionAction,
  revokeOtherSessions: revokeOtherSessionsAction,
  requestAccountDeletion: requestAccountDeletionAction,
};

export type AccountPageProps = {
  searchParams?: Promise<{ bildirimSayfasi?: string | string[] }>;
};

export async function AccountPage({ searchParams }: AccountPageProps = {}) {
  const { viewer } = await enterShell();
  if (viewer === null) return null;

  let data: AccountSettingsData;
  try {
    data = await loadAccountSettings(await notificationPageFrom(searchParams));
  } catch (error) {
    unstable_rethrow(error);
    const failure = failureView(error);
    return (
      <section className="app-panel" aria-labelledby="hesap-hata-baslik">
        <p className="eyebrow">Hesap</p>
        <h1 id="hesap-hata-baslik">Hesap ve ayarlar</h1>
        <ErrorState errorCode={failure.errorCode} status={failure.httpStatus} />
      </section>
    );
  }

  return (
    <AccountSettings
      viewer={{
        email: viewer.email,
        phoneNumber: viewer.phoneNumber,
        emailVerified: viewer.emailVerified,
        phoneVerified: viewer.phoneVerified,
      }}
      data={data}
      actions={actions}
    />
  );
}

async function notificationPageFrom(searchParams: AccountPageProps["searchParams"]): Promise<number> {
  const value = (await searchParams)?.bildirimSayfasi;
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return 0;
  const page = Number(value);
  return Number.isSafeInteger(page) ? page - 1 : 0;
}

export function AccountLoading() {
  return (
    <section className="app-panel" role="status" aria-live="polite">
      <p className="eyebrow">Hesap</p>
      <h1>Hesap ve ayarlar</h1>
      <p>Ayarların yükleniyor…</p>
    </section>
  );
}
