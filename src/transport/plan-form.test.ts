import { describe, expect, it } from "vitest";

import type { AddressWrite } from "@/address/contract";

import type { TransportPlan } from "./contract";
import {
  emptyTransportPlanDraft,
  isEmptyTransportPlan,
  parseTransportPlanField,
  serializeTransportPlanDraft,
  stopAddressFieldErrors,
  transportFieldErrors,
  transportPlanDraftFrom,
  transportPlanErrors,
  transportPlanWriteBody,
  type TransportPlanDraft,
} from "./plan-form";

const address: AddressWrite = {
  countryId: "2f0a1e58-6a3c-4a3f-9a10-6a1c2d3e4f52",
  cityId: "6f0a1e58-6a3c-4a3f-9a10-6a1c2d3e4f50",
  districtId: "1f0a1e58-6a3c-4a3f-9a10-6a1c2d3e4f53",
  components: { neighborhood: "Caferağa", thoroughfare: "Rıhtım Caddesi", buildingNumber: "1", postalCode: "34710" },
  position: { latitude: 40.9925, longitude: 29.0245, source: "USER_CONFIRMED_PIN" },
};

const savedPlan: TransportPlan = {
  outboundMethod: "SHUTTLE",
  returnMethod: "CASH_ALLOWANCE",
  allowanceAmount: "150.00",
  allowanceNote: "İş bitince",
  notes: "Servis 5 dk bekler.",
  updatedAt: "2026-09-14T08:00:00Z",
  shuttles: [
    {
      id: "cccccccc-cccc-4ccc-8ccc-000000000001",
      direction: "OUTBOUND",
      name: "Anadolu yakası",
      plate: "34 ABC 12",
      capacity: 12,
      seatsTaken: 3,
      driverName: "Mehmet",
      driverPhone: "0500 000 00 00",
      stops: [
        {
          id: "cccccccc-cccc-4ccc-8ccc-000000000011",
          label: "Kadıköy İskele",
          scheduledAt: "2026-09-20T03:40:00Z",
          seatsTaken: 2,
          address: { displayAddress: "Rıhtım Caddesi No: 1, Caferağa, Kadıköy/İstanbul", position: null },
        },
      ],
    },
  ],
};

function draftWithShuttle(overrides: Partial<TransportPlanDraft> = {}): TransportPlanDraft {
  return {
    ...emptyTransportPlanDraft,
    outboundMethod: "SHUTTLE",
    shuttles: [
      {
        key: "shuttle-1",
        id: null,
        direction: "OUTBOUND",
        name: "Avrupa yakası",
        plate: "",
        capacity: "10",
        driverName: "",
        driverPhone: "",
        seatsTaken: 0,
        stops: [
          {
            key: "stop-1",
            id: null,
            label: "Taksim",
            scheduledAt: "2026-09-20T06:40",
            savedAddress: null,
            editingAddress: true,
            seatsTaken: 0,
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe("kayıtlı planı taslağa açma", () => {
  it("kimlikleri ve doluluğu korur, saati İstanbul'a çevirir, adresi kapalı başlatır", () => {
    const draft = transportPlanDraftFrom(savedPlan);

    expect(draft.outboundMethod).toBe("SHUTTLE");
    expect(draft.allowanceAmount).toBe("150.00");
    const shuttle = draft.shuttles[0];
    expect(shuttle.id).toBe(savedPlan.shuttles[0].id);
    expect(shuttle.capacity).toBe("12");
    expect(shuttle.seatsTaken).toBe(3);
    const stop = shuttle.stops[0];
    expect(stop.id).toBe(savedPlan.shuttles[0].stops[0].id);
    expect(stop.scheduledAt).toBe("2026-09-20T06:40");
    expect(stop.savedAddress).toBe("Rıhtım Caddesi No: 1, Caferağa, Kadıköy/İstanbul");
    expect(stop.editingAddress).toBe(false);
    expect(stop.seatsTaken).toBe(2);
  });

  it("plan yoksa boş taslak; eski sunucudan okunamayan yöntem NONE'a düşer", () => {
    expect(transportPlanDraftFrom(null)).toBe(emptyTransportPlanDraft);
    const draft = transportPlanDraftFrom({ ...savedPlan, outboundMethod: "UNKNOWN", shuttles: [] });
    expect(draft.outboundMethod).toBe("NONE");
  });
});

describe("taslak doğrulaması", () => {
  it("boş plan geçerli ve boş sayılır", () => {
    expect(transportPlanErrors(emptyTransportPlanDraft, () => false)).toEqual({});
    expect(isEmptyTransportPlan(emptyTransportPlanDraft)).toBe(true);
    expect(isEmptyTransportPlan({ ...emptyTransportPlanDraft, notes: "x" })).toBe(false);
  });

  it("yol parası seçilince tutar ister, seçilmeyince tutarı gövdeye koymaz", () => {
    const draft = { ...emptyTransportPlanDraft, returnMethod: "CASH_ALLOWANCE" as const };
    expect(transportPlanErrors(draft, () => false)).toEqual({ allowanceAmount: "Yol parası tutarını yazmalısın." });
    expect(transportPlanErrors({ ...draft, allowanceAmount: "150,5" }, () => false)).toEqual({});
    expect(transportPlanErrors({ ...draft, allowanceAmount: "1.234" }, () => false)).toHaveProperty("allowanceAmount");

    const body = transportPlanWriteBody({ ...draft, allowanceAmount: "150,5", allowanceNote: " akşam " }, () => null);
    expect(body).toMatchObject({ allowanceAmount: "150.5", allowanceNote: "akşam", shuttles: [] });
    const without = transportPlanWriteBody({ ...emptyTransportPlanDraft, allowanceAmount: "" }, () => null);
    expect(without?.allowanceAmount).toBeNull();
  });

  it("servis alanlarını backend yolu biçiminde anahtarlar; yeni durakta adres zorunlu", () => {
    const draft = draftWithShuttle();
    const errors = transportPlanErrors(
      {
        ...draft,
        shuttles: [{ ...draft.shuttles[0], name: " ", capacity: "0", stops: [{ ...draft.shuttles[0].stops[0], scheduledAt: "" }] }],
      },
      () => false,
    );

    expect(errors).toEqual({
      "shuttles[0].name": "Servisin adını yazmalısın.",
      "shuttles[0].capacity": "Koltuk sayısı 1 ile 100 arasında olmalı.",
      "shuttles[0].stops[0].scheduledAt": "Kalkış saatini seçmelisin.",
      "shuttles[0].stops[0].address": "Durağın adresini onaylaman gerekiyor.",
    });
  });

  it("servis yalnız yöntemi servis olan yönde durabilir ve koltuk sayısı seçilmiş koltukların altına inemez", () => {
    const draft = draftWithShuttle({ outboundMethod: "SELF" });
    expect(transportPlanErrors(draft, () => true)).toHaveProperty("shuttles[0].direction");

    const taken = draftWithShuttle();
    const errors = transportPlanErrors(
      { ...taken, shuttles: [{ ...taken.shuttles[0], id: savedPlan.shuttles[0].id, capacity: "2", seatsTaken: 3 }] },
      () => true,
    );
    expect(errors["shuttles[0].capacity"]).toContain("3 koltuk seçilmiş");
  });

  it("var olan durakta adres kapalıysa gövdeye girmez ve mevcut adres korunur", () => {
    const draft = transportPlanDraftFrom(savedPlan);
    expect(transportPlanErrors(draft, () => false)).toEqual({});

    const body = transportPlanWriteBody(draft, () => null);
    expect(body?.shuttles[0]).toMatchObject({ id: savedPlan.shuttles[0].id, capacity: 12 });
    expect(body?.shuttles[0].stops[0]).toEqual({
      id: savedPlan.shuttles[0].stops[0].id,
      label: "Kadıköy İskele",
      scheduledAt: "2026-09-20T03:40:00Z",
    });
    expect(body?.shuttles[0].stops[0]).not.toHaveProperty("address");
  });
});

describe("gövde", () => {
  it("yeni servis ve durak kimliksiz gider, adres ve UTC saat taşır; istemci alanları gövdeye girmez", () => {
    const body = transportPlanWriteBody(draftWithShuttle(), (key) => (key === "stop-1" ? address : null));

    expect(body).toEqual({
      outboundMethod: "SHUTTLE",
      returnMethod: "NONE",
      allowanceAmount: null,
      allowanceNote: null,
      notes: null,
      shuttles: [
        {
          direction: "OUTBOUND",
          name: "Avrupa yakası",
          plate: null,
          capacity: 10,
          driverName: null,
          driverPhone: null,
          stops: [{ label: "Taksim", scheduledAt: "2026-09-20T03:40:00Z", address }],
        },
      ],
    });
    expect(JSON.stringify(body)).not.toMatch(/"key"|savedAddress|editingAddress|seatsTaken/);
  });

  it("kural ihlalinde gövde kurulmaz", () => {
    expect(transportPlanWriteBody(draftWithShuttle(), () => null)).toBeNull();
  });
});

describe("gizli alan gidiş dönüşü", () => {
  it("serileştirilen taslak sunucuda aynı gövdeyi kurar; doluluk sunucuda sıfırlanır", () => {
    const draft = transportPlanDraftFrom(savedPlan);
    const parsed = parseTransportPlanField(serializeTransportPlanDraft(draft));

    expect(parsed).not.toBeNull();
    expect(parsed?.shuttles[0].seatsTaken).toBe(0);
    expect(parsed?.shuttles[0].stops[0].savedAddress).toBeNull();
    expect(transportPlanWriteBody(parsed!, () => null)).toEqual(transportPlanWriteBody(draft, () => null));
  });

  it("bozuk JSON'u, tanınmayan yöntemi ve UUID olmayan kimliği reddeder", () => {
    expect(parseTransportPlanField("{")).toBeNull();
    expect(parseTransportPlanField(JSON.stringify({ outboundMethod: "TAXI", returnMethod: "NONE", shuttles: [] }))).toBeNull();
    const parsed = parseTransportPlanField(
      JSON.stringify({
        outboundMethod: "SHUTTLE",
        returnMethod: "NONE",
        shuttles: [{ id: "../auth", direction: "OUTBOUND", name: "x", capacity: "3", stops: [{ id: "1", scheduledAt: "" }] }],
      }),
    );
    expect(parsed?.shuttles[0].id).toBeNull();
    expect(parsed?.shuttles[0].stops[0].id).toBeNull();
    expect(
      parseTransportPlanField(JSON.stringify({ outboundMethod: "SHUTTLE", returnMethod: "NONE", shuttles: [{ direction: "UP", stops: [] }] })),
    ).toBeNull();
  });
});

describe("backend alan hataları", () => {
  it("sınıf düzeyi kuralları ekrandaki alana çevirir, gerisini olduğu gibi bırakır", () => {
    expect(
      transportFieldErrors({
        allowanceAmountConsistent: "Tutar gerekli",
        everyShuttleOnAShuttleDirection: "Yön uyumsuz",
        "shuttles[0].name": "Ad gerekli",
      }),
    ).toEqual({ allowanceAmount: "Tutar gerekli", shuttles: "Yön uyumsuz", "shuttles[0].name": "Ad gerekli" });
  });

  it("durağın adres alt gövdesini adres formunun alan adlarına kırpar", () => {
    expect(
      stopAddressFieldErrors(
        {
          "shuttles[0].stops[1].address.components.postalCode": "5 haneli",
          "shuttles[0].stops[1].address.position.latitude": "Sınır dışı",
          "shuttles[0].stops[1].address.districtId": "İlçe",
          "shuttles[0].stops[0].address.components.postalCode": "başka durak",
        },
        0,
        1,
      ),
    ).toEqual({ postalCode: "5 haneli", position: "Sınır dışı", districtId: "İlçe" });
  });
});
