import "server-only";

import { unstable_rethrow } from "next/navigation";

import type { NotificationPreference } from "@/lib/profile";
import { ApiError, safeRequestId } from "@/server/api/errors";
import { backendPaths, unexpectedError } from "@/server/contract";
import { getNotificationPreferences } from "@/server/profile/profile";
import { apiRequest } from "@/server/session/session";

import { isSessionDetailAvailable } from "./session-detail";

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
  /**
   * Oturum satırları ayrıntı sayfasına bağlanır mı. 0.9.28 öncesi sunucuda
   * `GET /users/me/sessions/{id}` yok; satır o zaman düz metin kalır
   * (is-koala/koala-web#188).
   */
  sessionDetailAvailable: boolean;
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
  // Deneme listeden sonra ve yalnız bu isteğin kendi oturumuyla: o oturum
  // yeni sunucuda 404 dönemez, yani cevap sunucuyu söyler. Başka bir oturum
  // listeden sonra kapatılmış olabilir ve 404'ü sunucu sanılırdı. Liste
  // doluysa mevcut oturum hep içinde; yine de yoksa deneme yapılmaz ve
  // bağlantılar durur — sayfa 404'ü kendisi çizer.
  const current = sessions.find((session) => session.current);
  const sessionDetailAvailable = current ? await isSessionDetailAvailable(current.id) : true;
  return { bankAccounts, notifications, preferences, sessions, sessionDetailAvailable, accountDeletion };
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

/**
 * `IbanVerificationDto`. Sahiplik doğrulaması küçük tutarlı bir transferle
 * yapılıyor: kullanıcı kayıtlı IBAN'ından `targetIban`'a `amount` tutarını
 * `reference` açıklamasıyla gönderiyor; personel transferi görünce onaylıyor.
 * Tutar dize olarak taşınıyor — `money.ts` kayan noktadan bilerek kaçınıyor.
 */
export type IbanVerification = {
  accountId: string;
  maskedIban: string;
  status: string;
  reference: string;
  amount: string;
  currency: string;
  targetIban: string;
  expiresAt: string | null;
  attemptsLeft: number | null;
};

type IbanVerificationDto = {
  accountId?: string;
  maskedIban?: string;
  status?: string;
  reference?: string;
  amount?: number | string | null;
  targetIban?: string;
  expiresAt?: string | null;
  attemptsLeft?: number | null;
};

/**
 * Doğrulama transferini başlatır; bekleyen doğrulama varsa backend aynı
 * tutar ve referansı yeniden döndürür, yani düğmeye ikinci basış zararsız.
 */
export async function startBankAccountVerification(accountId: string): Promise<IbanVerification> {
  const dto = await apiRequest<IbanVerificationDto | null>(
    `${backendPaths.bankAccounts}/${encodeURIComponent(accountId)}/verification`,
    { method: "POST" },
  );
  if (dto === null || !dto.reference || !dto.targetIban) {
    throw new ApiError({
      status: 0,
      errorCode: unexpectedError,
      errorCategory: unexpectedError,
      message: "IBAN verification response is unusable.",
    });
  }
  return {
    accountId: dto.accountId ?? accountId,
    maskedIban: dto.maskedIban ?? "",
    status: dto.status ?? "PENDING",
    reference: dto.reference,
    // `BigDecimal` JSON'da sayı olarak geliyor; iki ondalığa sabitlenmiş dize
    // ekrana `formatMoney` ile giriyor. Jackson kuruşu zaten yuvarlamış durumda.
    amount: typeof dto.amount === "number" ? dto.amount.toFixed(2) : (dto.amount ?? "0.00"),
    currency: "TRY",
    targetIban: dto.targetIban,
    expiresAt: dto.expiresAt ?? null,
    attemptsLeft: typeof dto.attemptsLeft === "number" ? dto.attemptsLeft : null,
  };
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
