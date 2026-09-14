import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  cookieStore,
  envelope,
  jsonResponse,
  requestHeaders,
} from "../../../tests/support/session-cookies";

import { readWorkerApplications, withdrawWorkerApplication } from "./applications";

const deviceId = "b7b1f0d24c2f4f6c8a9e5d3c1b0a7f6e";
const applicationId = "3b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f6e";

vi.mock("next/headers", async () => {
  const support = await import("../../../tests/support/session-cookies");
  return {
    cookies: () => Promise.resolve(support.cookieStore),
    headers: () => Promise.resolve(support.requestHeaders),
  };
});

function page(content: unknown[]) {
  return {
    content,
    page: 1,
    size: 20,
    totalElements: 21,
    totalPages: 2,
    first: false,
    last: true,
  };
}

describe("çalışan başvuruları BFF sözleşmesi", () => {
  beforeEach(() => {
    vi.stubEnv("API_URL", "https://api.example.test");
    vi.stubEnv("APP_VERSION", "1.4.0");
    cookieStore.values.clear();
    cookieStore.values.set("koala_did", deviceId);
    cookieStore.values.set("koala_at", "access-placeholder");
    cookieStore.values.set("koala_rt", "refresh-placeholder");
    requestHeaders.delete("x-real-ip");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("durum filtresi ve sayfayı backend'e taşır, yalnız liste modelini döndürür", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, envelope(page([
      {
        id: applicationId,
        job: {
          id: "9c1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f60",
          title: "Etkinlik görevlisi",
          position: "Karşılama",
          employerType: "COMPANY",
          status: "CLOSED",
          companyName: "Koala Etkinlik",
          cityName: "İstanbul",
          districtName: "Kadıköy",
          startDateTime: "2026-09-12T09:00:00",
          coverImageUrl: "https://cdn.example.test/jobs/cover.webp",
        },
        status: "REJECTED",
        notes: "Hafta sonu uygunum.",
        rejectionReason: "Kontenjan doldu.",
        applicationDateTime: "2026-09-06T10:00:00Z",
        answeredDateTime: "2026-09-07T11:00:00Z",
        assignmentId: null,
      },
    ]))));
    vi.stubGlobal("fetch", fetchMock);

    await expect(readWorkerApplications({ status: "REJECTED", page: 1 })).resolves.toEqual({
      content: [{
        id: applicationId,
        jobId: "9c1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f60",
        title: "Etkinlik görevlisi",
        position: "Karşılama",
        companyName: "Koala Etkinlik",
        cityName: "İstanbul",
        districtName: "Kadıköy",
        startsAt: "2026-09-12T09:00:00",
        coverImageUrl: "https://cdn.example.test/jobs/cover.webp",
        status: "REJECTED",
        notes: "Hafta sonu uygunum.",
        rejectionReason: "Kontenjan doldu.",
        appliedAt: "2026-09-06T10:00:00Z",
        answeredAt: "2026-09-07T11:00:00Z",
        assignmentId: null,
        employerType: "COMPANY",
        jobStatus: "CLOSED",
      }],
      page: 1,
      size: 20,
      totalElements: 21,
      totalPages: 2,
      first: false,
      last: true,
    });
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.example.test/users/me/applications?status=REJECTED&page=1&size=20",
    );
  });

  it("işveren tipi ve ilan durumu gelmediyse ya da tanınmıyorsa UNKNOWN yazar", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, envelope(page([
      {
        id: applicationId,
        job: {
          id: "9c1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f60",
          title: "Etkinlik görevlisi",
          startDateTime: "2026-09-12T09:00:00",
          status: "ARCHIVED",
        },
        status: "APPLIED",
        applicationDateTime: "2026-09-06T10:00:00Z",
      },
    ])))));

    const result = await readWorkerApplications({ status: "ALL", page: 0 });

    expect(result.content[0]).toMatchObject({
      employerType: "UNKNOWN",
      jobStatus: "UNKNOWN",
      answeredAt: null,
    });
  });

  it("tüm durumlar filtresinde status parametresi göndermez", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, envelope(page([]))));
    vi.stubGlobal("fetch", fetchMock);

    await readWorkerApplications({ status: "ALL", page: 0 });

    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.example.test/users/me/applications?page=0&size=20",
    );
  });

  it("geri çekme isteğini gövdesiz doğru uygulamaya yollar", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, envelope({ id: applicationId })));
    vi.stubGlobal("fetch", fetchMock);

    await withdrawWorkerApplication(applicationId);

    expect(fetchMock.mock.calls[0][0]).toBe(
      `https://api.example.test/job-applications/${applicationId}/withdraw`,
    );
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "POST" });
    expect(fetchMock.mock.calls[0][1].body).toBeUndefined();
  });
});
