import { describe, expect, it } from "vitest";

import {
  assignmentCompletion,
  assignmentNextStep,
  employerAssignmentTimeline,
} from "./employer-tracking";

describe("işveren atama tamamlama kararı", () => {
  it("yalnız onaylanmış ve süren atamada, para emanetteyken açılır", () => {
    // `JobAssignmentManager.completeAssignment` iki koşul arıyor: ödeme
    // `HELD_IN_ESCROW` ve durum {CONFIRMED, IN_PROGRESS}. İkisi de istemciden
    // okunabiliyor, yani düğme mümkün olmayan bir eylemi hiç göstermiyor.
    for (const assignmentStatus of ["CONFIRMED", "IN_PROGRESS"]) {
      expect(
        assignmentCompletion({ assignmentStatus, paymentStatus: "HELD_IN_ESCROW" }),
      ).toEqual({ available: true, blockedReason: null });
    }
  });

  it("para emanete alınmadan tamamlamayı kapatır", () => {
    const decision = assignmentCompletion({
      assignmentStatus: "CONFIRMED",
      paymentStatus: "PENDING_COLLECTION",
    });

    expect(decision.available).toBe(false);
    expect(decision.blockedReason).toContain("Ödeme");
  });

  it("işçi onaylamadan tamamlamayı kapatır ve nedenini yazar", () => {
    const decision = assignmentCompletion({
      assignmentStatus: "PENDING_CONFIRMATION",
      paymentStatus: "HELD_IN_ESCROW",
    });

    expect(decision.available).toBe(false);
    expect(decision.blockedReason).toContain("onay");
  });

  it("bitmiş her durumu ayrı ayrı adlandırır", () => {
    const reasons = ["COMPLETED", "CANCELLED", "REJECTED"].map(
      (assignmentStatus) =>
        assignmentCompletion({ assignmentStatus, paymentStatus: "HELD_IN_ESCROW" }).blockedReason,
    );

    expect(reasons.every((reason) => typeof reason === "string" && reason.length > 0)).toBe(true);
    expect(new Set(reasons).size).toBe(3);
  });

  it("okunamayan durumu açık saymaz", () => {
    // Tanınmayan bir durumda geri alınamaz bir düğme çizmek, kullanıcıya ne
    // yaptığını okuyamadığı bir eylem sunmak olurdu.
    expect(
      assignmentCompletion({ assignmentStatus: "UNKNOWN", paymentStatus: "HELD_IN_ESCROW" }),
    ).toMatchObject({ available: false });
  });
});

describe("sıradaki adım", () => {
  it("onay bekleyen atamada işçiyi, onaylanmışta ödemeyi işaret eder", () => {
    expect(
      assignmentNextStep("PENDING_CONFIRMATION", "PENDING_COLLECTION"),
    ).toContain("işçinin");
    expect(assignmentNextStep("CONFIRMED", "PENDING_COLLECTION")).toContain("Ödeme");
  });

  it("emanetteki parada işin tamamlanmasını bekletir", () => {
    expect(assignmentNextStep("IN_PROGRESS", "HELD_IN_ESCROW")).toContain("tamamlandı");
  });
});

describe("atama zaman çizelgesi", () => {
  it("beş aşamayı sırayla taşır ve nereye gelindiğini işaretler", () => {
    const timeline = employerAssignmentTimeline({
      status: "IN_PROGRESS",
      paymentStatus: "HELD_IN_ESCROW",
      assignedAt: "2026-09-01T09:00:00Z",
      paymentSecuredAt: "2026-09-01T12:00:00Z",
      completedAt: null,
      confirmedAt: null,
      cancelledAt: null,
      sessions: [{ id: "s1", checkInAt: "2026-09-02T08:00:00Z", checkOutAt: null, minutes: null }],
    });

    expect(timeline.map((event) => event.key)).toEqual([
      "offered",
      "confirmed",
      "payment-secured",
      "started",
      "completed",
    ]);
    expect(timeline.map((event) => event.reached)).toEqual([true, true, true, true, false]);
    expect(timeline[0].at).toBe("2026-09-01T09:00:00Z");
    expect(timeline[2].at).toBe("2026-09-01T12:00:00Z");
    expect(timeline[3].at).toBe("2026-09-02T08:00:00Z");
  });

  it("onay ve emanet zamanlarını yalnız backend verdiğinde yazar", () => {
    // `confirmedAt` #282 ile geliyor; gelene kadar adım zamansız ama
    // ulaşılmış. Uydurulmuş bir zaman olmayan bir kaydı varmış gibi gösterirdi.
    const without = employerAssignmentTimeline({
      status: "CONFIRMED",
      paymentStatus: "PENDING_COLLECTION",
      assignedAt: "2026-09-01T09:00:00Z",
      completedAt: null,
      confirmedAt: null,
      paymentSecuredAt: null,
      cancelledAt: null,
      sessions: [],
    });
    expect(without.find((event) => event.key === "confirmed")).toMatchObject({ at: null, reached: true });
    expect(without.find((event) => event.key === "payment-secured")).toMatchObject({ at: null, reached: false });

    const withStamps = employerAssignmentTimeline({
      status: "CONFIRMED",
      paymentStatus: "HELD_IN_ESCROW",
      assignedAt: "2026-09-01T09:00:00Z",
      confirmedAt: "2026-09-01T10:00:00Z",
      paymentSecuredAt: null,
      completedAt: null,
      cancelledAt: null,
      sessions: [],
    });
    expect(withStamps.find((event) => event.key === "confirmed")?.at).toBe("2026-09-01T10:00:00Z");
    // Para alındı ama zamanı okunamadı: adım ulaşılmış, zamansız.
    expect(withStamps.find((event) => event.key === "payment-secured")).toMatchObject({ at: null, reached: true });
  });

  it("tamamlanmış atamada bitiş zamanını taşır", () => {
    const timeline = employerAssignmentTimeline({
      status: "COMPLETED",
      assignedAt: "2026-09-01T09:00:00Z",
      completedAt: "2026-09-03T18:00:00Z",
      paymentStatus: "RELEASED_TO_WORKER",
      confirmedAt: null,
      paymentSecuredAt: null,
      cancelledAt: null,
      sessions: [],
    });

    expect(timeline.every((event) => event.reached)).toBe(true);
    expect(timeline.at(-1)?.at).toBe("2026-09-03T18:00:00Z");
  });

  it("reddedilen atamada onay sonrasını hiç göstermez", () => {
    // Reddedilmiş bir atamada "iş başladı" adımını beklemede göstermek,
    // olmayacak bir adımı bekletirdi.
    const timeline = employerAssignmentTimeline({
      status: "REJECTED",
      assignedAt: "2026-09-01T09:00:00Z",
      completedAt: null,
      paymentStatus: "PENDING_COLLECTION",
      confirmedAt: null,
      paymentSecuredAt: null,
      cancelledAt: null,
      sessions: [],
    });

    expect(timeline.map((event) => event.key)).toEqual(["offered", "rejected"]);
  });

  it("iptal edilen atamada iptali son adım yapar ve iptal kaydının zamanını taşır", () => {
    const timeline = employerAssignmentTimeline({
      status: "CANCELLED",
      paymentStatus: "REFUNDED",
      assignedAt: "2026-09-01T09:00:00Z",
      paymentSecuredAt: "2026-09-01T12:00:00Z",
      cancelledAt: "2026-09-02T13:00:00Z",
      completedAt: null,
      confirmedAt: null,
      sessions: [{ id: "s1", checkInAt: "2026-09-02T08:00:00Z", checkOutAt: "2026-09-02T12:00:00Z", minutes: 240 }],
    });

    expect(timeline.map((event) => event.key)).toEqual([
      "offered",
      "confirmed",
      "payment-secured",
      "started",
      "cancelled",
    ]);
    expect(timeline.at(-1)).toMatchObject({ at: "2026-09-02T13:00:00Z", reached: true });
  });

  it("ödeme alınmadan iptal edilen atamada emanet adımını beklemede bırakmaz", () => {
    const timeline = employerAssignmentTimeline({
      status: "CANCELLED",
      paymentStatus: "PENDING_COLLECTION",
      assignedAt: "2026-09-01T09:00:00Z",
      completedAt: null,
      confirmedAt: null,
      paymentSecuredAt: null,
      cancelledAt: null,
      sessions: [],
    });

    expect(timeline.map((event) => event.key)).toEqual(["offered", "confirmed", "started", "cancelled"]);
  });

  it("emanet adımını atama durumundan çıkarmaz; yalnız ödeme kanıtıyla işaretler", () => {
    // Çizelge ödeme kaydını anlatıyor, sunucunun "emanetsiz tamamlama olmaz"
    // kuralını değil: ödeme durumu okunamamış tamamlanmış atamada adım
    // beklemede kalır, uydurulmaz.
    const timeline = employerAssignmentTimeline({
      status: "COMPLETED",
      paymentStatus: "UNKNOWN",
      assignedAt: "2026-09-01T09:00:00Z",
      confirmedAt: null,
      paymentSecuredAt: null,
      cancelledAt: null,
      completedAt: "2026-09-03T18:00:00Z",
      sessions: [],
    });

    expect(timeline.find((event) => event.key === "payment-secured")).toMatchObject({ reached: false, at: null });
    expect(timeline.at(-1)).toMatchObject({ key: "completed", reached: true });
  });
});
