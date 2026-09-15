import { describe, expect, it } from "vitest";

import {
  formatStopTime,
  instantToIstanbulLocal,
  istanbulLocalToInstant,
  seatFor,
  seatsLeft,
  shuttlesFor,
  stopDirectionsUrl,
} from "./contract";

describe("durak saati çevirisi", () => {
  it("Instant'ı İstanbul duvar saatine, duvar saatini Instant'a çevirir", () => {
    // Türkiye sabit UTC+3; yaz saati yok, o yüzden ofset çevirisi yeter.
    expect(instantToIstanbulLocal("2026-09-20T03:40:00Z")).toBe("2026-09-20T06:40");
    expect(istanbulLocalToInstant("2026-09-20T06:40")).toBe("2026-09-20T03:40:00Z");
    // Gece yarısını geçen kalkış günü kaydırmaz.
    expect(istanbulLocalToInstant("2026-09-20T01:30")).toBe("2026-09-19T22:30:00Z");
    expect(instantToIstanbulLocal("2026-09-19T22:30:00Z")).toBe("2026-09-20T01:30");
  });

  it("tarayıcının saniyeli değerini kabul eder, biçim dışını ve boşu reddeder", () => {
    expect(istanbulLocalToInstant("2026-09-20T06:40:15")).toBe("2026-09-20T03:40:15Z");
    expect(istanbulLocalToInstant("")).toBeNull();
    expect(istanbulLocalToInstant("20.09.2026 06:40")).toBeNull();
    expect(istanbulLocalToInstant("2026-13-40T06:40")).toBeNull();
    expect(instantToIstanbulLocal(null)).toBe("");
    expect(instantToIstanbulLocal("bozuk")).toBe("");
  });

  it("ekrana gün, ay ve saati İstanbul saatiyle yazar", () => {
    expect(formatStopTime("2026-09-20T03:40:00Z")).toBe("20 Eyl 06:40");
    expect(formatStopTime("bozuk")).toBe("bozuk");
  });
});

describe("yol tarifi bağlantısı", () => {
  it("Google Haritalar api=1 derin bağlantısı; yalnız hedef, toplu taşıma", () => {
    expect(stopDirectionsUrl({ latitude: 40.9925, longitude: 29.0245 })).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=40.9925%2C29.0245&travelmode=transit",
    );
  });
});

describe("koltuk yardımcıları", () => {
  const shuttles = [
    { id: "a", direction: "OUTBOUND" as const, capacity: 3, seatsTaken: 3 },
    { id: "b", direction: "RETURN" as const, capacity: 2, seatsTaken: 5 },
  ];

  it("yönün servislerini plan sırasıyla verir ve yön başına tek koltuk bulur", () => {
    expect(shuttlesFor(shuttles, "RETURN").map((shuttle) => shuttle.id)).toEqual(["b"]);
    const seats = [{ direction: "RETURN" as const, shuttleId: "b", stopId: "s" }];
    expect(seatFor({ seats }, "RETURN")).toEqual(seats[0]);
    expect(seatFor({ seats }, "OUTBOUND")).toBeNull();
  });

  it("boş koltuk sayısı sıfırın altına inmez", () => {
    expect(seatsLeft(shuttles[0])).toBe(0);
    expect(seatsLeft(shuttles[1])).toBe(0);
    expect(seatsLeft({ capacity: 4, seatsTaken: 1 })).toBe(3);
  });
});
