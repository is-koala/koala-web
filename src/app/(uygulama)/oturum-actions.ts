"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";

import {
  accountSessionsHref,
  accountSettingsPath,
  appShells,
  sessionDetailPath,
  type AppShellId,
} from "@/lib/app-routes";
import type { FormState } from "@/lib/form-state";
import { isUuid } from "@/lib/identifiers";
import { deviceNameMaxLength } from "@/lib/session-detail";
import { renameDevice } from "@/server/account-settings/session-detail";
import { revokeSession } from "@/server/account-settings/settings";
import { failureState, textField, validationState } from "@/server/form";
import { requireSessionForCurrentPath } from "@/server/session/guard";

/**
 * Cihazı adlandırır (`PATCH /users/me/devices/{deviceId}`, ad ≤ 60).
 *
 * Kimlikler formdan geliyor, adresten değil: sayfa iki kimlik taşıyor
 * (oturum ve cihaz) ve ad cihaza yazılıyor. İkisi de UUID olmalı; backend
 * başkasının cihazına 404 dönüyor, sayfa onu hata kartı olarak gösterir.
 */
export async function renameDeviceAction(
  shell: AppShellId,
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireSessionForCurrentPath();
  const sessionId = textField(formData, "sessionId");
  const deviceId = textField(formData, "deviceId");
  if (!isUuid(sessionId) || !isUuid(deviceId)) {
    return validationState({ name: "Kaynak kimliği geçerli değil." });
  }

  const name = textField(formData, "name").trim();
  if (!name) return validationState({ name: "Cihaza bir ad ver." });
  if (name.length > deviceNameMaxLength) {
    return validationState({ name: `Cihaz adı en fazla ${deviceNameMaxLength} karakter olabilir.` });
  }

  try {
    await renameDevice(deviceId, name);
    revalidateSessionScreens(shell, sessionId);
    return { status: "done" };
  } catch (error) {
    unstable_rethrow(error);
    return failureState(error);
  }
}

/**
 * Oturumu kapatır ve hesap sayfasındaki listeye döner.
 *
 * Kapatılan oturumun sayfası artık 404; kullanıcıyı orada bırakmak yerine
 * listeye götürüyoruz. Mevcut oturum buradan geçmez — sayfa onu `/cikis`'a
 * bağlıyor, çünkü kendi oturumunu kapatmak çıkış yapmaktır.
 */
export async function revokeSessionFromDetailAction(
  shell: AppShellId,
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireSessionForCurrentPath();
  const sessionId = textField(formData, "sessionId");
  if (!isUuid(sessionId)) return validationState({ sessionId: "Kaynak kimliği geçerli değil." });

  try {
    await revokeSession(sessionId);
  } catch (error) {
    unstable_rethrow(error);
    return failureState(error);
  }
  revalidateSessionScreens(shell, sessionId);
  redirect(accountSessionsHref(shell));
}

function revalidateSessionScreens(shell: AppShellId, sessionId: string) {
  revalidatePath(sessionDetailPath(shell, sessionId));
  // Cihaz adı iki kabuğun hesap sayfasındaki listede de görünüyor.
  for (const id of Object.keys(appShells) as AppShellId[]) revalidatePath(accountSettingsPath(id));
}
