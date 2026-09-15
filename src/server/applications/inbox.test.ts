import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  cookieStore,
  envelope,
  jsonResponse,
  requestHeaders,
} from "../../../tests/support/session-cookies";

import { readReceivedApplications } from "./inbox";

const deviceId = "b7b1f0d24c2f4f6c8a9e5d3c1b0a7f6e";
const applicationId = "3b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f6e";
const jobId = "9c1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f60";
const companyId = "5d3c1b0a-7f60-4c2f-8a9e-9c1f0d244f6c";
const workerId = "6d2c0e58-2f0a-4b1e-9c3d-7a8b9c0d1e2f";
const assignmentId = "4b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f6e";

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

describe("işveren gelen kutusu BFF sözleşmesi", () => {
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

  it("durum, ilan, şirket ve sayfayı backend'e taşır; varsayılan sırayı istemez", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, envelope(page([
      {
        id: applicationId,
        status: "APPLIED",
        applicationDateTime: "2026-09-06T10:00:00Z",
        answeredDateTime: null,
        notes: "Hafta sonu uygunum.",
        applicant: {
          id: workerId,
          firstName: "Ayşe",
          lastName: "Yılmaz",
          profilePictureUrl: "https://cdn.example.test/users/ayse.webp",
        },
        jobId,
        postingTitle: "Etkinlik görevlisi",
        jobStatus: "OPEN",
        companyId,
        companyName: "Koala Etkinlik",
        assignmentId: null,
      },
    ]))));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      readReceivedApplications({
        status: "APPLIED",
        jobId,
        companyId,
        page: 1,
      }),
    ).resolves.toEqual({
      content: [{
        id: applicationId,
        status: "APPLIED",
        appliedAt: "2026-09-06T10:00:00Z",
        answeredAt: null,
        notes: "Hafta sonu uygunum.",
        applicant: {
          id: workerId,
          fullName: "Ayşe Yılmaz",
          profilePictureUrl: "https://cdn.example.test/users/ayse.webp",
        },
        jobId,
        postingTitle: "Etkinlik görevlisi",
        jobStatus: "OPEN",
        companyId,
        companyName: "Koala Etkinlik",
        assignmentId: null,
      }],
      page: 1,
      size: 20,
      totalElements: 21,
      totalPages: 2,
      first: false,
      last: true,
    });
    expect(fetchMock.mock.calls[0][0]).toBe(
      `https://api.example.test/users/me/received-applications?status=APPLIED&jobId=${jobId}&companyId=${companyId}&page=1&size=20`,
    );
  });

  it("tüm durumlar filtresinde status göndermez ve bireysel ilanda şirketi boş bırakır", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, envelope(page([
      {
        id: applicationId,
        status: "ACCEPTED",
        applicationDateTime: "2026-09-06T10:00:00Z",
        answeredDateTime: "2026-09-07T11:00:00Z",
        applicant: { id: workerId, firstName: "Ayşe" },
        jobId,
        postingTitle: "Garson",
        assignmentId,
      },
    ]))));
    vi.stubGlobal("fetch", fetchMock);

    const result = await readReceivedApplications({
      status: "ALL",
      jobId: null,
      companyId: null,
      page: 0,
    });

    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.example.test/users/me/received-applications?page=0&size=20",
    );
    expect(result.content[0]).toMatchObject({
      companyId: null,
      companyName: null,
      jobStatus: "UNKNOWN",
      answeredAt: "2026-09-07T11:00:00Z",
      assignmentId,
      applicant: { fullName: "Ayşe" },
    });
  });

  it("tanınmayan durumu UNKNOWN yazar; e-posta ve telefon okumaz", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, envelope(page([
      {
        id: applicationId,
        status: "ARCHIVED",
        applicationDateTime: "2026-09-06T10:00:00Z",
        applicant: {
          id: workerId,
          email: "hidden@example.test",
          phoneNumber: "+905551112233",
          username: "ayse",
        },
        jobId,
        postingTitle: "Garson",
        jobStatus: "ARCHIVED",
      },
    ])))));

    const result = await readReceivedApplications({
      status: "ALL",
      jobId: null,
      companyId: null,
      page: 0,
    });

    expect(result.content[0]?.status).toBe("UNKNOWN");
    expect(result.content[0]?.jobStatus).toBe("UNKNOWN");
    expect(result.content[0]?.applicant.fullName).toBe("ayse");
    expect(JSON.stringify(result.content[0])).not.toContain("hidden@example.test");
    expect(JSON.stringify(result.content[0])).not.toContain("+905551112233");
  });
});
