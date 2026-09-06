import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AddressCandidate, AddressSuggestion } from "./contract";
import { AddressGatewayError, type AddressGateway } from "./gateway-client";
import { useAddressSearch } from "./use-address-search";

const suggestion: AddressSuggestion = {
  id: "9c1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f60",
  mainText: "Büyükdere Caddesi 12",
  secondaryText: "Levent, Beşiktaş",
};

const candidate = {
  countryId: "2f0a1e58-6a3c-4a3f-9a10-6a1c2d3e4f52",
  countryName: "Türkiye",
  countryCode: "TR",
  cityId: "6f0a1e58-6a3c-4a3f-9a10-6a1c2d3e4f50",
  cityName: "İstanbul",
  districtId: "1f0a1e58-6a3c-4a3f-9a10-6a1c2d3e4f51",
  districtName: "Beşiktaş",
  components: { neighborhood: "Levent", thoroughfare: "Büyükdere Caddesi", postalCode: "34330" },
  position: { latitude: 41.081235, longitude: 29.008765, source: "AUTOCOMPLETE_CONFIRMED" },
  candidateToken: "aday-token-yer-tutucu",
  needsUserReview: false,
  attribution: "Google Maps",
} satisfies AddressCandidate;

/**
 * Ağ geçidi çift. Oturumun kaç kez açıldığı bu dilimin asıl sorusu olduğu
 * için sayaçlar burada tutulur.
 */
function fakeGateway(overrides: Partial<AddressGateway> = {}) {
  let opened = 0;
  const gateway: AddressGateway & { openedSessions: () => number } = {
    startSession: vi.fn(async () => ({
      id: `session-${++opened}`,
      expiresAt: new Date(Date.now() + 300_000).toISOString(),
    })),
    suggestions: vi.fn(async () => [suggestion]),
    resolve: vi.fn(async () => candidate),
    reverse: vi.fn(async () => candidate),
    countries: vi.fn(async () => []),
    cities: vi.fn(async () => []),
    districts: vi.fn(async () => []),
    openedSessions: () => opened,
    ...overrides,
  };
  return gateway;
}

function sessionExpired() {
  return new AddressGatewayError("ADDRESS_SEARCHSESSION_INVALID", 400);
}

function providerDown() {
  return new AddressGatewayError("ADDRESS_SEARCHPROVIDER_UNAVAILABLE", 502);
}

async function typeQuery(
  result: { current: ReturnType<typeof useAddressSearch> },
  query: string,
) {
  act(() => result.current.search(query));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(400);
  });
}

describe("adres arama oturumu yaşam döngüsü", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("üç karakterin altında oturum açmaz ve sağlayıcıya sormaz", async () => {
    const gateway = fakeGateway();
    const { result } = renderHook(() => useAddressSearch({ gateway }));

    await typeQuery(result, "le");

    expect(gateway.startSession).not.toHaveBeenCalled();
    expect(gateway.suggestions).not.toHaveBeenCalled();
    expect(result.current.suggestions).toEqual([]);
    expect(result.current.status).toBe("idle");
  });

  it("art arda yazılan harfleri tek aramaya indirir", async () => {
    const gateway = fakeGateway();
    const { result } = renderHook(() => useAddressSearch({ gateway }));

    act(() => result.current.search("büy"));
    act(() => result.current.search("büyük"));
    act(() => result.current.search("büyükdere"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    expect(gateway.suggestions).toHaveBeenCalledTimes(1);
    expect(gateway.suggestions).toHaveBeenCalledWith("session-1", "büyükdere");
    expect(result.current.suggestions).toEqual([suggestion]);
    expect(result.current.status).toBe("ready");
  });

  it("açılmış oturumu sonraki aramalarda yeniden kullanır", async () => {
    const gateway = fakeGateway();
    const { result } = renderHook(() => useAddressSearch({ gateway }));

    await typeQuery(result, "levent");
    await typeQuery(result, "levent mahallesi");

    expect(gateway.openedSessions()).toBe(1);
    expect(gateway.suggestions).toHaveBeenCalledTimes(2);
  });

  it("süresi dolmuş oturumu sormadan yeniler", async () => {
    const gateway = fakeGateway({
      startSession: vi.fn(async () => ({
        id: "kisa-omurlu",
        expiresAt: new Date(Date.now() - 1_000).toISOString(),
      })),
    });
    const { result } = renderHook(() => useAddressSearch({ gateway }));

    await typeQuery(result, "levent");
    await typeQuery(result, "levent mahallesi");

    expect(gateway.startSession).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe("ready");
  });

  it("süresi dolmak üzere olan oturumu beklemeden yeniler", async () => {
    // Sorgu yolda iken dolan oturum backend'de 400 üretirdi; pay, o boşa
    // giden turu baştan kapatıyor.
    const gateway = fakeGateway({
      startSession: vi.fn(async () => ({
        id: "birazdan-dolacak",
        expiresAt: new Date(Date.now() + 1_000).toISOString(),
      })),
    });
    const { result } = renderHook(() => useAddressSearch({ gateway }));

    await typeQuery(result, "levent");
    await typeQuery(result, "levent mahallesi");

    expect(gateway.startSession).toHaveBeenCalledTimes(2);
  });

  it("backend oturumu geçersiz sayarsa kullanıcıya hata göstermeden yeniden açar", async () => {
    // Oturum tek kullanımlık ve sunucu tarafında da düşebiliyor; kullanıcının
    // yazdığı sorgu bu yüzden kaybolmamalı.
    const gateway = fakeGateway();
    gateway.suggestions = vi
      .fn<AddressGateway["suggestions"]>()
      .mockRejectedValueOnce(sessionExpired())
      .mockResolvedValue([suggestion]);
    const { result } = renderHook(() => useAddressSearch({ gateway }));

    await typeQuery(result, "büyükdere");

    expect(gateway.openedSessions()).toBe(2);
    expect(gateway.suggestions).toHaveBeenLastCalledWith("session-2", "büyükdere");
    expect(result.current.status).toBe("ready");
    expect(result.current.errorCode).toBeNull();
  });

  it("ikinci kez de geçersizse döngüye girmez ve durumu bildirir", async () => {
    const gateway = fakeGateway();
    gateway.suggestions = vi.fn<AddressGateway["suggestions"]>().mockRejectedValue(sessionExpired());
    const { result } = renderHook(() => useAddressSearch({ gateway }));

    await typeQuery(result, "büyükdere");

    expect(gateway.suggestions).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe("error");
    expect(result.current.errorCode).toBe("ADDRESS_SEARCHSESSION_INVALID");
  });

  it("aday çözümlendiğinde oturumu tüketilmiş sayar", async () => {
    // `AddressSearchManager.resolve` oturumu tamamlanmış işaretleyip siliyor;
    // aynı kimlikle yapılacak sonraki arama 400 alırdı.
    const resolved = vi.fn();
    const gateway = fakeGateway();
    const { result } = renderHook(() =>
      useAddressSearch({ gateway, onCandidateResolved: resolved }),
    );

    await typeQuery(result, "büyükdere");
    await act(async () => {
      await result.current.select(suggestion);
    });

    expect(gateway.resolve).toHaveBeenCalledWith("session-1", suggestion.id);
    expect(resolved).toHaveBeenCalledWith(candidate);
    expect(result.current.suggestions).toEqual([]);

    await typeQuery(result, "levent");
    expect(gateway.openedSessions()).toBe(2);
  });

  it("sağlayıcı düştüğünde formu kilitlemez, elle devam edilebileceğini söyler", async () => {
    const gateway = fakeGateway();
    gateway.suggestions = vi.fn<AddressGateway["suggestions"]>().mockRejectedValue(providerDown());
    const { result } = renderHook(() => useAddressSearch({ gateway }));

    await typeQuery(result, "büyükdere");

    expect(result.current.status).toBe("error");
    expect(result.current.errorCode).toBe("ADDRESS_SEARCHPROVIDER_UNAVAILABLE");
    expect(result.current.providerAvailable).toBe(false);
    // Sağlayıcı hatası oturum hatası değil: yeniden açıp aynı duvara toslamaz.
    expect(gateway.suggestions).toHaveBeenCalledTimes(1);
  });

  it("sağlayıcı geri geldiğinde yeniden denemeye izin verir", async () => {
    const gateway = fakeGateway();
    gateway.suggestions = vi
      .fn<AddressGateway["suggestions"]>()
      .mockRejectedValueOnce(providerDown())
      .mockResolvedValue([suggestion]);
    const { result } = renderHook(() => useAddressSearch({ gateway }));

    await typeQuery(result, "büyükdere");
    act(() => result.current.retry());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    expect(result.current.providerAvailable).toBe(true);
    expect(result.current.suggestions).toEqual([suggestion]);
  });

  it("geç dönen eski yanıtı yeni sorgunun üzerine yazmaz", async () => {
    const stale: AddressSuggestion = { ...suggestion, id: "eski", mainText: "Eski sonuç" };
    const gateway = fakeGateway();
    gateway.suggestions = vi.fn<AddressGateway["suggestions"]>(
      async (_sessionId, query) =>
        new Promise((resolve) => setTimeout(() => resolve(query === "eski" ? [stale] : [suggestion]), query === "eski" ? 500 : 10)),
    );
    const { result } = renderHook(() => useAddressSearch({ gateway }));

    act(() => result.current.search("eski"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    act(() => result.current.search("büyükdere"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });

    expect(result.current.suggestions).toEqual([suggestion]);
    expect(result.current.status).toBe("ready");
  });

  it("sonuç dönmeyen aramayı boş durumla ayırır", async () => {
    const gateway = fakeGateway({ suggestions: vi.fn(async () => []) });
    const { result } = renderHook(() => useAddressSearch({ gateway }));

    await typeQuery(result, "burada-yok");

    expect(result.current.status).toBe("empty");
  });
});
