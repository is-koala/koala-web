"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";

import { workerNotificationsPath } from "@/lib/app-routes";
import type { FormState } from "@/lib/form-state";
import { passwordProblem, passwordRequirement, passwordsDoNotMatch } from "@/lib/password";
import { ApiError, safeRequestId } from "@/server/api/errors";
import {
  type AccountDeletion,
  addBankAccount,
  confirmVerification,
  deleteBankAccount,
  getAccountDeletion,
  markAllNotificationsRead,
  markNotificationRead,
  requestAccountDeletion,
  revokeOtherSessions,
  revokeSession,
  selectPrimaryBankAccount,
  updatePassword,
} from "@/server/account-settings/settings";
import { failureState, textField, validationState } from "@/server/form";
import {
  requestContactVerification,
  type PendingVerification,
} from "@/server/profile/profile";
import { requireSessionForCurrentPath } from "@/server/session/guard";

export type SettingsActionState =
  | Exclude<FormState, { status: "done" }>
  | { status: "done"; verification?: PendingVerification };

export type SettingsAction = (
  state: SettingsActionState,
  formData: FormData,
) => Promise<SettingsActionState>;

export type AccountDeletionActionState =
  | { status: "idle" }
  | {
      status: "error";
      errorCode: string;
      httpStatus: number;
      fieldErrors?: Readonly<Record<string, string>>;
      requestId?: string | null;
    }
  | {
      status: "done";
      outcome: "created" | "already-requested";
      deletion: AccountDeletion;
    };

export type AccountDeletionAction = (
  state: AccountDeletionActionState,
  formData: FormData,
) => Promise<AccountDeletionActionState>;

const uuidPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export async function addBankAccountAction(
  _state: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  await requireSessionForCurrentPath();
  const iban = normalizeIban(textField(formData, "iban"));
  if (!isValidTurkishIban(iban)) {
    return validationState({ iban: "Geçerli bir TR IBAN gir." });
  }
  return runMutation(() => addBankAccount(iban), safeIbanFailure);
}

export async function selectPrimaryBankAccountAction(
  _state: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  await requireSessionForCurrentPath();
  const accountId = textField(formData, "accountId");
  if (!uuidPattern.test(accountId)) return invalidResource("accountId");
  return runMutation(() => selectPrimaryBankAccount(accountId));
}

export async function deleteBankAccountAction(
  _state: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  await requireSessionForCurrentPath();
  const accountId = textField(formData, "accountId");
  if (!uuidPattern.test(accountId)) return invalidResource("accountId");
  return runMutation(() => deleteBankAccount(accountId));
}

export async function updateContactAction(
  _state: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  await requireSessionForCurrentPath();
  const kind = textField(formData, "kind");
  const value = textField(formData, "value").trim();

  if (kind === "email") {
    if (!isValidEmail(value)) {
      return validationState({ value: "Geçerli bir e-posta adresi gir." });
    }
    return changeContact({ email: value }, "EMAIL", "email");
  }
  if (kind === "phone") {
    if (!value || value.length > 32) {
      return validationState({ value: "Geçerli bir telefon numarası gir." });
    }
    return changeContact({ phoneNumber: value }, "PHONE", "phoneNumber");
  }
  return validationState({ kind: "İletişim türü geçerli değil." });
}

export async function confirmVerificationAction(
  _state: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  await requireSessionForCurrentPath();
  const verificationId = textField(formData, "verificationId");
  const token = textField(formData, "token").trim();
  if (!uuidPattern.test(verificationId)) return invalidResource("verificationId");
  if (!token || token.length > 128) {
    return validationState({ token: "Doğrulama kodunu gir." });
  }
  return runMutation(() => confirmVerification(verificationId, token));
}

export async function updatePasswordAction(
  _state: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  await requireSessionForCurrentPath();
  const currentPassword = textField(formData, "currentPassword");
  const newPassword = textField(formData, "newPassword");
  const confirmNewPassword = textField(formData, "confirmNewPassword");
  if (!currentPassword) {
    return validationState({ currentPassword: "Mevcut parolanı gir." });
  }
  const problem = passwordProblem(newPassword, confirmNewPassword);
  if (problem === "weak") return validationState({ newPassword: passwordRequirement });
  if (problem === "mismatch") {
    return validationState({ confirmNewPassword: passwordsDoNotMatch });
  }
  return runMutation(() => updatePassword({ currentPassword, newPassword, confirmNewPassword }));
}

export async function markNotificationReadAction(
  _state: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  await requireSessionForCurrentPath();
  const notificationId = textField(formData, "notificationId");
  if (!uuidPattern.test(notificationId)) return invalidResource("notificationId");
  return runMutation(() => markNotificationRead(notificationId));
}

export async function markAllNotificationsReadAction(
  _state: SettingsActionState,
  _formData: FormData,
): Promise<SettingsActionState> {
  void _state;
  void _formData;
  await requireSessionForCurrentPath();
  return runMutation(markAllNotificationsRead);
}

export async function revokeSessionAction(
  _state: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  await requireSessionForCurrentPath();
  const sessionId = textField(formData, "sessionId");
  if (!uuidPattern.test(sessionId)) return invalidResource("sessionId");
  return runMutation(() => revokeSession(sessionId));
}

export async function revokeOtherSessionsAction(
  _state: SettingsActionState,
  _formData: FormData,
): Promise<SettingsActionState> {
  void _state;
  void _formData;
  await requireSessionForCurrentPath();
  return runMutation(revokeOtherSessions);
}

export async function requestAccountDeletionAction(
  _state: AccountDeletionActionState,
  formData: FormData,
): Promise<AccountDeletionActionState> {
  await requireSessionForCurrentPath();
  if (textField(formData, "confirmation") !== "account-deletion-irrevocable") {
    return accountDeletionValidation({ confirmation: "Geri alınamaz etkiyi onaylamalısın." });
  }
  const reason = textField(formData, "reason").trim();
  if (reason.length > 512) {
    return accountDeletionValidation({ reason: "Silme nedeni en fazla 512 karakter olabilir." });
  }
  try {
    const deletion = await requestAccountDeletion(reason || null);
    revalidateSettings();
    return { status: "done", outcome: "created", deletion };
  } catch (error) {
    unstable_rethrow(error);
    if (
      error instanceof ApiError &&
      error.status === 409 &&
      error.errorCode === "LEGAL_DELETION_ALREADY_REQUESTED"
    ) {
      try {
        const deletion = await getAccountDeletion();
        revalidateSettings();
        return { status: "done", outcome: "already-requested", deletion };
      } catch (statusError) {
        unstable_rethrow(statusError);
        return accountDeletionFailure(error);
      }
    }
    return accountDeletionFailure(error);
  }
}

function accountDeletionFailure(error: unknown): AccountDeletionActionState {
  const failure = failureState(error);
  if (failure.status !== "error") throw new Error("Hata durumu üretilemedi.");
  return {
    status: "error",
    errorCode: failure.errorCode,
    httpStatus: failure.httpStatus,
    ...(failure.fieldErrors ? { fieldErrors: failure.fieldErrors } : {}),
    ...(error instanceof ApiError ? { requestId: safeRequestId(error.requestId) } : {}),
  };
}

function accountDeletionValidation(
  fieldErrors: Readonly<Record<string, string>>,
): AccountDeletionActionState {
  return { status: "error", errorCode: "VALIDATION_FAILED", httpStatus: 400, fieldErrors };
}

async function changeContact(
  change: { email: string } | { phoneNumber: string },
  expectedType: "EMAIL" | "PHONE",
  backendField: "email" | "phoneNumber",
): Promise<SettingsActionState> {
  try {
    const response = await requestContactVerification(change);
    const pending = response.pendingVerifications?.find(
      (verification) => verification.type === expectedType,
    );
    revalidateSettings();
    return pending
      ? {
          status: "done",
          verification: { id: pending.id, type: pending.type, sentTo: pending.sentTo },
        }
      : { status: "done" };
  } catch (error) {
    unstable_rethrow(error);
    const state = failureState(error);
    const message = state.status === "error" ? state.fieldErrors?.[backendField] : undefined;
    return state.status === "error" && message
      ? { ...state, fieldErrors: { value: message } }
      : state;
  }
}

async function runMutation(
  task: () => Promise<unknown>,
  onFailure: (error: unknown) => SettingsActionState = failureState,
): Promise<SettingsActionState> {
  try {
    await task();
    revalidateSettings();
    return { status: "done" };
  } catch (error) {
    unstable_rethrow(error);
    return onFailure(error);
  }
}

function safeIbanFailure(error: unknown): SettingsActionState {
  const state = failureState(error);
  if (state.status !== "error" || !state.fieldErrors) return state;
  return { ...state, fieldErrors: { iban: "Geçerli bir TR IBAN gir." } };
}

function revalidateSettings() {
  revalidatePath("/panel/hesap");
  revalidatePath("/isveren/hesap");
  // Bildirim akışı ve banka hesapları iki adreste daha çiziliyor; okundu ya
  // da IBAN eylemi hangi sayfadan gelirse gelsin öbürü bayat kalmamalı.
  revalidatePath(workerNotificationsPath);
  revalidatePath("/panel/kazanclarim");
}

function invalidResource(field: string): SettingsActionState {
  return validationState({ [field]: "Kaynak kimliği geçerli değil." });
}

function normalizeIban(value: string): string {
  return value.replaceAll(/\s/g, "").toUpperCase();
}

function isValidTurkishIban(value: string): boolean {
  if (!/^TR\d{24}$/.test(value)) return false;
  const rearranged = `${value.slice(4)}${value.slice(0, 4)}`;
  let remainder = 0;
  for (const character of rearranged) {
    const digits = /[A-Z]/.test(character) ? String(character.charCodeAt(0) - 55) : character;
    for (const digit of digits) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
}

function isValidEmail(value: string): boolean {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
