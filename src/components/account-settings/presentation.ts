import { formatDateTime, isFormattableDate } from "@/lib/dates";

/**
 * Hesap ayarlarındaki anları yazar: son oturum erişimi, bildirim gönderim anı.
 *
 * Biçimin kendisi `@/lib/dates`'e ait — saat dilimi orada Europe/Istanbul'a
 * sabitlenmiş durumda. Bu ekranların ilk HTML'i sunucuda çiziliyor, sonra
 * tarayıcıda hidrate ediliyor; sunucunun `TZ`'si başka bir dilimdeyse (üretimde
 * `UTC`) iki taraf aynı an için iki ayrı metin üretirdi.
 *
 * Ekranın kendine ait tek kararı boş hücrede ne yazacağı: paylaşılan
 * biçimlendirici ayrıştırılamayan değeri ham geri veriyor, burası onun yerine
 * "Tarih yok" diyor. Oturum listesinde ve bildirim akışında ham bir ISO metni
 * ya da "Invalid Date" satırın ortasında duracak bir kaza gibi görünür.
 *
 * `value === null` kontrolü tipin gereği değil, davranışın gereği:
 * `new Date(null).getTime()` **0**'dır, `NaN` değil. Yani `isFormattableDate`
 * `null`'a "ayrıştırılabilir" der ve kapı düşerse ekrana "Tarih yok" yerine
 * "1 Oca 1970 03:00" yazılır.
 */
export function formatAccountDate(value: string | null): string {
  if (value === null || !isFormattableDate(value)) return "Tarih yok";
  return formatDateTime(value);
}

/**
 * `DeviceType` (backend) → ad yokken yazılacak etiket.
 *
 * Değerler `IOS`, `ANDROID`, `WEB_BROWSER`, `UNKNOWN`, `OTHER`; eski `WEB` ve
 * `MOBILE` de burada, çünkü liste onları zaten tanıyordu ve backend'in yeni
 * bir tip eklemesi ekranı bozmamalı — bilinmeyen tip nötr etiket alır.
 */
export function deviceTypeLabel(type: string): string {
  switch (type) {
    case "IOS":
      return "iPhone veya iPad";
    case "ANDROID":
      return "Android cihaz";
    case "MOBILE":
      return "Mobil cihaz";
    case "WEB":
    case "WEB_BROWSER":
      return "Web tarayıcısı";
    default:
      return "Bilinmeyen cihaz";
  }
}

/** Konum yaklaşık (IP'den türetilmiş); yoksa tire. */
export function sessionLocationLabel(location: string | null): string {
  return location ? `Yaklaşık: ${location}` : "—";
}
