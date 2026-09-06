"use server";

import type { FormState } from "@/lib/form-state";
import {
  notificationCategoryValues,
  notificationChannelValues,
  type NotificationCategory,
  type NotificationChannel,
} from "@/lib/profile";
import { validationState } from "@/server/form";
import {
  updateNotificationPreferences,
  type NotificationPreferenceWrite,
} from "@/server/profile/profile";
import { requireSessionForCurrentPath } from "@/server/session/guard";

import { runProfileMutation } from "./action-support";

const notificationCategories = new Set<NotificationCategory>(notificationCategoryValues);
const notificationChannels = new Set<NotificationChannel>(notificationChannelValues);

export async function updateNotificationPreferencesAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireSessionForCurrentPath();
  const preferences = preferenceRows(formData.getAll("preferences"));
  if (preferences === null || preferences.length === 0) {
    return validationState({ preferences: "Güncellenecek iletişim tercihi bulunamadı." });
  }
  return runProfileMutation(() => updateNotificationPreferences(preferences));
}

function preferenceRows(values: readonly FormDataEntryValue[]): NotificationPreferenceWrite[] | null {
  const decisions = new Map<string, NotificationPreferenceWrite>();

  for (const value of values) {
    if (typeof value !== "string") return null;
    const [category, channel, enabled, extra] = value.split("|");
    if (
      extra !== undefined ||
      !notificationCategories.has(category as NotificationCategory) ||
      !notificationChannels.has(channel as NotificationChannel) ||
      (enabled !== "true" && enabled !== "false")
    ) {
      return null;
    }
    decisions.set(`${category}|${channel}`, {
      category: category as NotificationCategory,
      channel: channel as NotificationChannel,
      enabled: enabled === "true",
    });
  }

  return [...decisions.values()];
}
