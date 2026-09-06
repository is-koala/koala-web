import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  cookieStore,
  envelope,
  jsonResponse,
  requestHeaders,
} from "../../../tests/support/session-cookies";

import {
  cancelAssignment,
  createAssignmentDispute,
  readAssignmentResolution,
  readWorkerAssignmentResolution,
} from "./resolution";

const assignmentId = "3b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f6e";

vi.mock("next/headers", async () => {
  const support = await import("../../../tests/support/session-cookies");
  return {
    cookies: () => Promise.resolve(support.cookieStore),
    headers: () => Promise.resolve(support.requestHeaders),
  };
});

describe("atama sonuçlandırma BFF sözleşmesi", () => {
  beforeEach(() => {
    vi.stubEnv("API_URL", "https://api.example.test");
    vi.stubEnv("APP_VERSION", "1.4.0");
    cookieStore.values.clear();
    cookieStore.values.set("koala_at", "access-placeholder");
    cookieStore.values.set("koala_rt", "refresh-placeholder");
    cookieStore.values.set("koala_did", "device-placeholder");
    requestHeaders.delete("x-real-ip");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("iptal edilebilir atamada kesinti önizlemesiyle açık uyuşmazlığı tek görünümde toplar", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(200, envelope({
        feeRate: "0.075",
        feeAmount: "75.00",
        refundAmount: "925.00",
        noticeMinutes: 60,
        cancellableNow: true,
      })))
      .mockResolvedValueOnce(jsonResponse(200, envelope([{
        id: "dispute-1",
        status: "UNDER_REVIEW",
        reason: "Çalışma kaydı yanlış",
        resolution: null,
        resolutionNote: null,
        createdAt: "2026-09-06T10:00:00Z",
        resolvedAt: null,
      }])));
    vi.stubGlobal("fetch", fetchMock);

    await expect(readAssignmentResolution(assignmentId, "CONFIRMED")).resolves.toEqual({
      cancellationPreview: {
        feeRate: "0.075",
        feeAmount: "75.00",
        refundAmount: "925.00",
        noticeMinutes: 60,
        cancellableNow: true,
      },
      cancellation: null,
      disputes: [{
        id: "dispute-1",
        status: "UNDER_REVIEW",
        reason: "Çalışma kaydı yanlış",
        resolution: null,
        resolutionNote: null,
        createdAt: "2026-09-06T10:00:00Z",
        resolvedAt: null,
      }],
    });
  });

  it("sayısal iptal tutarını kesin para sözleşmesi diye kabul etmez", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(200, envelope({
        feeRate: "0.075",
        feeAmount: 75,
        refundAmount: "925.00",
        noticeMinutes: 60,
        cancellableNow: true,
      })))
      .mockResolvedValueOnce(jsonResponse(200, envelope([])));
    vi.stubGlobal("fetch", fetchMock);

    await expect(readAssignmentResolution(assignmentId, "CONFIRMED"))
      .rejects.toThrow("cancellationPreview.feeAmount must be an exact decimal string");
  });

  it("iptal edilen atamada gerçek iade yaşam döngüsünü taşır", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(200, envelope({
        id: "cancellation-1",
        cancelledByParty: "EMPLOYER",
        reason: "Plan değişti",
        feeRate: "0",
        feeAmount: "0.00",
        refundAmount: "1000.00",
        noticeMinutes: 240,
        cancelledAt: "2026-09-06T10:00:00Z",
        refundStatus: "PENDING",
        refundCompletedAt: null,
      })))
      .mockResolvedValueOnce(jsonResponse(200, envelope([])));
    vi.stubGlobal("fetch", fetchMock);

    const result = await readAssignmentResolution(assignmentId, "CANCELLED");

    expect(result.cancellation).toMatchObject({
      refundStatus: "PENDING",
      refundAmount: "1000.00",
    });
    expect(result.cancellationPreview).toBeNull();
  });

  it("işçi çözüm görünümünden işverenin finansal alanlarını çıkarır", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(200, envelope({
        id: "cancellation-1",
        cancelledByParty: "WORKER",
        reason: "Program değişti",
        feeRate: "0.075",
        feeAmount: "75.00",
        refundAmount: "925.00",
        noticeMinutes: 60,
        cancelledAt: "2026-09-06T10:00:00Z",
        refundStatus: "PENDING",
        refundCompletedAt: null,
      })))
      .mockResolvedValueOnce(jsonResponse(200, envelope([])));
    vi.stubGlobal("fetch", fetchMock);

    const result = await readWorkerAssignmentResolution(assignmentId, "CANCELLED");

    expect(result).toEqual({
      cancellationPreview: null,
      cancellation: {
        id: "cancellation-1",
        cancelledByParty: "WORKER",
        reason: "Program değişti",
        noticeMinutes: 60,
        cancelledAt: "2026-09-06T10:00:00Z",
      },
      disputes: [],
    });
    expect(JSON.stringify(result)).not.toMatch(/feeRate|feeAmount|refundAmount|refundStatus/);
  });

  it("iptal ve uyuşmazlık komutlarını dar backend gövdeleriyle yollar", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(201, envelope({})))
      .mockResolvedValueOnce(jsonResponse(201, envelope({})));
    vi.stubGlobal("fetch", fetchMock);

    await cancelAssignment(assignmentId, "Plan değişti");
    await createAssignmentDispute(assignmentId, "Çalışma kaydı yanlış");

    expect(fetchMock.mock.calls.map((call) => [call[0], call[1].body])).toEqual([
      [`https://api.example.test/job-assignments/${assignmentId}/cancel`, JSON.stringify({ reason: "Plan değişti" })],
      [`https://api.example.test/job-assignments/${assignmentId}/disputes`, JSON.stringify({ reason: "Çalışma kaydı yanlış" })],
    ]);
  });
});
