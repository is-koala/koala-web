import "server-only";

import { canonicalAddressFrom } from "@/address/read";
import { clean, known } from "@/server/api/dto";
import {
  transportDirections,
  transportMethods,
  type AssignmentTransport,
  type PublicTransportSummary,
  type SeatAssignment,
  type Shuttle,
  type ShuttleStop,
  type TransportDirection,
  type TransportMethodValue,
  type TransportPlan,
} from "@/transport/contract";

/**
 * Ulaşım DTO'larının tel biçimi ve ekran modeline çeviricileri
 * (backend 0.9.28, is-koala/koala-web#187).
 *
 * Üç yanıt aynı `ShuttleDto`'yu taşıyor ve **kim ne görür** kararını sunucu
 * veriyor (plaka/şoför işçide yalnız seçili serviste, adres iptal edilmişte
 * ilçe düzeyi). Çevirici geleni olduğu gibi daraltıyor, hiçbir alanı
 * kendisi gizlemiyor ya da doldurmuyor: gizlemek sunucunun işi ve iki yerde
 * yapılan kural bir gün ayrışırdı. Herkese açık özet ayrı bir DTO
 * (`JobTransportDto`) ve tipinde plaka/adres alanı hiç yok.
 *
 * Her alan eksik gelebilir sayılıyor: eski sunucu `transport` alanını hiç
 * göndermiyor ve çeviriciler `null`'a düşüyor.
 */

const methods = new Set<TransportMethodValue>(transportMethods);
const directions = new Set<TransportDirection>(transportDirections);

export type PublicStopDto = {
  districtName?: string | null;
  neighborhood?: string | null;
  scheduledAt?: string | null;
};

export type PublicShuttleDto = {
  direction?: string | null;
  name?: string | null;
  stops?: readonly PublicStopDto[] | null;
};

/** `JobTransportDto`; `JobDetailDto.transport`. */
export type JobTransportDto = {
  outboundMethod?: string | null;
  returnMethod?: string | null;
  allowanceAmount?: string | number | null;
  shuttleCount?: number | null;
  shuttles?: readonly PublicShuttleDto[] | null;
};

export type ShuttleStopDto = {
  id?: string | null;
  label?: string | null;
  scheduledAt?: string | null;
  sortOrder?: number | null;
  address?: unknown;
  seatsTaken?: number | null;
};

export type ShuttleDto = {
  id?: string | null;
  direction?: string | null;
  name?: string | null;
  plate?: string | null;
  capacity?: number | null;
  seatsTaken?: number | null;
  driverName?: string | null;
  driverPhone?: string | null;
  sortOrder?: number | null;
  stops?: readonly ShuttleStopDto[] | null;
};

export type TransportPlanDto = {
  id?: string | null;
  jobId?: string | null;
  outboundMethod?: string | null;
  returnMethod?: string | null;
  allowanceAmount?: string | number | null;
  allowanceNote?: string | null;
  notes?: string | null;
  shuttles?: readonly ShuttleDto[] | null;
  updatedAt?: string | null;
};

export type SeatAssignmentDto = {
  id?: string | null;
  direction?: string | null;
  shuttleId?: string | null;
  stopId?: string | null;
};

export type AssignmentTransportDto = {
  outboundMethod?: string | null;
  returnMethod?: string | null;
  allowanceAmount?: string | number | null;
  allowanceNote?: string | null;
  notes?: string | null;
  shuttles?: readonly ShuttleDto[] | null;
  seats?: readonly SeatAssignmentDto[] | null;
};

/**
 * Herkese açık özet; `transport` alanı `null` ya da eksikse `null`.
 *
 * Yöntemi okunamayan bir plan yine de çiziliyor (`UNKNOWN` → "Belirtilmedi"):
 * ileri sunucunun yeni bir yöntemi ilan sayfasını boş bırakmamalı.
 */
export function toPublicTransportSummary(
  dto: JobTransportDto | null | undefined,
): PublicTransportSummary | null {
  if (!dto) return null;
  const shuttles = (dto.shuttles ?? []).flatMap((shuttle) => {
    const direction = known(shuttle?.direction, directions);
    if (direction === "UNKNOWN") return [];
    return [
      {
        direction,
        name: clean(shuttle.name) ?? "Servis",
        stops: (shuttle.stops ?? []).flatMap((stop) => {
          const scheduledAt = clean(stop?.scheduledAt);
          return scheduledAt === null
            ? []
            : [
                {
                  districtName: clean(stop.districtName),
                  neighborhood: clean(stop.neighborhood),
                  scheduledAt,
                },
              ];
        }),
      },
    ];
  });
  return {
    outboundMethod: known(dto.outboundMethod, methods),
    returnMethod: known(dto.returnMethod, methods),
    allowanceAmount: amountOf(dto.allowanceAmount),
    shuttleCount: typeof dto.shuttleCount === "number" ? dto.shuttleCount : shuttles.length,
    shuttles,
  };
}

export function toTransportPlan(dto: TransportPlanDto): TransportPlan {
  return {
    outboundMethod: known(dto.outboundMethod, methods),
    returnMethod: known(dto.returnMethod, methods),
    allowanceAmount: amountOf(dto.allowanceAmount),
    allowanceNote: clean(dto.allowanceNote),
    notes: clean(dto.notes),
    shuttles: toShuttles(dto.shuttles),
    updatedAt: clean(dto.updatedAt),
  };
}

export function toAssignmentTransport(dto: AssignmentTransportDto): AssignmentTransport {
  return {
    outboundMethod: known(dto.outboundMethod, methods),
    returnMethod: known(dto.returnMethod, methods),
    allowanceAmount: amountOf(dto.allowanceAmount),
    allowanceNote: clean(dto.allowanceNote),
    notes: clean(dto.notes),
    shuttles: toShuttles(dto.shuttles),
    seats: (dto.seats ?? []).flatMap((seat) => toSeat(seat)),
  };
}

function toShuttles(dtos: readonly ShuttleDto[] | null | undefined): readonly Shuttle[] {
  return (dtos ?? [])
    .flatMap((shuttle) => {
      const id = clean(shuttle?.id);
      const direction = known(shuttle?.direction, directions);
      if (id === null || direction === "UNKNOWN") return [];
      return [
        {
          id,
          direction,
          name: clean(shuttle.name) ?? "Servis",
          plate: clean(shuttle.plate),
          capacity: typeof shuttle.capacity === "number" ? shuttle.capacity : 0,
          seatsTaken: typeof shuttle.seatsTaken === "number" ? shuttle.seatsTaken : 0,
          driverName: clean(shuttle.driverName),
          driverPhone: clean(shuttle.driverPhone),
          sortOrder: shuttle.sortOrder ?? 0,
          stops: toStops(shuttle.stops),
        },
      ];
    })
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map(({ sortOrder: _sortOrder, ...shuttle }) => {
      void _sortOrder;
      return shuttle;
    });
}

function toStops(dtos: readonly ShuttleStopDto[] | null | undefined): readonly ShuttleStop[] {
  return (dtos ?? [])
    .flatMap((stop) => {
      const id = clean(stop?.id);
      const scheduledAt = clean(stop?.scheduledAt);
      if (id === null || scheduledAt === null) return [];
      const address = canonicalAddressFrom(stop.address);
      return [
        {
          id,
          label: clean(stop.label),
          scheduledAt,
          seatsTaken: typeof stop.seatsTaken === "number" ? stop.seatsTaken : 0,
          address:
            address === null
              ? null
              : { displayAddress: address.displayAddress, position: address.position ?? null },
          sortOrder: stop.sortOrder ?? 0,
        },
      ];
    })
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map(({ sortOrder: _sortOrder, ...stop }) => {
      void _sortOrder;
      return stop;
    });
}

function toSeat(dto: SeatAssignmentDto | null | undefined): readonly SeatAssignment[] {
  const direction = known(dto?.direction, directions);
  const shuttleId = clean(dto?.shuttleId);
  const stopId = clean(dto?.stopId);
  if (direction === "UNKNOWN" || shuttleId === null || stopId === null) return [];
  return [{ direction, shuttleId, stopId }];
}

/**
 * Tutar dize olarak taşınıyor: backend `BigDecimal` yazıyor ve Jackson onu
 * sayı olarak da gönderebiliyor; ekran `formatMoney` ile dizeden okuyor.
 */
function amountOf(value: string | number | null | undefined): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return value.toFixed(2);
  return clean(typeof value === "string" ? value : null);
}
