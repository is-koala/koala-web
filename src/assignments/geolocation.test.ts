import { describe, expect, it, vi } from "vitest";

import { captureCheckpointLocation, type GeolocationAccess } from "./geolocation";

describe("tek seferlik puantaj konumu", () => {
  it("güvenli bağlamda bir kez konum ister ve yalnız koordinatı döndürür", async () => {
    const getCurrentPosition = vi.fn<NonNullable<GeolocationAccess["getCurrentPosition"]>>(
      (success) => success({ coords: { latitude: 40.98, longitude: 29.02 } }),
    );

    await expect(captureCheckpointLocation({ secure: true, getCurrentPosition })).resolves.toEqual({
      status: "located",
      point: { latitude: 40.98, longitude: 29.02 },
    });
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(getCurrentPosition.mock.calls[0][2]).toEqual({
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 10_000,
    });
  });

  it("izin reddinde konumsuz devam sonucunu üretir", async () => {
    const getCurrentPosition = vi.fn<NonNullable<GeolocationAccess["getCurrentPosition"]>>(
      (_success, failure) => failure?.({ code: 1 }),
    );

    await expect(captureCheckpointLocation({ secure: true, getCurrentPosition })).resolves.toEqual({
      status: "unavailable",
      reason: "denied",
      point: null,
    });
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
  });

  it("güvensiz bağlamda geolocation çağırmadan konumsuz devam eder", async () => {
    const getCurrentPosition = vi.fn<NonNullable<GeolocationAccess["getCurrentPosition"]>>();

    await expect(captureCheckpointLocation({ secure: false, getCurrentPosition })).resolves.toEqual({
      status: "unavailable",
      reason: "insecure",
      point: null,
    });
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it("tarayıcı konum özelliği yoksa akışı bozmaz", async () => {
    await expect(captureCheckpointLocation({ secure: true, getCurrentPosition: null })).resolves.toEqual({
      status: "unavailable",
      reason: "unsupported",
      point: null,
    });
  });
});
