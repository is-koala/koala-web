import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { redirectTo } from "../../../tests/support/navigation";
import {
  cookieStore,
  envelope,
  jsonResponse,
  requestHeaders as testRequestHeaders,
} from "../../../tests/support/session-cookies";

import { loadViewer } from "./viewer";

vi.mock("next/headers", async () => {
  const support = await import("../../../tests/support/session-cookies");
  return {
    cookies: () => Promise.resolve(support.cookieStore),
    headers: () => Promise.resolve(support.requestHeaders),
  };
});
vi.mock("next/navigation", async () => ({
  redirect: (await import("../../../tests/support/navigation")).throwingRedirect(),
}));

const deviceId = "b7b1f0d24c2f4f6c8a9e5d3c1b0a7f6e";

const unauthorized = () =>
  jsonResponse(401, {
    success: false,
    httpStatus: "UNAUTHORIZED",
    errorCode: "TOKEN_EXPIRED",
    errorCategory: "TOKEN_EXPIRED",
    message: "Oturum suresi doldu.",
  });

/** `UserMeResponseDto`'nun kabuğu ilgilendiren alanları. */
function userMe(overrides: Record<string, unknown> = {}) {
  return {
    id: "6f1a0e2c-0000-4000-8000-000000000001",
    firstName: "Ayşe",
    lastName: "Yıldız",
    email: "ayse@example.test",
    isEmployer: true,
    emailVerified: true,
    phoneVerified: false,
    identityVerified: false,
    maskedTcIdentityNumber: null,
    profilePictureUrl: "https://cdn.example.test/ayse.webp",
    phoneNumber: "+905551112233",
    jobTitle: "Barista",
    about: "Misafir deneyimi alanında çalışıyorum.",
    qualifications: "Espresso, kasa",
    interests: "Kafe ve etkinlik işleri",
    experiences: [],
    educations: [],
    address: null,
    companies: [],
    ...overrides,
  };
}

describe("kabuğun kullanıcı bağlamı", () => {
  beforeEach(() => {
    vi.stubEnv("API_URL", "https://api.example.test");
    vi.stubEnv("APP_VERSION", "1.4.0");
    testRequestHeaders.delete("x-koala-path");
    cookieStore.values.clear();
    cookieStore.values.set("koala_did", deviceId);
    cookieStore.values.set("koala_at", "access-placeholder");
    cookieStore.values.set("koala_rt", "refresh-placeholder");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("profili tek bir GET /users/me çağrısından okur", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, envelope(userMe())));
    vi.stubGlobal("fetch", fetchMock);

    const { viewer, failure } = await loadViewer();

    expect(failure).toBeNull();
    expect(viewer).toMatchObject({
      firstName: "Ayşe",
      displayName: "Ayşe Yıldız",
      isEmployer: true,
      identityVerified: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((fetchMock.mock.calls[0] as [string, RequestInit])[0]).toBe(
      "https://api.example.test/users/me",
    );
  });

  it("işveren bayrağını JSON adıyla okur, Java alan adıyla değil", async () => {
    // `UserMeResponseDto` alanı `employer`, ama `@JsonProperty("isEmployer")`
    // ile sabitlenmiş. Java adına bakan bir tip, bayrağı her hesapta yanlış
    // okur ve kimse fark etmez.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(200, envelope({ ...userMe({ isEmployer: false }), employer: true })),
      ),
    );

    const { viewer } = await loadViewer();

    expect(viewer?.isEmployer).toBe(false);
  });

  it("birden çok şirket üyeliğini onay durumlarıyla birlikte taşır", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          200,
          envelope(
            userMe({
              companies: [
                { companyId: "c1", companyName: "Koala A.Ş.", role: "ADMIN", approved: true },
                { companyId: "c2", companyName: "Koala Lojistik", role: "STAFF", approved: false },
              ],
            }),
          ),
        ),
      ),
    );

    const { viewer } = await loadViewer();

    expect(viewer?.companies).toEqual([
      { companyId: "c1", companyName: "Koala A.Ş.", role: "ADMIN", approved: true },
      { companyId: "c2", companyName: "Koala Lojistik", role: "STAFF", approved: false },
    ]);
  });

  it("profil sayfasının gösterdiği özgeçmiş alanlarını aynı /users/me yanıtından daraltır", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          200,
          envelope(
            userMe({
              experiences: [
                {
                  id: "11111111-1111-4111-8111-111111111111",
                  title: "Barista",
                  companyName: "Koala Kafe",
                  employmentType: "PART_TIME",
                  cityName: "İstanbul",
                  startDate: "2025-01-10",
                  endDate: null,
                  description: "Kahve hazırlığı",
                },
              ],
              educations: [
                {
                  id: "22222222-2222-4222-8222-222222222222",
                  universityId: "33333333-3333-4333-8333-333333333333",
                  universityName: "Koala Üniversitesi",
                  facultyId: "44444444-4444-4444-8444-444444444444",
                  facultyName: "İletişim Fakültesi",
                  departmentId: "55555555-5555-4555-8555-555555555555",
                  departmentName: "Halkla İlişkiler",
                  type: "GRADUATE",
                  gpa: 3.42,
                  startDate: "2020-09-01",
                  endDate: "2024-06-15",
                },
              ],
            }),
          ),
        ),
      ),
    );

    const { viewer } = await loadViewer();

    expect(viewer).toMatchObject({
      lastName: "Yıldız",
      email: "ayse@example.test",
      phoneNumber: "+905551112233",
      profilePictureUrl: "https://cdn.example.test/ayse.webp",
      jobTitle: "Barista",
      qualifications: "Espresso, kasa",
      interests: "Kafe ve etkinlik işleri",
    });
    expect(viewer?.experiences[0]).toMatchObject({ title: "Barista", employmentType: "PART_TIME" });
    expect(viewer?.educations[0]).toMatchObject({
      universityName: "Koala Üniversitesi",
      type: "GRADUATE",
    });
  });

  it("rozetleri aynı /users/me yanıtından taşır; kodu ya da adı olmayan rozet düşer", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          200,
          envelope(
            userMe({
              badges: [
                {
                  code: "PUNCTUALITY_GOLD",
                  family: "PUNCTUALITY",
                  tier: "GOLD",
                  name: "Dakik",
                  description: "Son on işe zamanında geldin.",
                  iconUrl: "https://cdn.example.test/badges/punctual.webp",
                  earnedAt: "2026-09-01T10:00:00Z",
                },
                { code: "BROKEN" },
              ],
            }),
          ),
        ),
      ),
    );

    const { viewer } = await loadViewer();

    expect(viewer?.badges).toEqual([
      {
        code: "PUNCTUALITY_GOLD",
        family: "PUNCTUALITY",
        tier: "GOLD",
        name: "Dakik",
        description: "Son on işe zamanında geldin.",
        iconUrl: "https://cdn.example.test/badges/punctual.webp",
        earnedAt: "2026-09-01T10:00:00Z",
      },
    ]);
  });

  it("kimlik numarasını ve adresi değer olarak değil, varlık olarak taşır", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          200,
          envelope(
            userMe({
              identityVerified: true,
              maskedTcIdentityNumber: "123*****01",
              address: { id: "a1", city: "İstanbul" },
            }),
          ),
        ),
      ),
    );

    const { viewer } = await loadViewer();

    expect(viewer).toMatchObject({ hasIdentityNumber: true, hasAddress: true });
    // Kapılar yalnız "var mı" sorusunu soruyor; değeri kabuğa taşımak onu
    // log'a, Sentry olayına ve ölçümlemeye açık hâle getirirdi.
    expect(JSON.stringify(viewer)).not.toContain("123*****01");
    expect(JSON.stringify(viewer)).not.toContain("İstanbul");
  });

  it("backend hatasında sayfayı düşürmez, nedeni taşır", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(503, {
          success: false,
          httpStatus: "SERVICE_UNAVAILABLE",
          errorCode: "EXTERNAL_SERVICE",
          errorCategory: "EXTERNAL",
          message: "Servise ulasilamiyor.",
        }),
      ),
    );

    const { viewer, failure } = await loadViewer();

    expect(viewer).toBeNull();
    expect(failure).toEqual({ status: 503, errorCode: "EXTERNAL_SERVICE" });
  });

  it("gövdesiz başarılı yanıtı çökmek yerine hata durumu sayar", async () => {
    // `apiFetch` gövdesiz 200'ü `null` olarak döndürüyor. Bu `/users/me` için
    // sözleşme ihlali; adı olmayan bir kullanıcıyla kabuğu çizmek yerine
    // nedeni ekranda söylenir.
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, envelope(null))));

    const { viewer, failure } = await loadViewer();

    expect(viewer).toBeNull();
    expect(failure).toEqual({ status: 0, errorCode: "UNEXPECTED" });
  });

  it("oturum bittiğinde hata durumu üretmez, kullanıcıyı girişe bırakır", async () => {
    testRequestHeaders.set("x-koala-path", "/isveren/ilanlar");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(unauthorized()).mockResolvedValueOnce(unauthorized()),
    );

    // `apiRequest` yenilemeyi denedi ve oturum bitti: kullanıcı "kimliğin
    // doğrulanmamış" şeridi değil giriş sayfasını görmeli.
    await expect(loadViewer()).rejects.toThrowError(
      new Error(redirectTo("/giris?next=%2Fisveren%2Filanlar")),
    );
  });

  it("yenilenmiş token da reddedilirse şerit değil giriş gösterir", async () => {
    testRequestHeaders.set("x-koala-path", "/panel");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(unauthorized())
        .mockResolvedValueOnce(
          jsonResponse(
            200,
            envelope({
              token: "yeni-access-placeholder",
              refreshToken: "refresh-placeholder",
              refreshExpiresAt: "2026-10-06T00:00:00Z",
            }),
          ),
        )
        .mockResolvedValueOnce(unauthorized()),
    );

    // Yenileme başarılı ama backend tazelenmiş tokenı da reddediyor: oturum
    // gerçekten bitmiş. Bunu bir kapı arızası sayıp oturumlu kabuğun içinde
    // "profil okunamadı" göstermek, kullanıcıyı çıkışı olmayan bir ekranda
    // bırakırdı.
    await expect(loadViewer()).rejects.toThrowError(
      new Error(redirectTo("/giris?next=%2Fpanel")),
    );
  });
});
