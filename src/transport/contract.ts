/**
 * Ulaşım planının istemciyle paylaşılan sözleşmesi (backend 0.9.28,
 * is-koala/koala-backend#296 T1, is-koala/koala-web#187).
 *
 * Üç görünüm aynı çekirdeği paylaşıyor ve **kim ne görür** kararı sunucunun:
 * herkese açık özet (`PublicTransportSummary`) ilçe/semt ve saat taşır;
 * işverenin planı (`TransportPlan`) plaka, şoför, tam adres ve doluluk taşır;
 * işçinin görünümü (`AssignmentTransport`) plaka/şoförü yalnız koltuk
 * seçtiği serviste dolu alır. Web bu üçünü ayrı tiplerle okuyor ki bir
 * bileşen yanlış görünümden alan çizemesin.
 *
 * Dosya `server-only` değil ve `ErrorCatalog` bildirmiyor: herkese açık ilan
 * sayfasının sunucu bileşeni buradan yalnız özet tipini ve saat
 * biçimlendiriciyi okuyor (`error-catalog-boundary.test.ts`).
 */

export const transportMethods = ["SHUTTLE", "CASH_ALLOWANCE", "SELF", "NONE"] as const;
export type TransportMethod = (typeof transportMethods)[number];

export const transportDirections = ["OUTBOUND", "RETURN"] as const;
export type TransportDirection = (typeof transportDirections)[number];

/** Okunamayan yöntem: eski/ileri sunucuda yeni bir değer gelirse ekran nötr yazar. */
export type TransportMethodValue = TransportMethod | "UNKNOWN";

export const transportMethodLabels: Readonly<Record<TransportMethodValue, string>> = {
  SHUTTLE: "Servis",
  CASH_ALLOWANCE: "Yol parası",
  SELF: "Kendi imkânıyla",
  NONE: "Ulaşım sağlanmıyor",
  UNKNOWN: "Belirtilmedi",
};

export const transportDirectionLabels: Readonly<Record<TransportDirection, string>> = {
  OUTBOUND: "Gidiş",
  RETURN: "Dönüş",
};

/** `PublicStopDto`. */
export type PublicStop = {
  readonly districtName: string | null;
  readonly neighborhood: string | null;
  /** `Instant`; ekrana `formatStopTime` ile çıkar. */
  readonly scheduledAt: string;
};

/** `PublicShuttleDto`. */
export type PublicShuttle = {
  readonly direction: TransportDirection;
  readonly name: string;
  readonly stops: readonly PublicStop[];
};

/**
 * `JobTransportDto` — herkese açık özet. Plaka, şoför, tam adres ve
 * koordinat **tipte yok**; sunucu bileşeni onları yanlışlıkla çizemez.
 */
export type PublicTransportSummary = {
  readonly outboundMethod: TransportMethodValue;
  readonly returnMethod: TransportMethodValue;
  /** Ondalık dize; bilgi amaçlı, para yolunun dışında. */
  readonly allowanceAmount: string | null;
  readonly shuttleCount: number;
  readonly shuttles: readonly PublicShuttle[];
};

/** Durağın tam adresi; yalnız işveren ve atanmış işçi görünümünde dolu. */
export type StopAddress = {
  readonly displayAddress: string | null;
  readonly position: { readonly latitude: number; readonly longitude: number } | null;
};

/** `ShuttleStopDto`. */
export type ShuttleStop = {
  readonly id: string;
  readonly label: string | null;
  readonly scheduledAt: string;
  readonly seatsTaken: number;
  /** İptal/red edilmiş işçide ilçe düzeyi gelir; `displayAddress` yine dolu. */
  readonly address: StopAddress | null;
};

/** `ShuttleDto`. */
export type Shuttle = {
  readonly id: string;
  readonly direction: TransportDirection;
  readonly name: string;
  /** İşçi görünümünde yalnız koltuk seçtiği serviste dolu. */
  readonly plate: string | null;
  readonly capacity: number;
  readonly seatsTaken: number;
  readonly driverName: string | null;
  readonly driverPhone: string | null;
  readonly stops: readonly ShuttleStop[];
};

/** `TransportPlanDto` — işveren görünümü. */
export type TransportPlan = {
  readonly outboundMethod: TransportMethodValue;
  readonly returnMethod: TransportMethodValue;
  readonly allowanceAmount: string | null;
  readonly allowanceNote: string | null;
  readonly notes: string | null;
  readonly shuttles: readonly Shuttle[];
  readonly updatedAt: string | null;
};

/** `SeatAssignmentDto`. */
export type SeatAssignment = {
  readonly direction: TransportDirection;
  readonly shuttleId: string;
  readonly stopId: string;
};

/** `AssignmentTransportDto` — işçi (ve işveren) görünümü. */
export type AssignmentTransport = {
  readonly outboundMethod: TransportMethodValue;
  readonly returnMethod: TransportMethodValue;
  readonly allowanceAmount: string | null;
  readonly allowanceNote: string | null;
  readonly notes: string | null;
  readonly shuttles: readonly Shuttle[];
  readonly seats: readonly SeatAssignment[];
};

/** `SeatSelectionDto`. */
export type SeatSelection = {
  readonly shuttleId: string;
  readonly stopId: string;
};

/**
 * Türkiye 2016'dan beri sabit UTC+3 ve yaz saati uygulamıyor; durak saatleri
 * bu yüzden ofsetle çevrilebiliyor. `Intl` ile gidilse de sonuç aynı; sabit
 * ofset `datetime-local` ⇄ `Instant` çevirisini iki yönde de tek satıra
 * indiriyor ve sunucunun `TZ`'sine bağlı kalmıyor.
 */
const istanbulOffsetMinutes = 3 * 60;

/**
 * Backend `Instant`'ını `datetime-local` değerine çevirir:
 * `2026-09-20T03:40:00Z` → `2026-09-20T06:40`. Ayrıştırılamayan değer boş.
 */
export function instantToIstanbulLocal(value: string | null | undefined): string {
  if (!value) return "";
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return "";
  const shifted = new Date(parsed + istanbulOffsetMinutes * 60_000);
  return shifted.toISOString().slice(0, 16);
}

/**
 * `datetime-local` değerini backend `Instant`'ına çevirir:
 * `2026-09-20T06:40` → `2026-09-20T03:40:00Z`. Biçim dışı değer `null`;
 * tarayıcının ürettiği değer saniye taşıyabiliyor, o da kabul ediliyor.
 */
export function istanbulLocalToInstant(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value)) return null;
  const parsed = Date.parse(`${value}Z`);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed - istanbulOffsetMinutes * 60_000).toISOString().replace(".000Z", "Z");
}

/**
 * Durak saati: "20 Eyl 06:40". Yıl yok — ilan bir güne ait ve satır kısa
 * kalmalı. `Europe/Istanbul` açıkça yazılıyor ki sunucu ile tarayıcı aynı
 * metni üretsin (`lib/dates.ts` ile aynı gerekçe).
 */
export function formatStopTime(value: string): string {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return value;
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Istanbul",
  }).format(new Date(parsed));
}

/**
 * Durağa toplu taşımayla yol tarifi (is-koala/koala-web#178 kararı): harici
 * haritaya derin bağlantı, uygulama içinde rota yok. URL yalnız hedef
 * koordinatı taşır; kullanıcının konumu cihaz dışına çıkmaz.
 */
export function stopDirectionsUrl(position: { latitude: number; longitude: number }): string {
  const params = new URLSearchParams({
    api: "1",
    destination: `${position.latitude},${position.longitude}`,
    travelmode: "transit",
  });
  return `https://www.google.com/maps/dir/?${params}`;
}

/** Yönün yöntemi; üç görünüm ve form taslağı aynı iki alanı taşıyor. */
export function methodFor<M extends string>(
  plan: { readonly outboundMethod: M; readonly returnMethod: M },
  direction: TransportDirection,
): M {
  return direction === "OUTBOUND" ? plan.outboundMethod : plan.returnMethod;
}

/** Yön başına seçili koltuk; yoksa `null`. */
export function seatFor(
  transport: Pick<AssignmentTransport, "seats">,
  direction: TransportDirection,
): SeatAssignment | null {
  return transport.seats.find((seat) => seat.direction === direction) ?? null;
}

/** Bir yönün servisleri, plan sırasıyla. */
export function shuttlesFor<T extends { direction: TransportDirection }>(
  shuttles: readonly T[],
  direction: TransportDirection,
): readonly T[] {
  return shuttles.filter((shuttle) => shuttle.direction === direction);
}

/** Dolu servise koltuk seçilemez; işveren için de "kaç boş" bu farktan çıkıyor. */
export function seatsLeft(shuttle: Pick<Shuttle, "capacity" | "seatsTaken">): number {
  return Math.max(0, shuttle.capacity - shuttle.seatsTaken);
}
