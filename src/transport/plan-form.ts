import type { AddressWrite } from "@/address/contract";

import {
  instantToIstanbulLocal,
  istanbulLocalToInstant,
  transportDirections,
  transportMethods,
  type TransportDirection,
  type TransportMethod,
  type TransportPlan,
} from "./contract";

/**
 * Ulaşım planı formunun taslağı ve `TransportPlanWriteDto` gövdesi.
 *
 * Taslak formun **tek** gizli alanında JSON olarak gidiyor (`transportPlan`);
 * durak adresleri ise `CanonicalAddressForm`'un kendi gizli alanlarında,
 * `transportAddress.<key>` adıyla. Sunucu action'ı ikisini `readTransportPlanWrite`
 * ile birleştiriyor. İki ayrı kanal, çünkü adres formu gövdesini kendisi
 * kuruyor (`addressWriteBody`) ve bunu bir üst taslağa taşımanın tek yolu
 * DOM'u okumak olurdu.
 *
 * Kuralların tek kaynağı `transportPlanErrors`: form gönderimden önce, sunucu
 * gövdeyi kurmadan önce aynı işlevi okuyor. Alan anahtarları backend'in
 * `details[]` yolu ile aynı biçimde (`shuttles[0].stops[1].scheduledAt`) ki
 * sunucu reddi de aynı alana düşsün.
 *
 * `server-only` değil: taslak tipi ve doğrulama istemcide de okunuyor.
 */

export type StopDraft = {
  /** İstemci anahtarı; React `key` ve adres alanının adı. Sunucuya kimlik olarak gitmez. */
  readonly key: string;
  /** Var olan durağın kimliği; yerinde güncelleme ve koltukların korunması. */
  readonly id: string | null;
  readonly label: string;
  /** `datetime-local` değeri, İstanbul saati. */
  readonly scheduledAt: string;
  /** Kayıtlı durağın adres satırı; adres değiştirilmiyorsa ekranda bu durur. */
  readonly savedAddress: string | null;
  /** Yeni durakta hep açık; var olan durakta kullanıcı "adresi değiştir" deyince. */
  readonly editingAddress: boolean;
  readonly seatsTaken: number;
};

export type ShuttleDraft = {
  readonly key: string;
  readonly id: string | null;
  readonly direction: TransportDirection;
  readonly name: string;
  readonly plate: string;
  readonly capacity: string;
  readonly driverName: string;
  readonly driverPhone: string;
  readonly seatsTaken: number;
  readonly stops: readonly StopDraft[];
};

export type TransportPlanDraft = {
  readonly outboundMethod: TransportMethod;
  readonly returnMethod: TransportMethod;
  readonly allowanceAmount: string;
  readonly allowanceNote: string;
  readonly notes: string;
  readonly shuttles: readonly ShuttleDraft[];
};

/** Gizli alanın adı; form ve sunucu aynı sabiti okur. */
export const transportPlanField = "transportPlan";

/** Durak adresinin gizli alan adı. */
export function transportAddressField(stopKey: string): string {
  return `transportAddress.${stopKey}`;
}

export const emptyTransportPlanDraft: TransportPlanDraft = {
  outboundMethod: "NONE",
  returnMethod: "NONE",
  allowanceAmount: "",
  allowanceNote: "",
  notes: "",
  shuttles: [],
};

/** `ShuttleWriteDto.capacity`: 1–100. */
export const shuttleCapacityRange = { minimum: 1, maximum: 100 } as const;

/** DTO `@Size` sınırları. */
export const transportTextLimits = {
  name: 120,
  plate: 20,
  driverName: 120,
  driverPhone: 32,
  label: 120,
  allowanceNote: 500,
  notes: 1000,
} as const;

/** Ondalık tutar: `@Digits(integer = 17, fraction = 2)`. */
const allowancePattern = /^\d{1,17}([.,]\d{1,2})?$/;

let keyCounter = 0;

/**
 * Yeni satır anahtarı; sayfa ömrü boyunca benzersiz, sunucuya kimlik olarak
 * gitmez. Yalnız tarayıcı olaylarında çağrılır (`transportPlanDraftFrom`
 * kayıtlı satıra kimliğinden anahtar verir); `new-` öneki kayıtlı satırın
 * `shuttle-<uuid>` anahtarıyla çakışmasın diye.
 */
export function nextDraftKey(prefix: "shuttle" | "stop"): string {
  keyCounter += 1;
  return `new-${prefix}-${keyCounter}`;
}

export function emptyShuttleDraft(direction: TransportDirection): ShuttleDraft {
  return {
    key: nextDraftKey("shuttle"),
    id: null,
    direction,
    name: "",
    plate: "",
    capacity: "",
    driverName: "",
    driverPhone: "",
    seatsTaken: 0,
    stops: [emptyStopDraft()],
  };
}

export function emptyStopDraft(): StopDraft {
  return {
    key: nextDraftKey("stop"),
    id: null,
    label: "",
    scheduledAt: "",
    savedAddress: null,
    editingAddress: true,
    seatsTaken: 0,
  };
}

/**
 * Kayıtlı planı taslağa açar. Kimlikler korunuyor ki kaydetme yerinde
 * güncelleme olsun ve koltuklar düşmesin; adresler kapalı başlıyor, çünkü
 * `address` gövdeye girmezse backend mevcut adresi koruyor.
 *
 * Kayıtlı satırın anahtarı kimliğinden türüyor, sayaçtan değil: form
 * sunucuda da çiziliyor ve sayaç sunucu ile tarayıcıda farklı yerden
 * başlayınca `id`/`htmlFor` hidrasyonda ayrışıyordu. Sayaç yalnız
 * tarayıcıda, kullanıcı satır ekleyince çalışıyor.
 */
export function transportPlanDraftFrom(plan: TransportPlan | null): TransportPlanDraft {
  if (plan === null) return emptyTransportPlanDraft;
  return {
    outboundMethod: methodOrNone(plan.outboundMethod),
    returnMethod: methodOrNone(plan.returnMethod),
    allowanceAmount: plan.allowanceAmount ?? "",
    allowanceNote: plan.allowanceNote ?? "",
    notes: plan.notes ?? "",
    shuttles: plan.shuttles.map((shuttle) => ({
      key: `shuttle-${shuttle.id}`,
      id: shuttle.id,
      direction: shuttle.direction,
      name: shuttle.name,
      plate: shuttle.plate ?? "",
      capacity: String(shuttle.capacity),
      driverName: shuttle.driverName ?? "",
      driverPhone: shuttle.driverPhone ?? "",
      seatsTaken: shuttle.seatsTaken,
      stops: shuttle.stops.map((stop) => ({
        key: `stop-${stop.id}`,
        id: stop.id,
        label: stop.label ?? "",
        scheduledAt: instantToIstanbulLocal(stop.scheduledAt),
        savedAddress: stop.address?.displayAddress ?? null,
        editingAddress: false,
        seatsTaken: stop.seatsTaken,
      })),
    })),
  };
}

function methodOrNone(value: string): TransportMethod {
  return isTransportMethod(value) ? value : "NONE";
}

export function isTransportMethod(value: unknown): value is TransportMethod {
  return typeof value === "string" && (transportMethods as readonly string[]).includes(value);
}

function isTransportDirection(value: unknown): value is TransportDirection {
  return typeof value === "string" && (transportDirections as readonly string[]).includes(value);
}

/** Yönün yöntemi. */
export function methodFor(draft: TransportPlanDraft, direction: TransportDirection): TransportMethod {
  return direction === "OUTBOUND" ? draft.outboundMethod : draft.returnMethod;
}

/** Yöntemlerden biri yol parası ise tutar zorunlu; değilse gövdeye giremez. */
export function allowanceApplies(draft: Pick<TransportPlanDraft, "outboundMethod" | "returnMethod">): boolean {
  return draft.outboundMethod === "CASH_ALLOWANCE" || draft.returnMethod === "CASH_ALLOWANCE";
}

/**
 * Plan "boş" mu: iki yön de `NONE` ve servis yok. İlan sihirbazı böyle bir
 * planı hiç yazmıyor — yazsaydı her yeni ilan bir ulaşım planı kaydı
 * taşırdı ve herkese açık sayfada "Ulaşım sağlanmıyor" bölümü çizilirdi.
 */
export function isEmptyTransportPlan(draft: TransportPlanDraft): boolean {
  return (
    draft.outboundMethod === "NONE" &&
    draft.returnMethod === "NONE" &&
    draft.shuttles.length === 0 &&
    !draft.allowanceAmount.trim() &&
    !draft.allowanceNote.trim() &&
    !draft.notes.trim()
  );
}

/**
 * Alan bazlı Türkçe hatalar. `hasAddress(stopKey)` adresin gövdede olup
 * olmadığını söyler: istemcide gizli alanın doluluğu, sunucuda `readAddressWrite`.
 */
export function transportPlanErrors(
  draft: TransportPlanDraft,
  hasAddress: (stopKey: string) => boolean,
): Record<string, string> {
  const errors: Record<string, string> = {};

  if (allowanceApplies(draft)) {
    const amount = draft.allowanceAmount.trim();
    if (!amount) errors.allowanceAmount = "Yol parası tutarını yazmalısın.";
    else if (!allowancePattern.test(amount)) errors.allowanceAmount = "Tutar en fazla iki ondalık basamak taşıyabilir.";
  }
  if (draft.allowanceNote.trim().length > transportTextLimits.allowanceNote) {
    errors.allowanceNote = `En fazla ${transportTextLimits.allowanceNote} karakter olabilir.`;
  }
  if (draft.notes.trim().length > transportTextLimits.notes) {
    errors.notes = `En fazla ${transportTextLimits.notes} karakter olabilir.`;
  }

  draft.shuttles.forEach((shuttle, index) => {
    const at = `shuttles[${index}]`;
    if (methodFor(draft, shuttle.direction) !== "SHUTTLE") {
      errors[`${at}.direction`] = "Bu yönün yöntemi servis değil; servisi kaldır ya da yöntemi değiştir.";
    }
    if (!shuttle.name.trim()) errors[`${at}.name`] = "Servisin adını yazmalısın.";
    else if (shuttle.name.trim().length > transportTextLimits.name) {
      errors[`${at}.name`] = `En fazla ${transportTextLimits.name} karakter olabilir.`;
    }
    const capacity = Number(shuttle.capacity.trim());
    if (
      !/^\d+$/.test(shuttle.capacity.trim()) ||
      capacity < shuttleCapacityRange.minimum ||
      capacity > shuttleCapacityRange.maximum
    ) {
      errors[`${at}.capacity`] = "Koltuk sayısı 1 ile 100 arasında olmalı.";
    } else if (capacity < shuttle.seatsTaken) {
      errors[`${at}.capacity`] = `Bu serviste ${shuttle.seatsTaken} koltuk seçilmiş; sayı bunun altına inemez.`;
    }
    if (shuttle.plate.trim().length > transportTextLimits.plate) {
      errors[`${at}.plate`] = `En fazla ${transportTextLimits.plate} karakter olabilir.`;
    }
    if (shuttle.driverName.trim().length > transportTextLimits.driverName) {
      errors[`${at}.driverName`] = `En fazla ${transportTextLimits.driverName} karakter olabilir.`;
    }
    if (shuttle.driverPhone.trim().length > transportTextLimits.driverPhone) {
      errors[`${at}.driverPhone`] = `En fazla ${transportTextLimits.driverPhone} karakter olabilir.`;
    }
    if (shuttle.stops.length === 0) errors[`${at}.stops`] = "En az bir durak eklemelisin.";

    shuttle.stops.forEach((stop, stopIndex) => {
      const stopAt = `${at}.stops[${stopIndex}]`;
      if (stop.label.trim().length > transportTextLimits.label) {
        errors[`${stopAt}.label`] = `En fazla ${transportTextLimits.label} karakter olabilir.`;
      }
      if (istanbulLocalToInstant(stop.scheduledAt.trim()) === null) {
        errors[`${stopAt}.scheduledAt`] = "Kalkış saatini seçmelisin.";
      }
      // Var olan durakta adres kapalıysa mevcut adres korunuyor; açıldıysa ya
      // da durak yeniyse gövdede adres olmalı.
      if ((stop.id === null || stop.editingAddress) && !hasAddress(stop.key)) {
        errors[`${stopAt}.address`] = "Durağın adresini onaylaman gerekiyor.";
      }
    });
  });

  return errors;
}

/** `TransportPlanWriteDto`. */
export type TransportPlanWriteBody = {
  outboundMethod: TransportMethod;
  returnMethod: TransportMethod;
  allowanceAmount: string | null;
  allowanceNote: string | null;
  notes: string | null;
  shuttles: {
    id?: string;
    direction: TransportDirection;
    name: string;
    plate: string | null;
    capacity: number;
    driverName: string | null;
    driverPhone: string | null;
    stops: {
      id?: string;
      label: string | null;
      scheduledAt: string;
      address?: AddressWrite;
    }[];
  }[];
};

/**
 * Taslağı gövdeye çevirir; kural ihlali varsa `null`. Gövde beyaz listeyle
 * kuruluyor: DTO tanımadığı alanı 400'e çeviriyor ve `key`, `savedAddress`,
 * `seatsTaken` gibi istemci alanları oraya gidemez.
 *
 * Tutar dize olarak gidiyor: Jackson dizeyi doğrudan `BigDecimal`'e çeviriyor
 * ve kuruş bir kayan nokta turundan geçmiyor (`fetchPriceQuote` ile aynı).
 */
export function transportPlanWriteBody(
  draft: TransportPlanDraft,
  addressOf: (stopKey: string) => AddressWrite | null,
): TransportPlanWriteBody | null {
  if (Object.keys(transportPlanErrors(draft, (key) => addressOf(key) !== null)).length > 0) {
    return null;
  }
  const allowance = allowanceApplies(draft);
  return {
    outboundMethod: draft.outboundMethod,
    returnMethod: draft.returnMethod,
    allowanceAmount: allowance ? draft.allowanceAmount.trim().replace(",", ".") : null,
    allowanceNote: allowance ? blankToNull(draft.allowanceNote) : null,
    notes: blankToNull(draft.notes),
    shuttles: draft.shuttles.map((shuttle) => ({
      ...(shuttle.id === null ? {} : { id: shuttle.id }),
      direction: shuttle.direction,
      name: shuttle.name.trim(),
      plate: blankToNull(shuttle.plate),
      capacity: Number(shuttle.capacity.trim()),
      driverName: blankToNull(shuttle.driverName),
      driverPhone: blankToNull(shuttle.driverPhone),
      stops: shuttle.stops.map((stop) => {
        const address = stop.id === null || stop.editingAddress ? addressOf(stop.key) : null;
        return {
          ...(stop.id === null ? {} : { id: stop.id }),
          label: blankToNull(stop.label),
          scheduledAt: istanbulLocalToInstant(stop.scheduledAt.trim()) ?? "",
          ...(address === null ? {} : { address }),
        };
      }),
    })),
  };
}

function blankToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/**
 * Gizli alandaki JSON'u taslağa süzer; tarayıcıdan geldiği için her alan
 * yeniden okunuyor ve tanınmayan değer düşüyor. Biçim bozuksa `null`.
 */
export function parseTransportPlanDraft(raw: unknown): TransportPlanDraft | null {
  if (!isRecord(raw)) return null;
  if (!isTransportMethod(raw.outboundMethod) || !isTransportMethod(raw.returnMethod)) return null;
  if (!Array.isArray(raw.shuttles)) return null;

  const shuttles: ShuttleDraft[] = [];
  for (const shuttle of raw.shuttles) {
    if (!isRecord(shuttle) || !isTransportDirection(shuttle.direction)) return null;
    if (!Array.isArray(shuttle.stops)) return null;
    const stops: StopDraft[] = [];
    for (const stop of shuttle.stops) {
      if (!isRecord(stop)) return null;
      stops.push({
        key: text(stop.key),
        id: uuidOrNull(stop.id),
        label: text(stop.label),
        scheduledAt: text(stop.scheduledAt),
        savedAddress: null,
        editingAddress: stop.editingAddress === true,
        seatsTaken: 0,
      });
    }
    shuttles.push({
      key: text(shuttle.key),
      id: uuidOrNull(shuttle.id),
      direction: shuttle.direction,
      name: text(shuttle.name),
      plate: text(shuttle.plate),
      capacity: text(shuttle.capacity),
      driverName: text(shuttle.driverName),
      driverPhone: text(shuttle.driverPhone),
      // Sunucu doluluğu taslaktan değil plandan bilir; buradaki sayı yalnız
      // istemci uyarısı içindir ve kapasite reddini backend zaten veriyor.
      seatsTaken: 0,
      stops,
    });
  }

  return {
    outboundMethod: raw.outboundMethod,
    returnMethod: raw.returnMethod,
    allowanceAmount: text(raw.allowanceAmount),
    allowanceNote: text(raw.allowanceNote),
    notes: text(raw.notes),
    shuttles,
  };
}

/**
 * Gizli alanın ham metni; JSON bozuksa `null`. Ayrıştırma burada, çünkü
 * oturumlu sunucu modüllerinde her `catch` Next kontrol akışını yeniden
 * fırlatmak zorunda (`control-flow-rethrow.test.ts`) ve `JSON.parse`
 * öyle bir akış üretmiyor.
 */
export function parseTransportPlanField(raw: string): TransportPlanDraft | null {
  try {
    return parseTransportPlanDraft(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** Gizli alana yazılan biçim; `savedAddress` ekranın, sunucunun değil. */
export function serializeTransportPlanDraft(draft: TransportPlanDraft): string {
  return JSON.stringify({
    outboundMethod: draft.outboundMethod,
    returnMethod: draft.returnMethod,
    allowanceAmount: draft.allowanceAmount,
    allowanceNote: draft.allowanceNote,
    notes: draft.notes,
    shuttles: draft.shuttles.map((shuttle) => ({
      key: shuttle.key,
      id: shuttle.id,
      direction: shuttle.direction,
      name: shuttle.name,
      plate: shuttle.plate,
      capacity: shuttle.capacity,
      driverName: shuttle.driverName,
      driverPhone: shuttle.driverPhone,
      stops: shuttle.stops.map((stop) => ({
        key: stop.key,
        id: stop.id,
        label: stop.label,
        scheduledAt: stop.scheduledAt,
        editingAddress: stop.editingAddress,
      })),
    })),
  });
}

/**
 * Backend `details[]` alan adlarını formun anahtarlarına çevirir.
 *
 * Sınıf düzeyi `@AssertTrue` kuralları yöntem adıyla geliyor
 * (`allowanceAmountConsistent`, `everyShuttleOnAShuttleDirection`); ekranda
 * bir alanı var. Gerisi zaten aynı yolda.
 */
export function transportFieldErrors(
  fieldErrors: Readonly<Record<string, string>>,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const [field, message] of Object.entries(fieldErrors)) {
    if (field === "allowanceAmountConsistent") errors.allowanceAmount = message;
    else if (field === "everyShuttleOnAShuttleDirection") errors.shuttles = message;
    else errors[field] = message;
  }
  return errors;
}

/** Bir durağın adres formuna düşen alan hataları: `…stops[1].address.components.x` → `x`. */
export function stopAddressFieldErrors(
  fieldErrors: Readonly<Record<string, string>>,
  shuttleIndex: number,
  stopIndex: number,
): Record<string, string> {
  const prefix = `shuttles[${shuttleIndex}].stops[${stopIndex}].address.`;
  const errors: Record<string, string> = {};
  for (const [field, message] of Object.entries(fieldErrors)) {
    if (!field.startsWith(prefix)) continue;
    const rest = field.slice(prefix.length);
    const name = rest.startsWith("components.")
      ? rest.slice("components.".length)
      : rest.startsWith("position")
        ? "position"
        : rest;
    errors[name] = message;
  }
  return errors;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function uuidOrNull(value: unknown): string | null {
  return typeof value === "string" && uuidPattern.test(value) ? value : null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
