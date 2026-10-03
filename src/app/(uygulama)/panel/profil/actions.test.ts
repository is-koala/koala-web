import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { idleFormState } from "@/lib/form-state";
import {
  cookieStore,
  envelope,
  jsonResponse,
  requestHeaders,
} from "../../../../../tests/support/session-cookies";
import { redirectTo } from "../../../../../tests/support/navigation";

import { createEducationAction, loadFacultiesAction } from "./education-actions";
import { createExperienceAction } from "./experience-actions";
import { updateNotificationPreferencesAction } from "./notification-actions";
import {
  updateProfileAction,
  uploadProfilePictureAction,
} from "./profile-actions";

const revalidatePath = vi.hoisted(() => vi.fn());

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", async () => {
  const navigation = await import("../../../../../tests/support/navigation");
  return {
    redirect: navigation.throwingRedirect(),
    unstable_rethrow: navigation.rethrowTestNavigationError,
  };
});
vi.mock("next/headers", async () => {
  const support = await import("../../../../../tests/support/session-cookies");
  return {
    cookies: () => Promise.resolve(support.cookieStore),
    headers: () => Promise.resolve(support.requestHeaders),
  };
});

const deviceId = "b7b1f0d24c2f4f6c8a9e5d3c1b0a7f6e";

describe("profil Server Action'ları", () => {
  beforeEach(() => {
    vi.stubEnv("API_URL", "https://api.example.test");
    vi.stubEnv("APP_VERSION", "1.4.0");
    requestHeaders.set("x-koala-path", "/panel/profil");
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

  it("profil formunu gerçek UpdateProfileDto alanlarına dönüştürür", async () => {
    const fetchMock = successfulFetch();
    const form = submission({
      firstName: "Ayşe",
      lastName: "Yıldız",
      jobTitle: "Barista",
      about: "Misafir deneyimi",
      qualifications: "Espresso, kasa",
      interests: "Kafe işleri",
    });

    await expect(updateProfileAction(idleFormState, form)).resolves.toEqual({ status: "done" });
    expect(requestOf(fetchMock).body).toBe(
      JSON.stringify({
        firstName: "Ayşe",
        lastName: "Yıldız",
        jobTitle: "Barista",
        about: "Misafir deneyimi",
        qualifications: "Espresso, kasa",
        interests: "Kafe işleri",
      }),
    );
    expect(revalidatePath).toHaveBeenCalledWith("/panel/profil");
  });

  it("bitişi başlangıçtan önce olan deneyimi backend'e göndermez", async () => {
    const fetchMock = successfulFetch();

    await expect(
      createExperienceAction(
        idleFormState,
        submission({
          title: "Barista",
          companyName: "Koala Kafe",
          employmentType: "PART_TIME",
          cityName: "İstanbul",
          startDate: "2025-02-01",
          endDate: "2025-01-01",
          description: "Kahve hazırlığı",
        }),
      ),
    ).resolves.toMatchObject({
      status: "error",
      errorCode: "VALIDATION_FAILED",
      fieldErrors: { endDate: "Bitiş tarihi başlangıç tarihinden önce olamaz." },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("eğitim formunun referans kimliklerini ve sayısal ortalamasını gönderir", async () => {
    const fetchMock = successfulFetch();

    await createEducationAction(
      idleFormState,
      submission({
        universityId: "11111111-1111-4111-8111-111111111111",
        facultyId: "22222222-2222-4222-8222-222222222222",
        departmentId: "33333333-3333-4333-8333-333333333333",
        type: "GRADUATE",
        gpa: "3.42",
        startDate: "2020-09-01",
        endDate: "2024-06-15",
      }),
    );

    expect(JSON.parse(String(requestOf(fetchMock).body))).toEqual({
      universityId: "11111111-1111-4111-8111-111111111111",
      facultyId: "22222222-2222-4222-8222-222222222222",
      departmentId: "33333333-3333-4333-8333-333333333333",
      type: "GRADUATE",
      gpa: 3.42,
      startDate: "2020-09-01",
      endDate: "2024-06-15",
    });
  });

  it("checkbox satırlarını son değer kazanacak biçimde iletişim tercihine çevirir", async () => {
    const fetchMock = successfulFetch();
    const form = new FormData();
    form.append("preferences", "JOB_ALERTS|PUSH|false");
    form.append("preferences", "JOB_ALERTS|PUSH|true");
    form.append("preferences", "NEWSLETTER|EMAIL|false");

    await updateNotificationPreferencesAction(idleFormState, form);

    expect(JSON.parse(String(requestOf(fetchMock).body))).toEqual({
      preferences: [
        { category: "JOB_ALERTS", channel: "PUSH", enabled: true },
        { category: "NEWSLETTER", channel: "EMAIL", enabled: false },
      ],
    });
  });

  it("backend'in mesaj ve ulaşım kategorilerini ve SMS kanalını kaydeder", async () => {
    // Liste backend'den geride kaldığında bu satırlar formdan geliyor ama
    // action onları tanımayıp kaydın tamamını reddediyordu (is-koala/koala-web#198).
    const fetchMock = successfulFetch();
    const form = new FormData();
    form.append("preferences", "MESSAGES|EMAIL|false");
    form.append("preferences", "TRANSPORT|PUSH|true");
    form.append("preferences", "JOB_ALERTS|SMS|false");

    await expect(updateNotificationPreferencesAction(idleFormState, form)).resolves.toEqual({
      status: "done",
    });
    expect(JSON.parse(String(requestOf(fetchMock).body))).toEqual({
      preferences: [
        { category: "MESSAGES", channel: "EMAIL", enabled: false },
        { category: "TRANSPORT", channel: "PUSH", enabled: true },
        { category: "JOB_ALERTS", channel: "SMS", enabled: false },
      ],
    });
  });

  it("yalnız yüklendiği değerden farklı satırları gönderir", async () => {
    // Backend her ticari satır için — değişsin değişmesin — bir rıza kaydı ve
    // İYS görevi yazıyor; değişmeyen satırı göndermek kullanıcının rızayı
    // taze zaman damgasıyla yeniden vermiş gibi görünmesi demek.
    const fetchMock = successfulFetch();
    const form = new FormData();
    for (const value of ["NEWSLETTER|EMAIL|true", "MESSAGES|SMS|true", "JOB_ALERTS|PUSH|false"]) {
      form.append("initialPreferences", value);
    }
    form.append("preferences", "NEWSLETTER|EMAIL|false");
    form.append("preferences", "NEWSLETTER|EMAIL|true");
    form.append("preferences", "MESSAGES|SMS|false");
    form.append("preferences", "JOB_ALERTS|PUSH|false");

    await expect(updateNotificationPreferencesAction(idleFormState, form)).resolves.toEqual({
      status: "done",
    });
    expect(JSON.parse(String(requestOf(fetchMock).body))).toEqual({
      preferences: [{ category: "MESSAGES", channel: "SMS", enabled: false }],
    });
  });

  it("hiçbir satır değişmediyse backend'e gitmez ve bunu ayrı bir sonuçla söyler", async () => {
    const fetchMock = successfulFetch();
    const form = new FormData();
    form.append("initialPreferences", "NEWSLETTER|EMAIL|true");
    form.append("preferences", "NEWSLETTER|EMAIL|false");
    form.append("preferences", "NEWSLETTER|EMAIL|true");

    await expect(updateNotificationPreferencesAction(idleFormState, form)).resolves.toEqual({
      status: "done",
      unchanged: true,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("tercih kaydında süresi dolan oturumu hata state'ine çevirmeden girişe yönlendirir", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() =>
        jsonResponse(401, {
          success: false,
          errorCode: "UNAUTHORIZED",
          errorCategory: "AUTHENTICATION",
          message: "Oturum sona erdi.",
        }),
      ),
    );
    const form = new FormData();
    form.append("preferences", "JOB_ALERTS|PUSH|true");

    await expect(updateNotificationPreferencesAction(idleFormState, form)).rejects.toThrow(
      redirectTo("/giris?next=%2Fpanel%2Fprofil"),
    );

    expect(cookieStore.delete).toHaveBeenCalledWith("koala_at");
    expect(cookieStore.delete).toHaveBeenCalledWith("koala_rt");
  });

  it("eğitim referansı okunurken süresi dolan oturumu hata sonucuna çevirmeden girişe yönlendirir", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() =>
        jsonResponse(401, {
          success: false,
          errorCode: "UNAUTHORIZED",
          errorCategory: "AUTHENTICATION",
          message: "Oturum sona erdi.",
        }),
      ),
    );

    await expect(
      loadFacultiesAction("11111111-1111-4111-8111-111111111111"),
    ).rejects.toThrow(redirectTo("/giris?next=%2Fpanel%2Fprofil"));

    expect(cookieStore.delete).toHaveBeenCalledWith("koala_at");
    expect(cookieStore.delete).toHaveBeenCalledWith("koala_rt");
  });

  it("eğitim referansının backend hatasını güvenli kod ve durumla döndürür", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() =>
        jsonResponse(503, {
          success: false,
          errorCode: "REFERENCE_DATA_UNAVAILABLE",
          errorCategory: "TECHNICAL",
          message: "ham backend metni",
          requestId: "request-education-1",
        }),
      ),
    );

    await expect(
      loadFacultiesAction("11111111-1111-4111-8111-111111111111"),
    ).resolves.toEqual({
      status: "error",
      errorCode: "REFERENCE_DATA_UNAVAILABLE",
      httpStatus: 503,
    });
  });

  it("fotoğraf formundan yalnız image dosyasını multipart iletir", async () => {
    const fetchMock = successfulFetch();
    const form = new FormData();
    const image = new File(["koala"], "profil.png", { type: "image/png" });
    form.set("image", image);

    await uploadProfilePictureAction(idleFormState, form);

    const request = requestOf(fetchMock);
    expect(request.body).toBeInstanceOf(FormData);
    expect((request.body as FormData).get("image")).toBe(image);
    expect(request.headers.has("Content-Type")).toBe(false);
  });

  it("WebP fotoğrafı backend'e göndermeden reddeder", async () => {
    // Backend WebP'yi okuyamıyor (ImageIO okuyucusu yok, koala-backend#348).
    const fetchMock = successfulFetch();
    const form = new FormData();
    form.set("image", new File(["koala"], "profil.webp", { type: "image/webp" }));

    await expect(uploadProfilePictureAction(idleFormState, form)).resolves.toMatchObject({
      status: "error",
      fieldErrors: { image: "PNG, JPG veya JPEG biçiminde bir fotoğraf seç." },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

function submission(fields: Record<string, string>) {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) form.set(name, value);
  return form;
}

function successfulFetch() {
  const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, envelope(null)));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function requestOf(fetchMock: ReturnType<typeof vi.fn>) {
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  return { url, body: init.body, headers: new Headers(init.headers) };
}
