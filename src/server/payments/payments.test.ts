import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  cookieStore,
  envelope,
  jsonResponse,
  requestHeaders,
} from "../../../tests/support/session-cookies";

import {
  createPaymentSession,
  readEmployerAssignments,
  readPaymentReconciliation,
  readPaymentAttempts,
} from "./payments";

const deviceId = "b7b1f0d24c2f4f6c8a9e5d3c1b0a7f6e";
const assignmentId = "3b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f6e";

vi.mock("next/headers", async () => {
  const support = await import("../../../tests/support/session-cookies");
  return {
    cookies: () => Promise.resolve(support.cookieStore),
    headers: () => Promise.resolve(support.requestHeaders),
  };
});

const backendAssignment = {
  id: assignmentId,
  job: {
    id: "9c1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f60",
    title: "Etkinlik görevlisi",
    position: "Karşılama",
    employerType: "INDIVIDUAL",
    startDateTime: "2026-09-12T09:00:00",
    endDateTime: "2026-09-12T18:00:00",
    cityName: "İstanbul",
    districtName: "Kadıköy",
  },
  worker: { firstName: "Ayşe", lastName: "Yılmaz" },
  status: "CONFIRMED",
  paymentStatus: "PENDING_COLLECTION",
  pricing: {
    pricingVersion: "2026-09-v1",
    currency: "TRY",
    workerPayout: "1500.50",
    serviceFeeRate: "0.075",
    serviceFeeAmount: "112.54",
    employerTotal: "1613.04",
  },
};

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

describe("işveren ödeme BFF sözleşmesi", () => {
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

  it("işveren atamalarını backend'in işveren görünümünden okur", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, envelope(assignmentPage([backendAssignment]))),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await readEmployerAssignments();

    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.example.test/users/me/assignments?asEmployer=true&page=0&size=20",
    );
    expect(result.content[0]).toMatchObject({
      id: assignmentId,
      title: "Etkinlik görevlisi",
      workerName: "Ayşe Yılmaz",
      status: "CONFIRMED",
      paymentStatus: "PENDING_COLLECTION",
      pricing: backendAssignment.pricing,
    });
  });

  it("ödeme oturumunu yalnız atama kimliğiyle başlatır ve tokenı tarayıcı modeline çıkarmaz", async () => {
    const session = {
      paymentPageUrl: "https://sandbox-payment.iyzipay.com/checkout/token",
      token: "provider-secret-token",
      pricing: backendAssignment.pricing,
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, envelope(session)));
    vi.stubGlobal("fetch", fetchMock);

    const result = await createPaymentSession(assignmentId);

    expect(fetchMock.mock.calls[0][0]).toBe(
      `https://api.example.test/job-assignments/${assignmentId}/payment-session`,
    );
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "POST" });
    expect(result).toEqual({
      paymentPageUrl: session.paymentPageUrl,
      pricing: backendAssignment.pricing,
    });
    expect(result).not.toHaveProperty("token");
  });

  it("atamanın ödeme denemelerini yeni en üstteki backend listesinden taşır", async () => {
    const attempts = [{
      id: "2f1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f61",
      status: "FAILED",
      currency: "TRY",
      workerPayout: "1500.50",
      commissionRate: "0.075",
      commissionAmount: "112.54",
      totalCharged: "1613.04",
      failureReason: "provider internal detail",
      completedAt: "2026-09-06T18:05:00Z",
      createdAt: "2026-09-06T18:00:00Z",
    }];
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, envelope(attempts)));
    vi.stubGlobal("fetch", fetchMock);

    const result = await readPaymentAttempts(assignmentId);

    expect(fetchMock.mock.calls[0][0]).toBe(
      `https://api.example.test/job-assignments/${assignmentId}/payments`,
    );
    expect(result).toEqual([{
      id: attempts[0].id,
      status: "FAILED",
      currency: "TRY",
      workerPayout: "1500.50",
      serviceFeeRate: "0.075",
      serviceFeeAmount: "112.54",
      employerTotal: "1613.04",
      completedAt: "2026-09-06T18:05:00Z",
      createdAt: "2026-09-06T18:00:00Z",
    }]);
    expect(result[0]).not.toHaveProperty("failureReason");
  });

  it("ödeme sonucunu hem atamanın hem denemelerin backend durumundan mutabıklaştırır", async () => {
    const settledAssignment = {
      ...backendAssignment,
      paymentStatus: "HELD_IN_ESCROW",
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(200, envelope(assignmentPage([settledAssignment]))))
      .mockResolvedValueOnce(jsonResponse(200, envelope([{
        id: "attempt-1",
        status: "SUCCEEDED",
        pricing: backendAssignment.pricing,
        createdAt: "2026-09-06T18:00:00Z",
      }])));
    vi.stubGlobal("fetch", fetchMock);

    const result = await readPaymentReconciliation(assignmentId);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.example.test/users/me/assignments?asEmployer=true&page=0&size=100",
    );
    expect(fetchMock.mock.calls[1][0]).toBe(
      `https://api.example.test/job-assignments/${assignmentId}/payments`,
    );
    expect(result).toMatchObject({
      assignment: { id: assignmentId, paymentStatus: "HELD_IN_ESCROW" },
      resolution: "succeeded",
    });
  });
});
