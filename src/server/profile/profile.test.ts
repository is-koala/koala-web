import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  cookieStore,
  envelope,
  jsonResponse,
  requestHeaders,
} from "../../../tests/support/session-cookies";

import {
  createEducation,
  createExperience,
  deleteEducation,
  deleteExperience,
  getNotificationPreferences,
  updateEducation,
  updateExperience,
  updateNotificationPreferences,
  updateProfile,
  uploadProfilePicture,
} from "./profile";

vi.mock("next/headers", async () => {
  const support = await import("../../../tests/support/session-cookies");
  return {
    cookies: () => Promise.resolve(support.cookieStore),
    headers: () => Promise.resolve(support.requestHeaders),
  };
});

const deviceId = "b7b1f0d24c2f4f6c8a9e5d3c1b0a7f6e";

describe("profil backend modülü", () => {
  beforeEach(() => {
    vi.stubEnv("API_URL", "https://api.example.test");
    vi.stubEnv("APP_VERSION", "1.4.0");
    requestHeaders.delete("x-real-ip");
    cookieStore.values.clear();
    cookieStore.values.set("koala_did", deviceId);
    cookieStore.values.set("koala_at", "access-placeholder");
    cookieStore.values.set("koala_rt", "refresh-placeholder");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("profil alanlarını backend UpdateProfileDto adlarıyla yamalar", async () => {
    const fetchMock = successfulFetch();

    await updateProfile({
      firstName: "Ayşe",
      lastName: "Yıldız",
      jobTitle: "Barista",
      about: "Misafir deneyimi",
      qualifications: "Espresso, kasa",
      interests: "Kafe işleri",
    });

    expect(requestOf(fetchMock)).toMatchObject({
      url: "https://api.example.test/users/me",
      method: "PATCH",
      body: JSON.stringify({
        firstName: "Ayşe",
        lastName: "Yıldız",
        jobTitle: "Barista",
        about: "Misafir deneyimi",
        qualifications: "Espresso, kasa",
        interests: "Kafe işleri",
      }),
    });
  });

  it("deneyimi mobil istemcinin de okuduğu kanonik uçta oluşturur", async () => {
    const fetchMock = successfulFetch();

    await createExperience({
      title: "Barista",
      companyName: "Koala Kafe",
      employmentType: "PART_TIME",
      cityName: "İstanbul",
      startDate: "2025-01-10",
      endDate: null,
      description: "Kahve hazırlığı",
    });

    expect(requestOf(fetchMock)).toMatchObject({
      url: "https://api.example.test/users/me/experiences",
      method: "POST",
      body: JSON.stringify({
        title: "Barista",
        companyName: "Koala Kafe",
        employmentType: "PART_TIME",
        cityName: "İstanbul",
        startDate: "2025-01-10",
        endDate: null,
        description: "Kahve hazırlığı",
      }),
    });
  });

  it("deneyim kaydını aynı kanonik uçta günceller ve siler", async () => {
    const fetchMock = successfulFetch();
    const id = "11111111-1111-4111-8111-111111111111";
    const experience = {
      title: "Kıdemli barista",
      companyName: "Koala Kafe",
      employmentType: "FULL_TIME" as const,
      cityName: "İstanbul",
      startDate: "2025-01-10",
      endDate: null,
      description: "Vardiya sorumluluğu",
    };

    await updateExperience(id, experience);
    await deleteExperience(id);

    expect(requestOf(fetchMock, 0)).toMatchObject({
      url: `https://api.example.test/users/me/experiences/${id}`,
      method: "PUT",
      body: JSON.stringify(experience),
    });
    expect(requestOf(fetchMock, 1)).toMatchObject({
      url: `https://api.example.test/users/me/experiences/${id}`,
      method: "DELETE",
    });
  });

  it("eğitimi backend'in zorunlu referans kimlikleriyle oluşturur", async () => {
    const fetchMock = successfulFetch();

    await createEducation({
      universityId: "11111111-1111-4111-8111-111111111111",
      facultyId: "22222222-2222-4222-8222-222222222222",
      departmentId: "33333333-3333-4333-8333-333333333333",
      type: "GRADUATE",
      gpa: 3.42,
      startDate: "2020-09-01",
      endDate: "2024-06-15",
    });

    expect(requestOf(fetchMock)).toMatchObject({
      url: "https://api.example.test/users/me/educations",
      method: "POST",
      body: expect.stringContaining('"universityId":"11111111-1111-4111-8111-111111111111"'),
    });
  });

  it("eğitim kaydını kanonik uçta günceller ve siler", async () => {
    const fetchMock = successfulFetch();
    const id = "22222222-2222-4222-8222-222222222222";
    const education = {
      universityId: "11111111-1111-4111-8111-111111111111",
      facultyId: "33333333-3333-4333-8333-333333333333",
      departmentId: "44444444-4444-4444-8444-444444444444",
      type: "GRADUATE" as const,
      gpa: 3.75,
      startDate: "2020-09-01",
      endDate: "2024-06-15",
    };

    await updateEducation(id, education);
    await deleteEducation(id);

    expect(requestOf(fetchMock, 0)).toMatchObject({
      url: `https://api.example.test/users/me/educations/${id}`,
      method: "PUT",
      body: JSON.stringify(education),
    });
    expect(requestOf(fetchMock, 1)).toMatchObject({
      url: `https://api.example.test/users/me/educations/${id}`,
      method: "DELETE",
    });
  });

  it("iletişim tercihlerini category-channel satırları olarak gönderir", async () => {
    const fetchMock = successfulFetch();

    await updateNotificationPreferences([
      { category: "JOB_ALERTS", channel: "PUSH", enabled: true },
      { category: "NEWSLETTER", channel: "EMAIL", enabled: false },
    ]);

    expect(requestOf(fetchMock)).toMatchObject({
      url: "https://api.example.test/users/me/notification-preferences",
      method: "PUT",
      body: JSON.stringify({
        preferences: [
          { category: "JOB_ALERTS", channel: "PUSH", enabled: true },
          { category: "NEWSLETTER", channel: "EMAIL", enabled: false },
        ],
      }),
    });
  });

  it("tercih listesinde tanımadığı kategori ya da kanalı forma taşımaz", async () => {
    // Backend web'den önce yeni bir değer eklerse satır gizlenir: gösterilse
    // gizli alanı action'da reddedilir ve kaydın tamamı düşerdi
    // (is-koala/koala-web#198). Bilinen satırlar — yeni üç değer dahil — kalır.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          200,
          envelope([
            { category: "MESSAGES", kind: "ALERT", channel: "SMS", enabled: true, editable: true },
            { category: "TRANSPORT", kind: "TRANSACTIONAL", channel: "PUSH", enabled: true, editable: false },
            { category: "FUTURE_CATEGORY", kind: "ALERT", channel: "EMAIL", enabled: true, editable: true },
            { category: "JOB_ALERTS", kind: "ALERT", channel: "FAX", enabled: true, editable: true },
          ]),
        ),
      ),
    );

    await expect(getNotificationPreferences()).resolves.toEqual([
      { category: "MESSAGES", kind: "ALERT", channel: "SMS", enabled: true, editable: true },
      { category: "TRANSPORT", kind: "TRANSACTIONAL", channel: "PUSH", enabled: true, editable: false },
    ]);
  });

  it("tercih listesi boş zarfla gelirse boş liste döner", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, envelope(null))));

    await expect(getNotificationPreferences()).resolves.toEqual([]);
  });

  it("profil fotoğrafını image parçasıyla multipart aktarır", async () => {
    const fetchMock = successfulFetch();
    const image = new File(["koala"], "profil.png", { type: "image/png" });

    await uploadProfilePicture(image);

    const request = requestOf(fetchMock);
    expect(request).toMatchObject({
      url: "https://api.example.test/users/me/profile-picture",
      method: "PUT",
    });
    expect(request.headers.has("Content-Type")).toBe(false);
    expect(request.body).toBeInstanceOf(FormData);
    expect((request.body as FormData).get("image")).toBe(image);
  });
});

function successfulFetch() {
  const fetchMock = vi.fn().mockImplementation(() =>
    Promise.resolve(jsonResponse(200, envelope(null))),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function requestOf(fetchMock: ReturnType<typeof vi.fn>, call = 0) {
  const [url, init] = fetchMock.mock.calls[call] as [string, RequestInit];
  return {
    url,
    method: init.method,
    body: init.body,
    headers: new Headers(init.headers),
  };
}
