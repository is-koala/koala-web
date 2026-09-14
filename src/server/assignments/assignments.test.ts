import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  cookieStore,
  envelope,
  jsonResponse,
  requestHeaders,
} from "../../../tests/support/session-cookies";

import {
  readAssignmentAddress,
  readWorkerAssignments,
  respondToWorkerAssignment,
} from "./assignments";

const deviceId = "b7b1f0d24c2f4f6c8a9e5d3c1b0a7f6e";
const assignmentId = "3b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f6e";

vi.mock("next/headers", async () => {
  const support = await import("../../../tests/support/session-cookies");
  return {
    cookies: () => Promise.resolve(support.cookieStore),
    headers: () => Promise.resolve(support.requestHeaders),
  };
});

function assignmentDto(status = "PENDING_CONFIRMATION") {
  return {
    id: assignmentId,
    job: {
      id: "9c1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f60",
      title: "Etkinlik görevlisi",
      position: "Karşılama",
      category: { id: "category-1", name: "Etkinlik", code: "EVENT" },
      startDateTime: "2026-09-12T09:00:00",
      endDateTime: "2026-09-12T18:00:00",
      cityName: "İstanbul",
      districtName: "Kadıköy",
      companyName: "Koala Etkinlik",
      employerType: "COMPANY",
    },
    status,
    paymentStatus: "PENDING_COLLECTION",
    assignmentDateTime: "2026-09-06T10:00:00Z",
    workerPayout: 1250,
    pricing: { currency: "TRY", workerPayout: "1250.00" },
  };
}

function assignmentPage(content: unknown[]) {
  return {
    content,
    page: 0,
    size: 20,
    totalElements: content.length,
    totalPages: content.length === 0 ? 0 : 1,
    first: true,
    last: true,
  };
}

describe("çalışan atamaları BFF sözleşmesi", () => {
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

  it("çalışan görünümünü tam backend yolu ile okur ve yalnız liste alanlarını taşır", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, envelope(assignmentPage([assignmentDto()]))),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await readWorkerAssignments();
    expect(result).toEqual({
      content: [
        {
          id: assignmentId,
          jobId: "9c1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f60",
          title: "Etkinlik görevlisi",
          position: "Karşılama",
          categoryName: "Etkinlik",
          companyName: "Koala Etkinlik",
          cityName: "İstanbul",
          districtName: "Kadıköy",
          startsAt: "2026-09-12T09:00:00",
          endsAt: "2026-09-12T18:00:00",
          status: "PENDING_CONFIRMATION",
          paymentStatus: "PENDING_COLLECTION",
          workerPayout: "1250.00",
          currency: "TRY",
          employerType: "COMPANY",
          assignedAt: "2026-09-06T10:00:00Z",
        },
      ],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
      first: true,
      last: true,
    });

    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.example.test/users/me/assignments?asEmployer=false&page=0&size=20",
    );
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "GET" });
    expect(result.content[0]).not.toHaveProperty("address");
  });

  it("istenen sayfayı backend'e taşır", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, envelope({ ...assignmentPage([]), page: 2, first: false })),
    );
    vi.stubGlobal("fetch", fetchMock);

    await readWorkerAssignments(2);

    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.example.test/users/me/assignments?asEmployer=false&page=2&size=20",
    );
  });

  it("kabul özeti için yalnız yetkili ilan detayındaki kesin adresi taşır", async () => {
    const jobId = "9c1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f60";
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, envelope({
        id: jobId,
        addressPrecision: "EXACT",
        address: {
          displayAddress: "Caferağa Mahallesi, Moda Caddesi No: 12/4, Kadıköy, İstanbul",
        },
      })),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(readAssignmentAddress(jobId)).resolves.toBe(
      "Caferağa Mahallesi, Moda Caddesi No: 12/4, Kadıköy, İstanbul",
    );
    expect(fetchMock.mock.calls[0][0]).toBe(`https://api.example.test/jobs/${jobId}`);
  });

  it("atamaya kabul veya ret boolean'ı dışında alan göndermeden cevap verir", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, envelope({ id: assignmentId })));
    vi.stubGlobal("fetch", fetchMock);

    await respondToWorkerAssignment(assignmentId, true);

    expect(fetchMock.mock.calls[0][0]).toBe(
      `https://api.example.test/job-assignments/${assignmentId}/respond`,
    );
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({ accepted: true }),
    });
  });
});
