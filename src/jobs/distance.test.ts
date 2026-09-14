import { describe, expect, it } from "vitest";

import {
  boundingBoxAround,
  distanceKm,
  formatDistanceKm,
  formatGeoPoint,
  parseDistanceKm,
  parseGeoPoint,
} from "./distance";

const sultanahmet = { latitude: 41.008238, longitude: 28.978359 };
const kadikoy = { latitude: 40.99, longitude: 29.03 };

describe("konum süzgecinin matematiği", () => {
  it("adres çubuğundaki konumu okur ve aynı biçimde geri yazar", () => {
    expect(parseGeoPoint("41.008238,28.978359")).toEqual(sultanahmet);
    expect(formatGeoPoint(sultanahmet)).toBe("41.008238,28.978359");
    expect(formatGeoPoint({ latitude: 41, longitude: 29 })).toBe("41.000000,29.000000");
  });

  it("bozuk ya da menzil dışı konumu düşürür", () => {
    expect(parseGeoPoint("41.0")).toBeNull();
    expect(parseGeoPoint("91,29")).toBeNull();
    expect(parseGeoPoint("41,181")).toBeNull();
    expect(parseGeoPoint("41.0082384,28.978359")).toBeNull();
    expect(parseGeoPoint(undefined)).toBeNull();
  });

  it("yalnız sunulan yarıçapları kabul eder", () => {
    expect(parseDistanceKm("5")).toBe(5);
    expect(parseDistanceKm("7")).toBeNull();
    expect(parseDistanceKm("abc")).toBeNull();
  });

  it("yarıçapı backend'in sınırlayıcı kutusuna çevirir", () => {
    const box = boundingBoxAround(sultanahmet, 5);
    expect(box.maxLatitude - box.minLatitude).toBeCloseTo(0.0898, 3);
    // Boylam farkı enleme göre genişler: 41°'de 5 km ≈ 0,059°.
    expect(box.maxLongitude - box.minLongitude).toBeCloseTo(0.119, 2);
    expect(box.minLatitude).toBeLessThan(sultanahmet.latitude);
    expect(box.maxLongitude).toBeGreaterThan(sultanahmet.longitude);
  });

  it("kutuyu kutup ve tarih çizgisinde kırpar", () => {
    const box = boundingBoxAround({ latitude: 89.99, longitude: 179.99 }, 25);
    expect(box.maxLatitude).toBe(90);
    expect(box.maxLongitude).toBe(180);
  });

  it("iki nokta arası mesafeyi kilometreyle verir", () => {
    // Sultanahmet–Kadıköy kuş uçuşu ~4,8 km.
    expect(distanceKm(sultanahmet, kadikoy)).toBeCloseTo(4.8, 0);
    expect(distanceKm(sultanahmet, sultanahmet)).toBe(0);
  });

  it("mesafeyi yaklaşık olduğunu söyleyerek yazar", () => {
    expect(formatDistanceKm(0.4)).toBe("1 km'den yakın");
    expect(formatDistanceKm(4.76)).toBe("yaklaşık 4,8 km");
    expect(formatDistanceKm(12.6)).toBe("yaklaşık 13 km");
  });
});
