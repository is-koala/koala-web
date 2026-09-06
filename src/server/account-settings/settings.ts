import "server-only";

import type { NotificationPreference } from "@/lib/profile";
import { backendPaths } from "@/server/contract";
import { getNotificationPreferences } from "@/server/profile/profile";
import { apiRequest } from "@/server/session/session";

/** Backend'in ham IBAN yerine döndürdüğü güvenli hesap görünümü. */
export type BankAccount = {
  id: string;
  maskedIban: string;
  primary: boolean;
  /** Backend yeni doğrulama durumları ekleyebilir; bilinmeyen değer gösterimi bozmaz. */
  verificationStatus: string;
};

export type Notification = {
  id: string;
  channel: string;
  category: string;
  subject: string | null;
  body: string;
  targetType: string | null;
  targetId: string | null;
  status: string;
  sentAt: string | null;
  readAt: string | null;
};

export type Page<T> = {
  content: readonly T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
};

export type NotificationFeed = {
  notifications: Page<Notification>;
  unreadCount: number;
};

export type AccountSession = {
  id: string;
  deviceType: string;
  deviceName: string | null;
  location: string | null;
  lastAccessedAt: string;
  current: boolean;
};

type AccountSessionDto = AccountSession & {
  deviceId: string;
  ipAddress: string | null;
  refreshExpiresAt: string;
};

export type PasswordChange = {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
};

export type AccountSettingsData = {
  bankAccounts: readonly BankAccount[];
  notifications: NotificationFeed;
  preferences: readonly NotificationPreference[];
  sessions: readonly AccountSession[];
};

export async function loadAccountSettings(notificationPage = 0): Promise<AccountSettingsData> {
  const [bankAccounts, notifications, preferences, sessions] = await Promise.all([
    listBankAccounts(),
    listNotifications(notificationPage),
    getNotificationPreferences(),
    listSessions(),
  ]);
  return { bankAccounts, notifications, preferences, sessions };
}

export async function listBankAccounts(): Promise<readonly BankAccount[]> {
  return apiRequest<BankAccount[]>(backendPaths.bankAccounts);
}

export async function addBankAccount(iban: string): Promise<BankAccount> {
  return apiRequest<BankAccount>(backendPaths.bankAccounts, {
    method: "POST",
    body: { iban },
  });
}

export async function selectPrimaryBankAccount(accountId: string): Promise<BankAccount> {
  return apiRequest<BankAccount>(`${backendPaths.bankAccounts}/${encodeURIComponent(accountId)}/primary`, {
    method: "POST",
  });
}

export async function deleteBankAccount(accountId: string): Promise<void> {
  await apiRequest(`${backendPaths.bankAccounts}/${encodeURIComponent(accountId)}`, { method: "DELETE" });
}

export async function confirmVerification(verificationId: string, token: string): Promise<void> {
  await apiRequest(`/verifications/${encodeURIComponent(verificationId)}/confirm`, {
    method: "POST",
    body: { token },
  });
}

export async function updatePassword(change: PasswordChange): Promise<void> {
  await apiRequest(backendPaths.changePassword, { method: "PUT", body: change });
}

export async function listNotifications(page = 0): Promise<NotificationFeed> {
  const path = page > 0 ? `${backendPaths.notifications}?page=${page}` : backendPaths.notifications;
  return apiRequest<NotificationFeed>(path);
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  await apiRequest(`${backendPaths.notifications}/${encodeURIComponent(notificationId)}/read`, { method: "POST" });
}

export async function markAllNotificationsRead(): Promise<number> {
  return apiRequest<number>(`${backendPaths.notifications}/read`, { method: "POST" });
}

export async function listSessions(): Promise<readonly AccountSession[]> {
  const sessions = await apiRequest<AccountSessionDto[]>(backendPaths.sessions);
  return sessions.map(({ id, deviceType, deviceName, location, lastAccessedAt, current }) => ({
    id,
    deviceType,
    deviceName,
    location,
    lastAccessedAt,
    current,
  }));
}

export async function revokeSession(sessionId: string): Promise<void> {
  await apiRequest(`${backendPaths.sessions}/${encodeURIComponent(sessionId)}`, { method: "DELETE" });
}

export async function revokeOtherSessions(): Promise<number> {
  return apiRequest<number>(backendPaths.sessions, { method: "DELETE" });
}
