import { describe, expect, it } from "vitest";

import {
  clampToServiceArea,
  formatCoordinate,
  istanbulServiceArea,
} from "./contract";

describe("harita kamerası", () => {
  it("hizmet alanı dışındaki noktayı dikdörtgenin kenarına çeker", () => {
    expect(clampToServiceArea({ latitude: 39.9, longitude: 32.8 })).toEqual({
      latitude: istanbulServiceArea.south,
      longitude: istanbulServiceArea.east,
    });
  });

  it("kamerayı altı ondalığa sabitler", () => {
    expect(clampToServiceArea({ latitude: 41.0082384, longitude: 28.9783594 })).toEqual({
      latitude: 41.008238,
      longitude: 28.978359,
    });
  });

  it("ekrandaki koordinat gönderilen sayının altı ondalığıdır", () => {
    expect(formatCoordinate(41.0082384)).toBe("41.008238");
    expect(formatCoordinate(28.9783594)).toBe("28.978359");
  });
});
