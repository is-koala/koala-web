import "server-only";

import {
  isDayOfWeek,
  toClockTime,
  type Availability,
  type AvailabilityException,
  type AvailabilitySlot,
  type SlotWrite,
} from "@/lib/availability";
import { apiRequest } from "@/server/session/session";

/**
 * Haftalık müsaitlik uçları.
 *
 * Okuma `GET /users/{userId}/availability` — kendi kaydı için de aynı uç;
 * `/users/me/availability` yalnız yazma yönünde var. Kimlik kabuğun okuduğu
 * `GET /users/me`'den geliyor, tarayıcıdan değil.
 */
export async function getAvailability(userId: string): Promise<Availability> {
  const response = await apiRequest<AvailabilityDto | null>(
    `/users/${encodeURIComponent(userId)}/availability`,
  );
  const rawSlots = response?.slots ?? [];
  const slots = rawSlots.flatMap(toSlot);
  return {
    slots,
    exceptions: (response?.exceptions ?? []).flatMap(toException),
    // Düşen satır sessizce kaybolmaz: sayı ekrana çıkar ve düzenleyiciyi kilitler.
    unreadableSlotCount: rawSlots.length - slots.length,
  };
}

/** Toptan yazma: gönderilen liste haftanın tamamıdır. */
export async function saveAvailability(slots: readonly SlotWrite[]): Promise<void> {
  await apiRequest("/users/me/availability", { method: "PUT", body: { slots } });
}

export type AvailabilityExceptionWrite = {
  date: string;
  available: boolean;
  note: string | null;
};

export async function saveAvailabilityException(input: AvailabilityExceptionWrite): Promise<void> {
  await apiRequest("/users/me/availability/exceptions", { method: "PUT", body: input });
}

export async function deleteAvailabilityException(exceptionId: string): Promise<void> {
  await apiRequest(`/users/me/availability/exceptions/${encodeURIComponent(exceptionId)}`, {
    method: "DELETE",
  });
}

type AvailabilityDto = {
  slots?: readonly Partial<AvailabilitySlot>[] | null;
  exceptions?: readonly Partial<AvailabilityException>[] | null;
};

function toSlot(slot: Partial<AvailabilitySlot>): AvailabilitySlot[] {
  if (!slot.dayOfWeek || !isDayOfWeek(slot.dayOfWeek) || !slot.startTime || !slot.endTime) {
    return [];
  }
  return [
    {
      id: slot.id ?? null,
      dayOfWeek: slot.dayOfWeek,
      startTime: toClockTime(slot.startTime),
      endTime: toClockTime(slot.endTime),
    },
  ];
}

function toException(exception: Partial<AvailabilityException>): AvailabilityException[] {
  if (!exception.id || !exception.date) return [];
  return [
    {
      id: exception.id,
      date: exception.date,
      available: exception.available === true,
      note: exception.note ?? null,
    },
  ];
}
