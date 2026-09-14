/**
 * Haftalık müsaitliğin paylaşılan sözleşmesi.
 *
 * `server-only` yok: form alanlarını hem sunucu action'ı hem de istemcideki
 * düzenleyici aynı adlarla okuyor, ve modül ağ çağrısı taşımıyor.
 *
 * Kaynak `AvailabilityDto` / `SaveAvailabilityDto` / `SaveAvailabilityExceptionDto`.
 * `PUT /users/me/availability` **toptan** değiştiriyor: gönderilen liste
 * haftanın tamamı, eksik bırakılan gün silinmiş sayılıyor. Düzenleyici bu
 * yüzden tek form olarak duruyor, satır satır kaydetmiyor.
 */

export const dayOfWeekValues = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
] as const;

export type DayOfWeek = (typeof dayOfWeekValues)[number];

export const dayOfWeekLabels: Readonly<Record<DayOfWeek, string>> = {
  MONDAY: "Pazartesi",
  TUESDAY: "Salı",
  WEDNESDAY: "Çarşamba",
  THURSDAY: "Perşembe",
  FRIDAY: "Cuma",
  SATURDAY: "Cumartesi",
  SUNDAY: "Pazar",
};

export type AvailabilitySlot = {
  id: string | null;
  dayOfWeek: DayOfWeek;
  /** `HH:mm`; backend `LocalTime` saniyeyi de yazabiliyor, okurken kırpılır. */
  startTime: string;
  endTime: string;
};

export type AvailabilityException = {
  id: string;
  /** `YYYY-MM-DD` */
  date: string;
  available: boolean;
  note: string | null;
};

export type Availability = {
  slots: readonly AvailabilitySlot[];
  exceptions: readonly AvailabilityException[];
};

export type SlotWrite = Pick<AvailabilitySlot, "dayOfWeek" | "startTime" | "endTime">;

/** `SaveAvailabilityDto.slots` `@Size(max = 50)`. */
export const maximumSlots = 50;

/** `SaveAvailabilityExceptionDto.note` `@Size(max = 255)`. */
export const maximumExceptionNoteLength = 255;

/** Düzenleyicinin satır alanları; `FormData.getAll` ile sırayla okunur. */
export const slotFieldNames = {
  dayOfWeek: "slotDay",
  startTime: "slotStart",
  endTime: "slotEnd",
} as const;

const timePattern = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;

export function isDayOfWeek(value: string): value is DayOfWeek {
  return (dayOfWeekValues as readonly string[]).includes(value);
}

/** `HH:mm:ss` → `HH:mm`; formun `type="time"` alanı saniye taşımıyor. */
export function toClockTime(value: string): string {
  return timePattern.test(value) ? value.slice(0, 5) : value;
}

export type SlotParseResult =
  | { readonly slots: readonly SlotWrite[]; readonly error?: undefined }
  | { readonly slots?: undefined; readonly error: string };

/**
 * Düzenleyici satırlarını `SlotWrite` listesine çevirir.
 *
 * Boş bırakılan satır (günü seçili ama saati yok) sessizce atılmıyor: kullanıcı
 * bir satır açıp doldurmadıysa kaydın ne demek istediği belirsiz ve toptan
 * yazma o belirsizliği haftanın tamamına yayardı.
 */
export function parseSlots(
  days: readonly string[],
  starts: readonly string[],
  ends: readonly string[],
): SlotParseResult {
  if (days.length !== starts.length || days.length !== ends.length) {
    return { error: "Müsaitlik satırları eksik gönderildi; sayfayı yenileyip yeniden dene." };
  }
  if (days.length > maximumSlots) {
    return { error: `En fazla ${maximumSlots} aralık kaydedilebilir.` };
  }

  const slots: SlotWrite[] = [];
  for (let index = 0; index < days.length; index += 1) {
    const dayOfWeek = days[index];
    const startTime = starts[index];
    const endTime = ends[index];
    const row = index + 1;

    if (!isDayOfWeek(dayOfWeek)) return { error: `${row}. satırda geçerli bir gün seç.` };
    if (!timePattern.test(startTime) || !timePattern.test(endTime)) {
      return { error: `${row}. satırda başlangıç ve bitiş saatini SS:DD biçiminde gir.` };
    }
    const start = toClockTime(startTime);
    const end = toClockTime(endTime);
    if (end <= start) {
      return { error: `${row}. satırda bitiş saati başlangıçtan sonra olmalı.` };
    }
    if (slots.some((slot) => slot.dayOfWeek === dayOfWeek && slot.startTime < end && start < slot.endTime)) {
      return { error: `${row}. satır aynı günün başka bir aralığıyla çakışıyor.` };
    }
    slots.push({ dayOfWeek, startTime: start, endTime: end });
  }

  return { slots };
}

/** Haftanın sırasına, sonra saate göre; backend sırayı korumuyor. */
export function sortSlots<T extends SlotWrite>(slots: readonly T[]): T[] {
  return [...slots].sort((left, right) => {
    const dayOrder = dayOfWeekValues.indexOf(left.dayOfWeek) - dayOfWeekValues.indexOf(right.dayOfWeek);
    return dayOrder !== 0 ? dayOrder : left.startTime.localeCompare(right.startTime);
  });
}
