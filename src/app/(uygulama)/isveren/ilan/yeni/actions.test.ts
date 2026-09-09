import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { idleFormState } from "@/lib/form-state";

import {
  cookieStore,
  envelope,
  jsonResponse,
  requestHeaders,
} from "../../../../../../tests/support/session-cookies";
import { redirectTo } from "../../../../../../tests/support/navigation";

import { publishIndividualJobAction, quotePriceAction } from "./actions";

const viewerGatesMock = vi.hoisted(() => vi.fn());

vi.mock("@/server/session/gates", () => ({ currentGates: viewerGatesMock }));
vi.mock("next/navigation", async () => {
  const navigation = await import("../../../../../../tests/support/navigation");
  return {
    redirect: navigation.throwingRedirect(),
    unstable_rethrow: navigation.rethrowTestNavigationError,
  };
});
vi.mock("next/headers", async () => {
  const support = await import("../../../../../../tests/support/session-cookies");
  return {
    cookies: () => Promise.resolve(support.cookieStore),
    headers: () => Promise.resolve(support.requestHeaders),
  };
});

const deviceId = "b7b1f0d24c2f4f6c8a9e5d3c1b0a7f6e";
const categoryId = "9f0a1e58-6a3c-4a3f-9a10-6a1c2d3e4f01";
const insuredCategoryId = "9f0a1e58-6a3c-4a3f-9a10-6a1c2d3e4f02";
const jobId = "4d0a1e58-6a3c-4a3f-9a10-6a1c2d3e4f99";

const address = {
  countryId: "2f0a1e58-6a3c-4a3f-9a10-6a1c2d3e4f52",
  cityId: "6f0a1e58-6a3c-4a3f-9a10-6a1c2d3e4f50",
  districtId: "1f0a1e58-6a3c-4a3f-9a10-6a1c2d3e4f51",
  components: {
    neighborhood: "Levent",
    thoroughfare: "Büyükdere Caddesi",
    buildingNumber: "12",
    postalCode: "34330",
  },
  position: { latitude: 41.081235, longitude: 29.008765, source: "AUTOCOMPLETE_CONFIRMED" },
  candidateToken: "aday-token-yer-tutucu",
};

const categories = [
  { id: categoryId, name: "Garson", code: "WAITER", requiresInsurance: false },
  { id: insuredCategoryId, name: "Kurye", code: "COURIER", requiresInsurance: true },
];

function submission(overrides: Record<string, string> = {}) {
  const fields: Record<string, string> = {
    categoryId,
    title: "Hafta sonu garson",
    description: "İki günlük etkinlikte servis desteği.",
    position: "Garson",
    sector: "",
    duties: "",
    dressCode: "",
    type: "ONE_TIME",
    salaryType: "DAILY",
    salary: "1500.50",
    startDateTime: "2026-10-10T09:00",
    endDateTime: "2026-10-11T18:00",
    minAge: "18",
    maxAge: "45",
    experienceRequired: "false",
    headcount: "",
    address: JSON.stringify(address),
    ...overrides,
  };

  const formData = new FormData();
  for (const [name, value] of Object.entries(fields)) formData.set(name, value);
  return formData;
}

/** Kategori kataloğu ve ilan gönderimi tek akışta sırayla çağrılıyor. */
function backend(jobResponse: Response) {
  const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
    async (input) => {
    const url = String(input);
    if (url.includes("/reference/job-categories")) {
      return jsonResponse(200, envelope(categories));
    }
    return jobResponse;
  },
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function bodyOf(fetchMock: ReturnType<typeof backend>, path: string) {
  const call = fetchMock.mock.calls.find(([input]) => String(input).includes(path));
  const body = call?.[1]?.body;
  return body ? (JSON.parse(String(body)) as Record<string, unknown>) : null;
}

describe("bireysel ilan yayımlama action'ı", () => {
  beforeEach(() => {
    vi.stubEnv("API_URL", "https://api.example.test");
    vi.stubEnv("APP_VERSION", "1.4.0");
    requestHeaders.set("x-koala-path", "/isveren/ilan/yeni");
    cookieStore.values.clear();
    cookieStore.values.set("koala_did", deviceId);
    cookieStore.values.set("koala_at", "access-placeholder");
    cookieStore.values.set("koala_rt", "refresh-placeholder");
    viewerGatesMock.mockReset();
    viewerGatesMock.mockResolvedValue({
      viewer: { isEmployer: true, identityVerified: true },
      failure: null,
      gates: { individualJob: { open: true } },
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("gövdeyi CreateIndividualJobDto alanlarına çevirir ve adresi olduğu gibi taşır", async () => {
    const fetchMock = backend(jsonResponse(201, envelope({ id: jobId })));

    await publishIndividualJobAction(idleFormState, submission()).catch(() => {});

    expect(bodyOf(fetchMock, "/users/me/jobs")).toEqual({
      categoryId,
      title: "Hafta sonu garson",
      description: "İki günlük etkinlikte servis desteği.",
      position: "Garson",
      address,
      type: "ONE_TIME",
      salaryType: "DAILY",
      salary: "1500.50",
      startDateTime: "2026-10-10T09:00",
      endDateTime: "2026-10-11T18:00",
      minAge: 18,
      maxAge: 45,
      experienceRequired: false,
    });
  });

  it("yayımlandıktan sonra yeni ilanın sayfasına yönlendirir", async () => {
    backend(jsonResponse(201, envelope({ id: jobId })));

    await expect(publishIndividualJobAction(idleFormState, submission())).rejects.toThrowError(
      new Error(redirectTo(`/isveren/ilan/${jobId}`)),
    );
  });

  it("bitiş tarihi başlangıçtan önceyse isteği hiç göndermez", async () => {
    // Backend bu kuralı uygulamıyor; istemci geçirirse ilan bozuk kaydedilir.
    const fetchMock = backend(jsonResponse(201, envelope({ id: jobId })));

    const state = await publishIndividualJobAction(
      idleFormState,
      submission({ endDateTime: "2026-10-09T09:00" }),
    );

    expect(state).toMatchObject({ status: "error", errorCode: "VALIDATION_FAILED" });
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes("/users/me/jobs"))).toBe(
      false,
    );
  });

  it("sigorta zorunlu kategoriyi sunucuya hiç götürmez", async () => {
    const fetchMock = backend(jsonResponse(201, envelope({ id: jobId })));

    const state = await publishIndividualJobAction(
      idleFormState,
      submission({ categoryId: insuredCategoryId }),
    );

    expect(state).toMatchObject({ status: "error" });
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes("/users/me/jobs"))).toBe(
      false,
    );
  });

  it("kimlik kapısı kapalıyken isteği hiç göndermez", async () => {
    // Devre dışı bir düğme yine de gönderilebilir; kapı sunucuda da durur.
    viewerGatesMock.mockResolvedValue({
      viewer: { isEmployer: true, identityVerified: false },
      failure: null,
      gates: { individualJob: { open: false, blockedBy: ["identityVerification"] } },
    });
    const fetchMock = backend(jsonResponse(201, envelope({ id: jobId })));

    const state = await publishIndividualJobAction(idleFormState, submission());

    expect(state).toEqual({
      status: "error",
      errorCode: "JOB_INDIVIDUAL_EMPLOYER_IDENTITY_NOT_VERIFIED",
      httpStatus: 400,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sunucunun `ageRangeOrdered` mesajını maxAge alanının altına taşır", async () => {
    backend(
      jsonResponse(400, {
        success: false,
        errorCode: "VALIDATION_FAILED",
        details: [{ field: "ageRangeOrdered", message: "En büyük yaş küçük olamaz." }],
      }),
    );

    await expect(publishIndividualJobAction(idleFormState, submission())).resolves.toEqual({
      status: "error",
      errorCode: "VALIDATION_FAILED",
      httpStatus: 400,
      fieldErrors: { maxAge: "En büyük yaş küçük olamaz." },
    });
  });
});

describe("fiyat önizleme action'ı", () => {
  beforeEach(() => {
    vi.stubEnv("API_URL", "https://api.example.test");
    vi.stubEnv("APP_VERSION", "1.4.0");
    requestHeaders.set("x-koala-path", "/isveren/ilan/yeni");
    cookieStore.values.clear();
    cookieStore.values.set("koala_did", deviceId);
    cookieStore.values.set("koala_at", "access-placeholder");
    cookieStore.values.set("koala_rt", "refresh-placeholder");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("çalışan ücretini olduğu gibi sorar ve dökümü hesaplamadan geri verir", async () => {
    const breakdown = {
      pricingVersion: "2026-09-v1",
      currency: "TRY",
      workerPayout: "1500.50",
      serviceFeeRate: "0.075",
      serviceFeeAmount: "112.54",
      employerTotal: "1613.04",
    };
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => jsonResponse(200, envelope(breakdown)),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(quotePriceAction("1500.50")).resolves.toEqual({
      status: "ready",
      breakdown,
    });
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      workerPayout: "1500.50",
    });
  });

  it("geçersiz ücreti sunucuya hiç götürmez", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, envelope({})));
    vi.stubGlobal("fetch", fetchMock);

    await expect(quotePriceAction("0")).resolves.toMatchObject({ status: "error" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("backend reddini ham mesaj taşımadan koda çevirir", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(400, { success: false, errorCode: "JOB_SALARY_MIN_VALUE", message: "ham" }),
      ),
    );

    await expect(quotePriceAction("1500")).resolves.toEqual({
      status: "error",
      errorCode: "JOB_SALARY_MIN_VALUE",
      httpStatus: 400,
    });
  });
});
