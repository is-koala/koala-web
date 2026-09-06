import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { idleFormState } from "@/lib/form-state";
import {
  cookieStore,
  envelope,
  jsonResponse,
  requestHeaders,
} from "../../../../../tests/support/session-cookies";

import { createEducationAction } from "./education-actions";
import { createExperienceAction } from "./experience-actions";
import { updateNotificationPreferencesAction } from "./notification-actions";
import {
  updateProfileAction,
  uploadProfilePictureAction,
} from "./profile-actions";

const revalidatePath = vi.hoisted(() => vi.fn());

vi.mock("next/cache", () => ({ revalidatePath }));
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

  it("fotoğraf formundan yalnız image dosyasını multipart iletir", async () => {
    const fetchMock = successfulFetch();
    const form = new FormData();
    const image = new File(["koala"], "profil.webp", { type: "image/webp" });
    form.set("image", image);

    await uploadProfilePictureAction(idleFormState, form);

    const request = requestOf(fetchMock);
    expect(request.body).toBeInstanceOf(FormData);
    expect((request.body as FormData).get("image")).toBe(image);
    expect(request.headers.has("Content-Type")).toBe(false);
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
