import "server-only";

import { unstable_rethrow } from "next/navigation";

import type { NotificationPreference } from "@/lib/profile";
import { ApiError, safeRequestId } from "@/server/api/errors";
import { backendPaths, unexpectedError } from "@/server/contract";
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

/** Hesap silme talebinin kişisel gerekçeyi geri taşımayan güvenli görünümü. */
export type AccountDeletion = {
  /** Backend yeni bir yaşam döngüsü durumu ekleyebilir; sunum fail-closed davranır. */
  status: string;
  requestedAt: string;
  processedAt: string | null;
  blockedReason: string | null;
};

type AccountDeletionDto = AccountDeletion & {
  id: string;
  subjectId: string;
};

export type AccountDeletionLoadState =
  | { kind: "not-requested" }
  | { kind: "request"; deletion: AccountDeletion }
  | {
      kind: "error";
      errorCode: string;
      httpStatus: number;
      requestId: string | null;
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
  accountDeletion: AccountDeletionLoadState;
};

export async function loadAccountSettings(notificationPage = 0): Promise<AccountSettingsData> {
  const [bankAccounts, notifications, preferences, sessions, accountDeletion] = await Promise.all([
    listBankAccounts(),
    listNotifications(notificationPage),
    getNotificationPreferences(),
    listSessions(),
    loadAccountDeletionStatus(),
  ]);
  return { bankAccounts, notifications, preferences, sessions, accountDeletion };
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

export async function getAccountDeletion(): Promise<AccountDeletion> {
  return deletionView(
    await apiRequest<AccountDeletionDto>(backendPaths.accountDeletion, { cache: "no-store" }),
  );
}

export async function requestAccountDeletion(reason: string | null): Promise<AccountDeletion> {
  return deletionView(
    await apiRequest<AccountDeletionDto>(backendPaths.accountDeletion, {
      method: "POST",
      body: { reason },
    }),
  );
}

export async function loadAccountDeletionStatus(): Promise<AccountDeletionLoadState> {
  try {
    return { kind: "request", deletion: await getAccountDeletion() };
  } catch (error) {
    unstable_rethrow(error);
    if (
      error instanceof ApiError &&
      error.status === 404 &&
      error.errorCode === "LEGAL_DELETION_NOT_FOUND"
    ) {
      return { kind: "not-requested" };
    }
    return error instanceof ApiError
      ? {
          kind: "error",
          errorCode: error.errorCode,
          httpStatus: error.status,
          requestId: safeRequestId(error.requestId),
        }
      : {
          kind: "error",
          errorCode: unexpectedError,
          httpStatus: 500,
          requestId: null,
        };
  }
}

function deletionView(deletion: AccountDeletionDto): AccountDeletion {
  return {
    status: deletion.status,
    requestedAt: deletion.requestedAt,
    processedAt: deletion.processedAt,
    blockedReason: deletion.blockedReason,
  };
}
