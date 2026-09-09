import type {
  AccountDeletionAction,
  SettingsAction,
  SettingsActionState,
} from "@/app/(uygulama)/hesap-actions";

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
  requestAccountDeletion: AccountDeletionAction;
};

export const initialSettingsActionState: SettingsActionState = { status: "idle" };
