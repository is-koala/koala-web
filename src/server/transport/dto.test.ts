import { describe, expect, it } from "vitest";

import { toAssignmentTransport, toPublicTransportSummary, toTransportPlan } from "./dto";

const shuttleDto = {
  id: "cccccccc-cccc-4ccc-8ccc-000000000001",
  direction: "OUTBOUND",
  name: "Anadolu yakası servisi",
  plate: "34 ABC 12",
  capacity: 12,
  seatsTaken: 3,
  driverName: "Mehmet Şoför",
  driverPhone: "0500 000 00 00",
  sortOrder: 1,
  stops: [
    {
      id: "cccccccc-cccc-4ccc-8ccc-000000000012",
      label: null,
      scheduledAt: "2026-09-20T04:00:00Z",
      sortOrder: 1,
      seatsTaken: 1,
      address: {
        id: "a1b2c3d4-0000-0000-0000-000000000001",
        countryName: "Türkiye",
        cityName: "İstanbul",
        districtName: "Kadıköy",
        components: { neighborhood: "Suadiye", thoroughfare: "Bağdat Caddesi", buildingNumber: "500" },
        displayAddress: "Bağdat Caddesi No: 500, Suadiye, Kadıköy/İstanbul",
        position: { latitude: 40.9612345678, longitude: 29.0866, source: "USER_CONFIRMED_PIN" },
        confirmedAt: "2026-09-14T08:00:00Z",
        canonicalVersion: 2,
        needsReview: false,
      },
    },
    {
      id: "cccccccc-cccc-4ccc-8ccc-000000000011",
      label: "Kadıköy İskele",
      scheduledAt: "2026-09-20T03:40:00Z",
      sortOrder: 0,
      seatsTaken: 2,
      address: null,
    },
  ],
};

describe("işveren planı (TransportPlanDto)", () => {
  it("dolu yanıtı sırayla ve tam adresle daraltır; tutar dize olur", () => {
    const plan = toTransportPlan({
      id: "eeeeeeee-eeee-4eee-8eee-000000000001",
      jobId: "9c1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f60",
      outboundMethod: "SHUTTLE",
      returnMethod: "CASH_ALLOWANCE",
      allowanceAmount: 150,
      allowanceNote: " İş bitince ",
      notes: "",
      updatedAt: "2026-09-14T08:00:00Z",
      shuttles: [
        { ...shuttleDto, id: "cccccccc-cccc-4ccc-8ccc-000000000002", direction: "RETURN", sortOrder: 0, stops: [] },
        shuttleDto,
      ],
    });

    expect(plan).toMatchObject({
      outboundMethod: "SHUTTLE",
      returnMethod: "CASH_ALLOWANCE",
      allowanceAmount: "150.00",
      allowanceNote: "İş bitince",
      notes: null,
      updatedAt: "2026-09-14T08:00:00Z",
    });
    expect(plan.shuttles.map((shuttle) => shuttle.direction)).toEqual(["RETURN", "OUTBOUND"]);
    const outbound = plan.shuttles[1];
    expect(outbound).toMatchObject({ plate: "34 ABC 12", capacity: 12, seatsTaken: 3, driverPhone: "0500 000 00 00" });
    expect(outbound.stops.map((stop) => stop.label)).toEqual(["Kadıköy İskele", null]);
    expect(outbound.stops[1].address).toEqual({
      displayAddress: "Bağdat Caddesi No: 500, Suadiye, Kadıköy/İstanbul",
      position: { latitude: 40.961235, longitude: 29.0866 },
    });
    expect(outbound.stops[0].address).toBeNull();
    // Tel biçiminin kalanı (`sortOrder`, adres kimliği/sürümü) modele girmiyor.
    expect(JSON.stringify(plan)).not.toMatch(/sortOrder|canonicalVersion|confirmedAt/);
  });

  it("eksik ve bozuk alanlarda düşmez: kimliksiz servis ve saatsiz durak atlanır, yöntem UNKNOWN", () => {
    const plan = toTransportPlan({
      outboundMethod: "TELEPORT",
      shuttles: [
        { id: null, direction: "OUTBOUND", name: "kimliksiz", stops: [] },
        { ...shuttleDto, direction: "SIDEWAYS" },
        { ...shuttleDto, stops: [{ id: shuttleDto.stops[0].id, scheduledAt: null }, null as never] },
      ],
    });

    expect(plan.outboundMethod).toBe("UNKNOWN");
    expect(plan.returnMethod).toBe("UNKNOWN");
    expect(plan.allowanceAmount).toBeNull();
    expect(plan.shuttles).toHaveLength(1);
    expect(plan.shuttles[0].stops).toEqual([]);
    expect(toTransportPlan({}).shuttles).toEqual([]);
  });
});

describe("işçi görünümü (AssignmentTransportDto)", () => {
  it("koltukları ve sunucunun seçili serviste bıraktığı plaka/şoförü olduğu gibi taşır", () => {
    const transport = toAssignmentTransport({
      outboundMethod: "SHUTTLE",
      returnMethod: "SELF",
      allowanceAmount: null,
      shuttles: [
        { ...shuttleDto, plate: null, driverName: null, driverPhone: null, id: "cccccccc-cccc-4ccc-8ccc-000000000003", sortOrder: 0 },
        shuttleDto,
      ],
      seats: [
        { id: "dddddddd-dddd-4ddd-8ddd-000000000001", direction: "OUTBOUND", shuttleId: shuttleDto.id, stopId: shuttleDto.stops[1].id },
        { direction: "RETURN", shuttleId: null, stopId: "x" },
      ],
    });

    expect(transport.shuttles[0].plate).toBeNull();
    expect(transport.shuttles[1].plate).toBe("34 ABC 12");
    expect(transport.seats).toEqual([
      { direction: "OUTBOUND", shuttleId: shuttleDto.id, stopId: shuttleDto.stops[1].id },
    ]);
  });
});

describe("herkese açık özet (JobTransportDto)", () => {
  it("dolu özeti ilçe/semt ve saat düzeyinde daraltır; plaka, şoför, adres gelse de modele girmez", () => {
    // Tel biçimi bir gün işveren `ShuttleDto`'sunu sızdırsa bile çevirici yalnız
    // özet alanlarını okur; çıktı `toEqual` ile birebir.
    const summary = toPublicTransportSummary({
      outboundMethod: "SHUTTLE",
      returnMethod: "NONE",
      allowanceAmount: "0.00",
      shuttleCount: 1,
      shuttles: [
        {
          ...shuttleDto,
          direction: "OUTBOUND",
          name: "Anadolu yakası servisi",
          stops: [
            { ...shuttleDto.stops[0], districtName: "Kadıköy", neighborhood: "Caferağa", scheduledAt: "2026-09-20T03:40:00Z" },
            { districtName: "Kadıköy", neighborhood: null, scheduledAt: null },
          ],
        } as never,
        { direction: "SIDEWAYS", name: "bozuk", stops: [] },
      ],
    });

    expect(summary).toEqual({
      outboundMethod: "SHUTTLE",
      returnMethod: "NONE",
      allowanceAmount: "0.00",
      shuttleCount: 1,
      shuttles: [
        {
          direction: "OUTBOUND",
          name: "Anadolu yakası servisi",
          stops: [{ districtName: "Kadıköy", neighborhood: "Caferağa", scheduledAt: "2026-09-20T03:40:00Z" }],
        },
      ],
    });
    expect(JSON.stringify(summary)).not.toMatch(/34 ABC 12|Mehmet|0500|Bağdat|latitude|plate|driver/);
  });

  it("alan yoksa (eski sunucu) ya da null ise özet yok; servis sayısı gelmezse listeden sayılır", () => {
    expect(toPublicTransportSummary(undefined)).toBeNull();
    expect(toPublicTransportSummary(null)).toBeNull();
    expect(toPublicTransportSummary({ outboundMethod: "SELF", returnMethod: "SELF", shuttles: [] })).toMatchObject({
      shuttleCount: 0,
      allowanceAmount: null,
    });
  });
});
