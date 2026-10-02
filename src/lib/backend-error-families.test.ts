import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.doUnmock("./backend-error-codes");
  vi.resetModules();
});

describe("aile haritasının tembel yüklenmesi", () => {
  it("haritayı bir kez getirir ve yüklenince React'in bekletmeden okuyacağı biçimde işaretler", async () => {
    const { loadBackendErrorFamilies } = await import("./backend-error-families");

    const first = loadBackendErrorFamilies();
    expect(loadBackendErrorFamilies()).toBe(first);

    const families = await first;
    // `use()` durumu `fulfilled` olan söz için askıya girmiyor: sunucu
    // çizimi ve ikinci hata kartı aynı anda, boş bir an olmadan çizilir.
    expect(first).toMatchObject({ status: "fulfilled", value: families });
    expect(families.VALIDATION_FAILED).toBe("validation");
  });

  it("parça inmezse kartı düşürmez, durum koduna bırakır ve sonraki çağrıda yeniden dener", async () => {
    vi.doMock("./backend-error-codes", () => {
      throw new Error("ChunkLoadError");
    });
    const { loadBackendErrorFamilies } = await import("./backend-error-families");

    await expect(loadBackendErrorFamilies()).resolves.toEqual({});

    vi.doUnmock("./backend-error-codes");
    await expect(loadBackendErrorFamilies()).resolves.toMatchObject({
      VALIDATION_FAILED: "validation",
    });
  });
});
