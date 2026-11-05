import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { idleFormState } from "@/lib/form-state";

import {
  cookieStore,
  envelope,
  jsonResponse,
  requestHeaders,
} from "../../../../../../../../tests/support/session-cookies";
import { redirectTo } from "../../../../../../../../tests/support/navigation";

import { publishCompanyJobAction } from "./actions";

const currentGates = vi.hoisted(() => vi.fn());

vi.mock("@/server/session/gates", async () => {
  const real = await vi.importActual<typeof import("@/server/session/gates")>(
    "@/server/session/gates",
  );
  return { ...real, currentGates };
});
vi.mock("next/navigation", async () => {
  const navigation = await import("../../../../../../../../tests/support/navigation");
  return {
    redirect: navigation.throwingRedirect(),
    unstable_rethrow: navigation.rethrowTestNavigationError,
  };
});
vi.mock("next/headers", async () => {
  const support = await import("../../../../../../../../tests/support/session-cookies");
  return {
    cookies: () => Promise.resolve(support.cookieStore),
    headers: () => Promise.resolve(support.requestHeaders),
  };
});

const deviceId = "b7b1f0d24c2f4f6c8a9e5d3c1b0a7f6e";
const companyId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const otherCompanyId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
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
  { id: insuredCategoryId, name: "Motorlu kurye", code: "COURIER", requiresInsurance: true },
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
    insurancePreference: "",
    address: JSON.stringify(address),
    ...overrides,
  };

  const formData = new FormData();
  for (const [name, value] of Object.entries(fields)) formData.set(name, value);
  return formData;
}

function backend(jobResponse: Response) {
  const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
    async (input) => {
      if (String(input).includes("/reference/job-categories")) {
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

function posted(fetchMock: ReturnType<typeof backend>): boolean {
  return fetchMock.mock.calls.some(([input]) => String(input).includes(`/companies/`));
}

describe("şirket ilanı yayımlama action'ı", () => {
  beforeEach(() => {
    vi.stubEnv("API_URL", "https://api.example.test");
    vi.stubEnv("APP_VERSION", "1.4.0");
    requestHeaders.set("x-koala-path", `/isveren/sirket/${companyId}/ilan/yeni`);
    cookieStore.values.clear();
    cookieStore.values.set("koala_did", deviceId);
    cookieStore.values.set("koala_at", "access-placeholder");
    cookieStore.values.set("koala_rt", "refresh-placeholder");
    currentGates.mockReset();
    currentGates.mockResolvedValue({
      viewer: { companies: [{ companyId, companyName: "Koala Etkinlik", role: "ADMIN", approved: true }] },
      failure: null,
      gates: {
        companies: [
          {
            companyId,
            companyName: "Koala Etkinlik",
            role: "ADMIN",
            approved: true,
            corporateJob: { open: true },
          },
        ],
      },
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("gövdeyi şirketin kendi ucuna gönderir ve sigorta alanını taşır", async () => {
    const fetchMock = backend(jsonResponse(201, envelope({ id: jobId })));

    await publishCompanyJobAction(companyId, idleFormState, submission()).catch(() => {});

    expect(bodyOf(fetchMock, `/companies/${companyId}/jobs`)).toEqual({
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
      insuranceRequired: false,
      addressPublic: true,
    });
  });

  it("'adresi gizle' işaretlenmemişse adresi herkese açık gönderir", async () => {
    // İşaretsiz kutu gönderime hiç girmiyor; formdan alan gelmemesi
    // "açık" demek (kural: şirket ilanında tam konum varsayılan açık).
    const fetchMock = backend(jsonResponse(201, envelope({ id: jobId })));
    const formData = submission();
    formData.delete("hideAddress");

    await publishCompanyJobAction(companyId, idleFormState, formData).catch(() => {});

    expect(bodyOf(fetchMock, `/companies/${companyId}/jobs`)).toHaveProperty("addressPublic", true);
  });

  it("'adresi gizle' işaretliyse `addressPublic=false` gönderir", async () => {
    const fetchMock = backend(jsonResponse(201, envelope({ id: jobId })));

    await publishCompanyJobAction(companyId, idleFormState, submission({ hideAddress: "true" })).catch(
      () => {},
    );

    expect(bodyOf(fetchMock, `/companies/${companyId}/jobs`)).toHaveProperty("addressPublic", false);
  });

  it("sigorta zorunlu kategoride, gövdeye sigorta kapalı gelse de açık gönderir", async () => {
    // Sunucu bu ilanı `insuranceRequired=false` ile 400'e düşürüyor
    // (`JobManager.java:201-204`). Devre dışı bir anahtarın arkasındaki form
    // yine de gönderilebilir; kural burada da okunuyor.
    const fetchMock = backend(jsonResponse(201, envelope({ id: jobId })));

    await publishCompanyJobAction(
      companyId,
      idleFormState,
      submission({ categoryId: insuredCategoryId, insurancePreference: "false" }),
    ).catch(() => {});

    expect(bodyOf(fetchMock, `/companies/${companyId}/jobs`)).toMatchObject({
      categoryId: insuredCategoryId,
      insuranceRequired: true,
    });
  });

  it("işverenin kendi sigorta tercihini zorunlu olmayan kategoride taşır", async () => {
    const fetchMock = backend(jsonResponse(201, envelope({ id: jobId })));

    await publishCompanyJobAction(
      companyId,
      idleFormState,
      submission({ insurancePreference: "true" }),
    ).catch(() => {});

    expect(bodyOf(fetchMock, `/companies/${companyId}/jobs`)).toMatchObject({
      insuranceRequired: true,
    });
  });

  it("yayımlandıktan sonra yeni ilanın sayfasına yönlendirir", async () => {
    backend(jsonResponse(201, envelope({ id: jobId })));

    await expect(
      publishCompanyJobAction(companyId, idleFormState, submission()),
    ).rejects.toThrowError(new Error(redirectTo(`/isveren/ilan/${jobId}`)));
  });

  it("ulaşım adımı doluysa ilan yaratıldıktan sonra planı ilanın ucuna yazar; boş plan hiç gitmez", async () => {
    // Bireysel sihirbazla aynı son adım (`finishJobPublish`); şirket ilanı da
    // planı ancak ilan kimliği doğduktan sonra yazabiliyor.
    const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      void _init;
      const url = String(input);
      if (url.includes("/reference/job-categories")) return jsonResponse(200, envelope(categories));
      if (url.endsWith("/transport-plan")) {
        return jsonResponse(200, envelope({ outboundMethod: "NONE", returnMethod: "CASH_ALLOWANCE", shuttles: [] }));
      }
      return jsonResponse(201, envelope({ id: jobId }));
    });
    vi.stubGlobal("fetch", fetchMock);
    const plan = { outboundMethod: "NONE", returnMethod: "CASH_ALLOWANCE", allowanceAmount: "150", allowanceNote: "", notes: "", shuttles: [] };

    await expect(
      publishCompanyJobAction(companyId, idleFormState, submission({ transportPlan: JSON.stringify(plan) })),
    ).rejects.toThrowError(new Error(redirectTo(`/isveren/ilan/${jobId}`)));

    const call = fetchMock.mock.calls.find(([input]) => String(input).endsWith("/transport-plan"));
    expect(String(call?.[0])).toBe(`https://api.example.test/jobs/${jobId}/transport-plan`);
    expect(call?.[1]).toMatchObject({ method: "PUT" });
    expect(JSON.parse(String(call?.[1]?.body))).toMatchObject({ returnMethod: "CASH_ALLOWANCE", allowanceAmount: "150" });

    fetchMock.mockClear();
    const empty = { ...plan, returnMethod: "NONE", allowanceAmount: "" };
    await expect(
      publishCompanyJobAction(companyId, idleFormState, submission({ transportPlan: JSON.stringify(empty) })),
    ).rejects.toThrowError(new Error(redirectTo(`/isveren/ilan/${jobId}`)));
    expect(fetchMock.mock.calls.some(([input]) => String(input).endsWith("/transport-plan"))).toBe(false);
  });

  it("ulaşım planı eksikse ilanı hiç yaratmaz ve hatayı `transport.` önekiyle verir", async () => {
    const fetchMock = backend(jsonResponse(201, envelope({ id: jobId })));
    const plan = { outboundMethod: "NONE", returnMethod: "CASH_ALLOWANCE", allowanceAmount: "", allowanceNote: "", notes: "", shuttles: [] };

    await expect(
      publishCompanyJobAction(companyId, idleFormState, submission({ transportPlan: JSON.stringify(plan) })),
    ).resolves.toEqual({
      status: "error",
      errorCode: "VALIDATION_FAILED",
      httpStatus: 400,
      fieldErrors: { "transport.allowanceAmount": "Yol parası tutarını yazmalısın." },
    });
    expect(bodyOf(fetchMock, `/companies/${companyId}/jobs`)).toBeNull();
  });

  it("ilan yayımlanıp plan yazılamazsa ilan sayfasına notla düşer, ilanı geri almaz", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/reference/job-categories")) return jsonResponse(200, envelope(categories));
      if (url.endsWith("/transport-plan")) {
        return jsonResponse(503, { success: false, httpStatus: 503, errorCode: "UNEXPECTED", errorCategory: "UNEXPECTED", message: "x" });
      }
      return jsonResponse(201, envelope({ id: jobId }));
    });
    vi.stubGlobal("fetch", fetchMock);
    const plan = { outboundMethod: "SELF", returnMethod: "SELF", allowanceAmount: "", allowanceNote: "", notes: "", shuttles: [] };

    await expect(
      publishCompanyJobAction(companyId, idleFormState, submission({ transportPlan: JSON.stringify(plan) })),
    ).rejects.toThrowError(new Error(redirectTo(`/isveren/ilan/${jobId}?ulasim=kaydedilemedi`)));
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes("/cancel"))).toBe(false);
  });

  it("onaylanmamış şirkette isteği hiç göndermez", async () => {
    currentGates.mockResolvedValue({
      viewer: { companies: [] },
      failure: null,
      gates: {
        companies: [
          {
            companyId,
            companyName: "Koala Etkinlik",
            role: "ADMIN",
            approved: false,
            corporateJob: { open: false, blockedBy: ["companyApproval"] },
          },
        ],
      },
    });
    const fetchMock = backend(jsonResponse(201, envelope({ id: jobId })));

    const state = await publishCompanyJobAction(companyId, idleFormState, submission());

    expect(state).toMatchObject({ status: "error", httpStatus: 400 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("yetkilisi olunmayan şirkete ilan açmayı denemez", async () => {
    // Backend reddini `JOB_USER_IS_NOT_A_CONTACT_OF_COMPANY` ile bildiriyor;
    // kapının kendi metni aynı koddan besleniyor.
    const fetchMock = backend(jsonResponse(201, envelope({ id: jobId })));

    const state = await publishCompanyJobAction(otherCompanyId, idleFormState, submission());

    expect(state).toEqual({
      status: "error",
      errorCode: "JOB_USER_IS_NOT_A_CONTACT_OF_COMPANY",
      httpStatus: 400,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("UUID olmayan şirket kimliğini backend'e hiç sormaz", async () => {
    // Kimlik adres çubuğundan geliyor ve yola giriyor.
    const fetchMock = backend(jsonResponse(201, envelope({ id: jobId })));

    const state = await publishCompanyJobAction("../auth/login", idleFormState, submission());

    expect(state).toMatchObject({ status: "error" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("bitiş tarihi başlangıçtan önceyse isteği hiç göndermez", async () => {
    // Ortak kural şirket ilanında da geçerli; backend onu hiç denetlemiyor.
    const fetchMock = backend(jsonResponse(201, envelope({ id: jobId })));

    const state = await publishCompanyJobAction(
      companyId,
      idleFormState,
      submission({ endDateTime: "2026-10-09T09:00" }),
    );

    expect(state).toMatchObject({ status: "error", errorCode: "VALIDATION_FAILED" });
    expect(posted(fetchMock)).toBe(false);
  });

  it("sunucunun `ageRangeOrdered` mesajını maxAge alanının altına taşır", async () => {
    backend(
      jsonResponse(400, {
        success: false,
        errorCode: "VALIDATION_FAILED",
        details: [{ field: "ageRangeOrdered", message: "En büyük yaş küçük olamaz." }],
      }),
    );

    await expect(
      publishCompanyJobAction(companyId, idleFormState, submission()),
    ).resolves.toEqual({
      status: "error",
      errorCode: "VALIDATION_FAILED",
      httpStatus: 400,
      fieldErrors: { maxAge: "En büyük yaş küçük olamaz." },
    });
  });
});
