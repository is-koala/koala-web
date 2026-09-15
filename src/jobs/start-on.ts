/**
 * İlan keşfinin başlangıç günü süzgeci.
 *
 * Adres çubuğundaki `tarih` İstanbul takvimine bağlı: `bugun`/`yarin` o anın
 * Türkiye günü, `bu-hafta` Pazartesi–Pazar, `hafta-sonu` o haftanın
 * Cumartesi–Pazar'ı, `YYYY-MM-DD` tek bir gün. Backend `startFrom`/`startTo`
 * Instant bekliyor; dilim `Europe/Istanbul` ve Türkiye DST kullanmıyor
 * (UTC+3). Ters aralık üretilmiyor — geçersiz bir gün parametresi düşer.
 */

import { formatJobDate } from "@/lib/dates";

export const jobStartOnPresets = ["bugun", "yarin", "hafta-sonu", "bu-hafta"] as const;

export type JobStartOnPreset = (typeof jobStartOnPresets)[number];

export type JobStartOn = JobStartOnPreset | string;

export const jobStartOnLabels: Readonly<Record<JobStartOnPreset, string>> = {
  bugun: "Bugün başlayanlar",
  yarin: "Yarın başlayanlar",
  "hafta-sonu": "Hafta sonu",
  "bu-hafta": "Bu hafta",
};

const istanbulOffset = "+03:00";
const calendarDayPattern = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isJobStartOnPreset(value: string): value is JobStartOnPreset {
  return (jobStartOnPresets as readonly string[]).includes(value);
}

export function parseJobStartOn(value: string | null | undefined): JobStartOn | null {
  if (!value) return null;
  if (isJobStartOnPreset(value)) return value;
  return isCalendarDay(value) ? value : null;
}

export function jobStartOnLabel(startOn: JobStartOn): string {
  if (isJobStartOnPreset(startOn)) return jobStartOnLabels[startOn];
  return formatJobDate(startOn);
}

export type InstantWindow = {
  readonly startFrom: string;
  readonly startTo: string;
};

/** `now` testte dondurulabilsin diye dışarıdan alınır; üretim `new Date()`. */
export function jobStartWindow(startOn: JobStartOn, now: Date): InstantWindow {
  const today = istanbulCalendarDate(now);
  if (startOn === "bugun") return dayBounds(today);
  if (startOn === "yarin") return dayBounds(addCalendarDays(today, 1));
  if (startOn === "bu-hafta") {
    const monday = mondayOf(today);
    return rangeBounds(monday, addCalendarDays(monday, 6));
  }
  if (startOn === "hafta-sonu") {
    const monday = mondayOf(today);
    return rangeBounds(addCalendarDays(monday, 5), addCalendarDays(monday, 6));
  }
  return dayBounds(startOn);
}

function isCalendarDay(value: string): boolean {
  const match = calendarDayPattern.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));
  return utc.getUTCFullYear() === year && utc.getUTCMonth() === month - 1 && utc.getUTCDate() === day;
}

function istanbulCalendarDate(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function mondayOf(isoDate: string): string {
  const weekday = weekdayUtc(isoDate);
  const offset = weekday === 0 ? -6 : 1 - weekday;
  return addCalendarDays(isoDate, offset);
}

function weekdayUtc(isoDate: string): number {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function addCalendarDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
}

function dayBounds(isoDate: string): InstantWindow {
  return rangeBounds(isoDate, isoDate);
}

function rangeBounds(from: string, to: string): InstantWindow {
  return {
    startFrom: new Date(`${from}T00:00:00${istanbulOffset}`).toISOString(),
    startTo: new Date(`${to}T23:59:59.999${istanbulOffset}`).toISOString(),
  };
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}
