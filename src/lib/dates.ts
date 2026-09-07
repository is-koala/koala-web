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
 * Ekranın "içinde bulunduğumuz yıl" saydığı sayı — telif satırı gibi tek
 * başına duran yerler için.
 *
 * `new Date().getFullYear()` yılı çalıştığı ortamın `TZ`'sinden okur. Üretimde
 * sunucu kapsayıcıda `UTC` ile koşuyor, tarayıcı ise kullanıcının dilimini
 * kullanıyor: 31 Aralık 21:00 UTC ile 1 Ocak 00:00 UTC arasındaki üç saat
 * boyunca İstanbul'daki tarayıcı yeni yıla girmiş, sunucu girmemiş oluyor.
 * Sunucunun çizdiği ilk HTML bir yıl, hidrasyondan sonrası başka bir yıl
 * yazar ve React ikisini uzlaştıramaz.
 *
 * Biçimlendirici `en-US` ile kuruluyor çünkü buradan çıkan değer ekrana
 * yazılan bir metin değil, `Number` ile okunan bir sayı: latin rakam
 * kullanmayan bir yerelin yazdığı yıl sessizce `NaN`'a düşerdi.
 */
export function currentDisplayYear(): number {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      timeZone: displayTimeZone,
    }).format(new Date()),
  );
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
