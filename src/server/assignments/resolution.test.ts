import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  cookieStore,
  envelope,
  jsonResponse,
  requestHeaders,
} from "../../../tests/support/session-cookies";

import {
  createAssignmentDisputeWithEvidence,
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
      }])))
      .mockResolvedValueOnce(jsonResponse(200, envelope([{
        id: "evidence-1",
        disputeId: "dispute-1",
        uploadedBy: {
          id: "user-1",
          firstName: "Ayşe",
          lastName: "Yılmaz",
          username: "ayse",
        },
        fileName: "vardiya.png",
        contentType: "image/png",
        fileSize: 2048,
        checksumSha256: "abc123",
        createdAt: "2026-09-06T10:05:00Z",
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
        evidence: {
          status: "ready",
          items: [{
            id: "evidence-1",
            disputeId: "dispute-1",
            uploadedByName: "Ayşe Yılmaz",
            fileName: "vardiya.png",
            contentType: "image/png",
            fileSize: 2048,
            createdAt: "2026-09-06T10:05:00Z",
          }],
        },
      }],
    });
    expect(fetchMock.mock.calls[2]?.[0]).toBe(
      "https://api.example.test/disputes/dispute-1/evidence",
    );
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

  it("kanıt listesi geçici olarak okunamazsa ana uyuşmazlık görünümünü korur", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(200, envelope({
        feeRate: "0",
        feeAmount: "0.00",
        refundAmount: "1000.00",
        noticeMinutes: 240,
        cancellableNow: true,
      })))
      .mockResolvedValueOnce(jsonResponse(200, envelope([{
        id: "dispute-1",
        status: "OPEN",
        reason: "Çalışma kaydı yanlış",
        resolution: null,
        resolutionNote: null,
        createdAt: "2026-09-06T10:00:00Z",
        resolvedAt: null,
      }])))
      .mockResolvedValueOnce(jsonResponse(503, {
        success: false,
        errorCode: "UPSTREAM_FAILED",
        errorCategory: "UPSTREAM_FAILED",
        message: "ham hata",
      }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await readAssignmentResolution(assignmentId, "CONFIRMED");

    expect(result.cancellationPreview?.refundAmount).toBe("1000.00");
    expect(result.disputes[0]).toMatchObject({
      id: "dispute-1",
      reason: "Çalışma kaydı yanlış",
      evidence: { status: "error", errorCode: "UPSTREAM_FAILED", httpStatus: 503 },
    });
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

  it("sağlayıcıya gönderilmiş iadeyi PROCESSING olarak korur", async () => {
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
        refundStatus: "PROCESSING",
        refundCompletedAt: null,
      })))
      .mockResolvedValueOnce(jsonResponse(200, envelope([])));
    vi.stubGlobal("fetch", fetchMock);

    const result = await readAssignmentResolution(assignmentId, "CANCELLED");

    expect(result.cancellation?.refundStatus).toBe("PROCESSING");
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

  it("uyuşmazlığı açtıktan sonra kanıtları tek tek yükleyip kısmi sonucu sayar", async () => {
    let previousUploadFinished = true;
    const uploadedNames: string[] = [];
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      if (url.endsWith(`/job-assignments/${assignmentId}/disputes`)) {
        return jsonResponse(201, envelope({
          id: "dispute-1",
          status: "OPEN",
          reason: "Çalışma kaydı yanlış",
          resolution: null,
          resolutionNote: null,
          createdAt: "2026-09-06T10:00:00Z",
          resolvedAt: null,
        }));
      }

      expect(previousUploadFinished).toBe(true);
      previousUploadFinished = false;
      const file = (init.body as FormData).get("file") as File;
      uploadedNames.push(file.name);
      await Promise.resolve();
      previousUploadFinished = true;
      return file.name === "bozuk.exe"
        ? jsonResponse(400, {
            success: false,
            errorCode: "VALIDATION_FAILED",
            errorCategory: "VALIDATION_FAILED",
          })
        : jsonResponse(201, envelope({ id: `evidence-${uploadedNames.length}` }));
    });
    vi.stubGlobal("fetch", fetchMock);
    const files = [
      new File(["png"], "vardiya.png", { type: "image/png" }),
      new File(["exe"], "bozuk.exe", { type: "application/octet-stream" }),
      new File(["pdf"], "tutanak.pdf", { type: "application/pdf" }),
    ];

    await expect(createAssignmentDisputeWithEvidence(
      assignmentId,
      "Çalışma kaydı yanlış",
      files,
    )).resolves.toEqual({ disputeId: "dispute-1", uploadedCount: 2, failedCount: 1 });

    expect(uploadedNames).toEqual(["vardiya.png", "bozuk.exe", "tutanak.pdf"]);
    for (const call of fetchMock.mock.calls.slice(1)) {
      const [url, init] = call as [string, RequestInit];
      expect(url).toBe("https://api.example.test/disputes/dispute-1/evidence");
      expect(init.method).toBe("POST");
      expect(init.body).toBeInstanceOf(FormData);
      expect(new Headers(init.headers).has("Content-Type")).toBe(false);
    }
  });

  it("uyuşmazlık açıldıktan sonra tek kanıt reddedilirse açılan kaydı kısmi sonuçta korur", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(201, envelope({
        id: "dispute-1",
        status: "OPEN",
        reason: "Çalışma kaydı yanlış",
        resolution: null,
        resolutionNote: null,
        createdAt: "2026-09-06T10:00:00Z",
        resolvedAt: null,
      })))
      .mockResolvedValueOnce(jsonResponse(409, {
        success: false,
        errorCode: "DISPUTE_EVIDENCE_LIMIT_REACHED",
        errorCategory: "DATA_CONFLICT",
        message: "ham backend mesajı",
      }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(createAssignmentDisputeWithEvidence(
      assignmentId,
      "Çalışma kaydı yanlış",
      [new File(["png"], "vardiya.png", { type: "image/png" })],
    )).resolves.toEqual({ disputeId: "dispute-1", uploadedCount: 0, failedCount: 1 });
  });

  it("uyuşmazlık açıldıktan sonra kanıt ağı çökerse açılan kaydı kısmi sonuçta korur", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(201, envelope({
        id: "dispute-1",
        status: "OPEN",
        reason: "Çalışma kaydı yanlış",
        resolution: null,
        resolutionNote: null,
        createdAt: "2026-09-06T10:00:00Z",
        resolvedAt: null,
      })))
      .mockRejectedValueOnce(new TypeError("network down"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(createAssignmentDisputeWithEvidence(
      assignmentId,
      "Çalışma kaydı yanlış",
      [new File(["png"], "vardiya.png", { type: "image/png" })],
    )).resolves.toEqual({ disputeId: "dispute-1", uploadedCount: 0, failedCount: 1 });
  });
});
