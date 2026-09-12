import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/server/api/errors";

import { sessionExpiryRedirect } from "../../../tests/support/control-flow";

import { loadJobCategories } from "./submission";

const fetchJobCategories = vi.hoisted(() => vi.fn());

vi.mock("./jobs", () => ({ fetchJobCategories }));

describe("ilan gönderiminin kategori kataloğu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("katalog okunurken biten oturumun yönlendirmesini yutmaz", async () => {
    // `null` "katalog okunamadı" demek; giriş yönlendirmesi bir okuma hatası
    // değil ve `null`a düşerse action oturumsuz bir yayım denemesine geçerdi.
    const interrupt = sessionExpiryRedirect("/giris?next=%2Fisveren%2Filan%2Fyeni");
    fetchJobCategories.mockRejectedValue(interrupt);

    await expect(loadJobCategories()).rejects.toBe(interrupt);
  });

  it("backend arızasında son sözü backend'e bırakmak için null döner", async () => {
    fetchJobCategories.mockRejectedValue(
      new ApiError({
        status: 503,
        errorCode: "EXTERNAL_SERVICE",
        errorCategory: "EXTERNAL_SERVICE",
        message: "ham mesaj",
      }),
    );

    await expect(loadJobCategories()).resolves.toBeNull();
  });
});
