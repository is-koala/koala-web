import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AddressWrite } from "@/address/contract";
import {
  cookieStore,
  envelope,
  jsonResponse,
  requestHeaders,
} from "../../../../../../../tests/support/session-cookies";

import { idleAddressFormState } from "@/lib/form-state";

import { saveCompanyAddressAction } from "./actions";

const revalidatePath = vi.hoisted(() => vi.fn());

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", async () => ({
  unstable_rethrow: (await import("../../../../../../../tests/support/navigation"))
    .rethrowTestNavigationError,
}));
vi.mock("next/headers", async () => {
  const support = await import("../../../../../../../tests/support/session-cookies");
  return {
    cookies: () => Promise.resolve(support.cookieStore),
    headers: () => Promise.resolve(support.requestHeaders),
  };
});

const deviceId = "b7b1f0d24c2f4f6c8a9e5d3c1b0a7f6e";
const companyId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

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

const savedAddress = {
  countryName: "Türkiye",
  cityName: "İstanbul",
  districtName: "Beşiktaş",
  components: addressWrite.components,
  displayAddress: "Büyükdere Caddesi No: 12, Levent / Beşiktaş",
  needsReview: false,
  position: { latitude: 41.081235, longitude: 29.008765, source: "USER_CONFIRMED_PIN" },
};

function formWith(value: unknown) {
  const formData = new FormData();
  formData.set("address", value === "" ? "" : JSON.stringify(value));
  return formData;
}

describe("şirket adresi kaydı", () => {
  beforeEach(() => {
    vi.stubEnv("API_URL", "https://api.example.test");
    vi.stubEnv("APP_VERSION", "1.4.0");
    requestHeaders.set("x-koala-path", `/isveren/sirket/${companyId}/adres`);
    cookieStore.values.clear();
    cookieStore.values.set("koala_did", deviceId);
    cookieStore.values.set("koala_at", "access-placeholder");
    cookieStore.values.set("koala_rt", "refresh-placeholder");
    revalidatePath.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("adresi tek başına PATCH ile gönderir, yanıttaki adresi döndürür ve üç ekranı tazeler", async () => {
    const fetchMock = successfulFetch({ id: companyId, address: savedAddress });

    const state = await saveCompanyAddressAction(
      companyId,
      idleAddressFormState,
      formWith(addressWrite),
    );

    expect(state).toMatchObject({
      status: "done",
      address: { displayAddress: savedAddress.displayAddress, districtName: "Beşiktaş" },
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://api.example.test/companies/${companyId}`);
    expect(init.method).toBe("PATCH");
    // Beş metin alanı gövdede yok: backend yalnız gönderileni uyguluyor ve
    // boş dize göndermek şirket adını silerdi.
    expect(JSON.parse(String(init.body))).toEqual({ address: addressWrite });
    expect(revalidatePath.mock.calls.map(([path]) => path)).toEqual([
      `/isveren/sirket/${companyId}/adres`,
      `/isveren/sirket/${companyId}`,
      `/isveren/sirket/${companyId}/duzenle`,
    ]);
  });

  it("adres taşımayan yanıtı kayıt saymaz", async () => {
    // Sözleşme `CompanyDto.address`'i her zaman döndürüyor; boş gelirse onay
    // kartına boş adres çizmek yerine arıza gösterilir ve ekranlar tazelenmez.
    successfulFetch({ id: companyId, address: null });

    const state = await saveCompanyAddressAction(
      companyId,
      idleAddressFormState,
      formWith(addressWrite),
    );

    expect(state).toMatchObject({ status: "error", httpStatus: 500 });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("backend alan hatası dönerse sayfayı kırmadan alanın altına yazar", async () => {
    failingFetch(400, "VALIDATION_FAILED", [
      { field: "address", message: "Bilinmeyen alan: address" },
    ]);

    const state = await saveCompanyAddressAction(
      companyId,
      idleAddressFormState,
      formWith(addressWrite),
    );

    expect(state).toEqual({
      status: "error",
      errorCode: "VALIDATION_FAILED",
      httpStatus: 400,
      fieldErrors: { address: "Bilinmeyen alan: address" },
    });
  });

  it("iç içe adres alanının hatasını formun düz alan adına kırpar", async () => {
    // `details[]` yolu `address.components.postalCode`; form alanı `postalCode`.
    failingFetch(400, "VALIDATION_FAILED", [
      { field: "address.components.postalCode", message: "Posta kodu 5 haneli olmalı." },
      { field: "address.position.latitude", message: "Hizmet alanı dışında." },
    ]);

    const state = await saveCompanyAddressAction(
      companyId,
      idleAddressFormState,
      formWith(addressWrite),
    );

    expect(state).toMatchObject({
      status: "error",
      fieldErrors: {
        postalCode: "Posta kodu 5 haneli olmalı.",
        position: "Hizmet alanı dışında.",
      },
    });
  });

  it("yönetici olmayanın 404'ünü olduğu gibi taşır", async () => {
    // `requireCompanyAdmin` geçemeyene `USER_NOT_ASSOCIATED_WITH_COMPANY`
    // ile 404 dönüyor; üye olmayan ile CONTACT ayırt edilmiyor ve web bunu
    // ayırmaya çalışmıyor.
    failingFetch(404, "USER_NOT_ASSOCIATED_WITH_COMPANY");

    const state = await saveCompanyAddressAction(
      companyId,
      idleAddressFormState,
      formWith(addressWrite),
    );

    expect(state).toMatchObject({
      status: "error",
      errorCode: "USER_NOT_ASSOCIATED_WITH_COMPANY",
      httpStatus: 404,
    });
  });

  it("onaylanmamış adresi backend'e çıkarmadan reddeder", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const state = await saveCompanyAddressAction(companyId, idleAddressFormState, formWith(""));

    expect(state).toMatchObject({
      status: "error",
      httpStatus: 400,
      fieldErrors: { address: "Adresi onaylaman gerekiyor." },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("biçimi bozuk şirket kimliğini backend'e çıkarmadan reddeder", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const state = await saveCompanyAddressAction(
      "../hesap",
      idleAddressFormState,
      formWith(addressWrite),
    );

    expect(state).toMatchObject({ status: "error", httpStatus: 400 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

function successfulFetch(data: unknown) {
  const fetchMock = vi.fn().mockImplementation(() =>
    Promise.resolve(jsonResponse(200, envelope(data))),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function failingFetch(
  status: number,
  errorCode: string,
  details: readonly { field: string; message: string }[] = [],
) {
  const fetchMock = vi.fn().mockImplementation(() =>
    Promise.resolve(
      jsonResponse(status, { success: false, errorCode, message: "ham metin", details }),
    ),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
