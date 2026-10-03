"use server";

import type { FormState } from "@/lib/form-state";
import { isNotificationCategory, isNotificationChannel } from "@/lib/notification-labels";
import { validationState } from "@/server/form";
import {
  updateNotificationPreferences,
  type NotificationPreferenceWrite,
} from "@/server/profile/profile";
import { requireSessionForCurrentPath } from "@/server/session/guard";

import { runProfileMutation } from "./action-support";

/**
 * Tercih formunun sunucu tarafı.
 *
 * Yalnız yüklendiği değerden farklı satırlar gönderilir. Backend her ticari
 * satır için — değişsin değişmesin — bir rıza kaydı ve İYS görevi yazıyor
 * (`recordCommercialDecision`); bütün satırları göndermek her kayıtta
 * kullanıcının rızayı taze zaman damgasıyla yeniden vermiş gibi görünmesi
 * demekti. Ayrıca doğrulanmamış alıcı denetimi (`requireVerifiedRecipient`)
 * yalnız gönderilen satırlara bakıyor: değişmeyen açık bir ticari satır
 * başka bir satırın kaydını düşürmemeli. Hiçbir şey değişmediyse backend'e
 * gidilmez.
 */
export async function updateNotificationPreferencesAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireSessionForCurrentPath();
  const preferences = preferenceRows(formData.getAll("preferences"));
  const initial = preferenceRows(formData.getAll("initialPreferences"));
  if (preferences === null || initial === null || preferences.length === 0) {
    return validationState({ preferences: "Güncellenecek iletişim tercihi bulunamadı." });
  }

  const loaded = new Map(initial.map((row) => [rowKey(row), row.enabled]));
  const changed = preferences.filter((row) => loaded.get(rowKey(row)) !== row.enabled);
  if (changed.length === 0) return { status: "done", unchanged: true };

  return runProfileMutation(() => updateNotificationPreferences(changed));
}

function rowKey(row: Pick<NotificationPreferenceWrite, "category" | "channel">): string {
  return `${row.category}|${row.channel}`;
}

/** Aynı satır birden çok kez gelirse son değer kazanır (gizli `false` + işaretli kutu). */
function preferenceRows(values: readonly FormDataEntryValue[]): NotificationPreferenceWrite[] | null {
  const decisions = new Map<string, NotificationPreferenceWrite>();

  for (const value of values) {
    if (typeof value !== "string") return null;
    const [category, channel, enabled, extra] = value.split("|");
    if (
      extra !== undefined ||
      !isNotificationCategory(category) ||
      !isNotificationChannel(channel) ||
      (enabled !== "true" && enabled !== "false")
    ) {
      return null;
    }
    decisions.set(`${category}|${channel}`, { category, channel, enabled: enabled === "true" });
  }

  return [...decisions.values()];
}
