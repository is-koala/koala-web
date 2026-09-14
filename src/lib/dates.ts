/**
 * Ekranda görünen tarih metinleri tek yerden çıkar.
 *
 * Modül bilerek saf: `server-only` işareti yok, çünkü aynı biçimlendirmeyi
 * hem sunucuda çizilen sayfalar hem `"use client"` bileşenleri okuyor. Bir
 * sunucu bileşeni ile onun altındaki istemci bileşeni aynı tarihi farklı
 * kurallarla yazarsa kullanıcı aynı ekranda iki ayrı biçim görür.
 */

/**
 * Saat dilimi sunucunun `TZ`'sine bırakılmıyor, açıkça İstanbul'a
 * sabitleniyor. Aynı an sunucuda başka, tarayıcıda başka saat dilimiyle
 * biçimlenirse iki taraf farklı metin üretir ve React hidrasyonu ayrışır:
 * ilk boyada bir tarih görünür, JavaScript yüklenince sessizce başkasına
 * döner. Ürünün kendisi de tek bir saat diliminde çalışıyor — ilan, atama ve
 * ödeme saatleri Türkiye saatiyle konuşuluyor.
 */
const displayTimeZone = "Europe/Istanbul";

/**
 * Backend'in `Instant` alanlarını ekrana çevirir: "2 Ağu 2026 00:30".
 * `appliedAt`, `cancelledAt`, `paidAt`, `checkInAt` gibi gerçek anlar buradan
 * geçer.
 *
 * Ayrıştırılamayan değer olduğu gibi geri veriliyor: "Invalid Date" yazmak
 * yerine backend'in gönderdiği ham metni göstermek hem kullanıcıya hem hatayı
 * arayana daha çok şey söylüyor.
 */
export function formatDateTime(value: string): string {
  if (!isFormattableDate(value)) return value;
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: displayTimeZone,
  }).format(new Date(value));
}

/**
 * Aynı anı saatsiz yazar: "2 Ağu 2026".
 *
 * Saat taşımayan ayrı bir biçim, çünkü bazı kayıtların ekrandaki sorusu "ne
 * zaman" değil "hangi gün": yetenek havuzuna eklenme gibi. Kendi
 * `Intl.DateTimeFormat`'ını kuran bir ekran ise saat dilimini de yeniden
 * yazmak zorunda kalırdı; ayrışması gereken tek şey biçim, sabit değil.
 */
export function formatDate(value: string): string {
  if (!isFormattableDate(value)) return value;
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeZone: displayTimeZone,
  }).format(new Date(value));
}

/**
 * Yalnız ay ve yıl: "Ağustos 2026".
 *
 * Üyelik tarihi gibi güne inmenin bir anlam taşımadığı kayıtlar için; gün
 * yazmak işveren güven kartında gereksiz bir kesinlik olurdu.
 */
export function formatMonthYear(value: string): string {
  if (!isFormattableDate(value)) return value;
  return new Intl.DateTimeFormat("tr-TR", {
    month: "long",
    year: "numeric",
    timeZone: displayTimeZone,
  }).format(new Date(value));
}

/**
 * Değer gerçek bir ana karşılık geliyor mu.
 *
 * Ayrı duruyor çünkü çağıranların biçimlendirme dışında iki kararı daha var:
 * `<time dateTime={...}>` yalnız ayrıştırılabilir bir değerle kurulmalı
 * (biçimlendirilemeyen değer ekranda ham gösterilir ama makineye tarih diye
 * sunulmaz), ve bazı ekranlar ham değer yerine kendi bekleme metnini yazmayı
 * seçiyor. İkisi de biçimlendiricinin değil, ekranın kararı.
 */
export function isFormattableDate(value: string): boolean {
  return !Number.isNaN(new Date(value).getTime());
}

/**
 * İş takviminin tarihlerini yazar: "12 Eylül 2026".
 *
 * `startsAt` ve `endsAt` backend'den ofsetsiz `LocalDateTime` olarak geliyor
 * ("2026-09-12T09:00:00"). Bunlar bir an değil, üzerinde anlaşılmış duvar
 * saati; `new Date(...)` onları çalıştığı ortamın saat dilimine göre yorumlar
 * ve gece yarısına yakın işlerde günü kaydırırdı. Bu yüzden ISO öneki metin
 * olarak okunuyor ve hiçbir dönüşümden geçmiyor.
 */
export function formatJobDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;
  return `${Number(match[3])} ${monthName(Number(match[2]))} ${match[1]}`;
}

/** 1 tabanlı ay numarasının Türkçe adı. */
export function monthName(month: number): string {
  return monthNames[month - 1];
}

const monthNames = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
] as const;
