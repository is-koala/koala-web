import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AddressWrite } from "@/address/contract";
import {
  cookieStore,
  envelope,
  jsonResponse,
  requestHeaders,
} from "../../../../../tests/support/session-cookies";

import { saveApplicantAddressAction, type ApplicantAddressState } from "./actions";

vi.mock("next/navigation", async () => ({
  unstable_rethrow: (await import("../../../../../tests/support/navigation"))
    .rethrowTestNavigationError,
}));
vi.mock("next/headers", async () => {
  const support = await import("../../../../../tests/support/session-cookies");
  return {
    cookies: () => Promise.resolve(support.cookieStore),
    headers: () => Promise.resolve(support.requestHeaders),
  };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const deviceId = "b7b1f0d24c2f4f6c8a9e5d3c1b0a7f6e";

const addressWrite: AddressWrite = {
  countryId: "2f0a1e58-6a3c-4a3f-9a10-6a1c2d3e4f52",
  cityId: "6f0a1e58-6a3c-4a3f-9a10-6a1c2d3e4f50",
  districtId: "1f0a1e58-6a3c-4a3f-9a10-6a1c2d3e4f51",
  components: {
    neighborhood: "Levent",
    thoroughfare: "Büyükdere Caddesi",
    buildingNumber: "12",
    postalCode: "34330",
  },
  position: { latitude: 41.081235, longitude: 29.008765, source: "USER_CONFIRMED_PIN" },
};

const saved = {
  countryName: "Türkiye",
  cityName: "İstanbul",
  districtName: "Beşiktaş",
  components: addressWrite.components,
  displayAddress: "Büyükdere Caddesi No: 12, Levent / Beşiktaş",
  needsReview: false,
  position: { latitude: 41.081235, longitude: 29.008765, source: "USER_CONFIRMED_PIN" },
};

const idle: ApplicantAddressState = { status: "idle" };

function formWith(value: unknown) {
  const formData = new FormData();
  if (value !== "") formData.set("address", JSON.stringify(value));
  else formData.set("address", "");
  return formData;
}

describe("iş arayan adres kaydı", () => {
  beforeEach(() => {
    vi.stubEnv("API_URL", "https://api.example.test");
    vi.stubEnv("APP_VERSION", "1.4.0");
    requestHeaders.set("x-koala-path", "/panel/adres");
    cookieStore.values.clear();
    cookieStore.values.set("koala_did", deviceId);
    cookieStore.values.set("koala_at", "access-placeholder");
    cookieStore.values.set("koala_rt", "refresh-placeholder");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("pin yolunda token göndermez ve kaydedilen adresi döndürür", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, envelope(saved)));
    vi.stubGlobal("fetch", fetchMock);

    const state = await saveApplicantAddressAction(idle, formWith(addressWrite));

    expect(state).toMatchObject({
      status: "done",
      address: {
        displayAddress: saved.displayAddress,
        position: { latitude: 41.081235, longitude: 29.008765 },
      },
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.example.test/users/me/address");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(String(init.body))).toEqual(addressWrite);
    expect(JSON.parse(String(init.body))).not.toHaveProperty("candidateToken");
  });

  it("aday yolunda tokenı ve koordinatı bozmadan taşır", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, envelope(saved)));
    vi.stubGlobal("fetch", fetchMock);
    const withProof = {
      ...addressWrite,
      position: { ...addressWrite.position, source: "REVERSE_GEOCODE_CONFIRMED" as const },
      candidateToken: "ters-kanit",
    };

    await saveApplicantAddressAction(idle, formWith(withProof));

    expect(JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body))).toEqual(
      withProof,
    );
  });

  it("sözleşme dışı alanı backend'e hiç ulaştırmaz", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, envelope(saved)));
    vi.stubGlobal("fetch", fetchMock);

    await saveApplicantAddressAction(
      idle,
      formWith({ ...addressWrite, isVerified: true, extra: "hayır" }),
    );

    expect(JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body))).toEqual(
      addressWrite,
    );
  });

  it("hizmet alanı dışındaki koordinatı göndermez", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const state = await saveApplicantAddressAction(
      idle,
      formWith({
        ...addressWrite,
        position: { latitude: 39.92, longitude: 32.85, source: "USER_CONFIRMED_PIN" },
      }),
    );

    expect(state).toMatchObject({ status: "error", httpStatus: 400 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("eksik adresi backend'e çıkarmadan reddeder", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const state = await saveApplicantAddressAction(idle, formWith(""));

    expect(state).toMatchObject({ status: "error", httpStatus: 400 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
