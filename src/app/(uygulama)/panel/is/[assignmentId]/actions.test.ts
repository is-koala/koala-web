import { beforeEach, describe, expect, it, vi } from "vitest";

import type { WorkDetail } from "@/assignments/work-detail";
import { ApiError } from "@/server/api/errors";

import { workConversationAction, workDetailAction } from "./actions";

const assignmentId = "3b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f6e";
const requireSessionForCurrentPath = vi.hoisted(() => vi.fn());
const readWorkDetail = vi.hoisted(() => vi.fn());
const checkpoint = vi.hoisted(() => vi.fn());
const cancelAssignment = vi.hoisted(() => vi.fn());
const createAssignmentDispute = vi.hoisted(() => vi.fn());
const createAssignmentDisputeWithEvidence = vi.hoisted(() => vi.fn());
const uploadAssignmentDisputeEvidence = vi.hoisted(() => vi.fn());
const createAssignmentReview = vi.hoisted(() => vi.fn());
const selectSeat = vi.hoisted(() => vi.fn());
const openWorkerConversation = vi.hoisted(() => vi.fn());

vi.mock("@/server/session/guard", () => ({ requireSessionForCurrentPath }));
vi.mock("@/server/messaging/messaging", () => ({ openWorkerConversation }));
vi.mock("@/server/assignments/work-detail", () => ({
  readWorkDetail,
  checkpoint,
  cancelAssignment,
  createAssignmentDispute,
  createAssignmentDisputeWithEvidence,
  uploadAssignmentDisputeEvidence,
  createAssignmentReview,
  selectSeat,
}));

const detail = {
  observedAt: new Date("2026-09-12T10:00:00Z").getTime(),
  assignment: {
    id: assignmentId,
    jobId: "9c1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f60",
    title: "Etkinlik görevlisi",
    position: null,
    categoryName: null,
    companyName: "Koala Etkinlik",
    cityName: "İstanbul",
    districtName: "Kadıköy",
    startsAt: "2026-09-12T09:00:00",
    endsAt: "2026-09-12T18:00:00",
    status: "IN_PROGRESS",
    paymentStatus: "HELD_IN_ESCROW",
    workerPayout: "1250.00",
    currency: "TRY",
    employerType: "COMPANY",
    assignedAt: "2026-09-06T10:00:00Z",
    completedAt: null,
    appliedAt: null,
    acceptedAt: null,
    confirmedAt: null,
    paymentSecuredAt: null,
    messaging: null,
    myReview: null,
    counterpartyReviewed: null,
  },
  employer: null,
  description: null,
  duties: null,
  dressCode: null,
  additionalDirections: null,
  headcount: null,
  hiredCount: 0,
  createdAt: null,
  fullAddress: "Moda Caddesi No: 12",
  sessions: [],
  resolution: { cancellationPreview: null, cancellation: null, disputes: [] },
  transport: null,
} satisfies WorkDetail;

describe("iş ayrıntısı action sözleşmesi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireSessionForCurrentPath.mockResolvedValue({ refreshToken: "refresh-placeholder" });
    readWorkDetail.mockResolvedValue(detail);
  });

  it("oturum kapısını her komuttan önce açar", async () => {
    requireSessionForCurrentPath.mockRejectedValueOnce(new Error("NEXT_REDIRECT"));

    await expect(workDetailAction(assignmentId, { type: "refresh" })).rejects.toThrow(
      "NEXT_REDIRECT",
    );

    expect(readWorkDetail).not.toHaveBeenCalled();
  });

  it("yenilemede yalnız sunucu gerçeğini döndürür", async () => {
    await expect(workDetailAction(assignmentId, { type: "refresh" })).resolves.toEqual({
      status: "done",
      detail,
    });

    expect(readWorkDetail).toHaveBeenCalledWith(assignmentId);
    expect(checkpoint).not.toHaveBeenCalled();
  });

  it("yenilemede atama artık yoksa istemcinin eski ayrıntıyı temizlemesini söyler", async () => {
    readWorkDetail.mockResolvedValueOnce(null);

    await expect(workDetailAction(assignmentId, { type: "refresh" })).resolves.toEqual({
      status: "error",
      errorCode: "JOB_ASSIGNMENT_NOT_FOUND",
      httpStatus: 404,
      detail: null,
    });
  });

  it("konumlu check-in'i kaydedip ayrıntıyı yeniden okur", async () => {
    await expect(workDetailAction(assignmentId, {
      type: "checkpoint",
      kind: "check-in",
      point: { latitude: 40.98, longitude: 29.02 },
    })).resolves.toEqual({ status: "done", detail });

    expect(checkpoint).toHaveBeenCalledWith(
      assignmentId,
      "check-in",
      { latitude: 40.98, longitude: 29.02 },
    );
    expect(checkpoint.mock.invocationCallOrder[0]).toBeLessThan(
      readWorkDetail.mock.invocationCallOrder[0],
    );
  });

  it("konumsuz check-out'u destekler", async () => {
    await workDetailAction(assignmentId, {
      type: "checkpoint",
      kind: "check-out",
      point: null,
    });

    expect(checkpoint).toHaveBeenCalledWith(assignmentId, "check-out", null);
  });

  it("409 ve 404 puantaj yarışlarında açıklayıcı kodla birlikte güncel ayrıntıyı döndürür", async () => {
    for (const failure of [
      { status: 409, errorCode: "TIMESHEET_ALREADY_CHECKED_IN" },
      { status: 404, errorCode: "TIMESHEET_NOT_CHECKED_IN" },
    ]) {
      vi.clearAllMocks();
      requireSessionForCurrentPath.mockResolvedValue({ refreshToken: "refresh-placeholder" });
      checkpoint.mockRejectedValueOnce(new ApiError({
        ...failure,
        errorCategory: "DATA_CONFLICT",
        message: "ham backend mesajı",
      }));
      readWorkDetail.mockResolvedValueOnce(detail);

      await expect(workDetailAction(assignmentId, {
        type: "checkpoint",
        kind: failure.status === 409 ? "check-in" : "check-out",
        point: null,
      })).resolves.toEqual({
        status: "error",
        errorCode: failure.errorCode,
        httpStatus: failure.status,
        detail,
      });
      expect(readWorkDetail).toHaveBeenCalledWith(assignmentId);
    }
  });

  it("iptal, uyuşmazlık ve değerlendirmeyi doğrulanmış dar komutlarla çalıştırır", async () => {
    await workDetailAction(assignmentId, { type: "cancel", reason: "  Programım değişti  " });
    await workDetailAction(assignmentId, { type: "dispute", reason: "  Süre yanlış  " });
    await workDetailAction(assignmentId, { type: "review", rating: 5, comment: "  Harikaydı  " });

    expect(cancelAssignment).toHaveBeenCalledWith(assignmentId, "Programım değişti");
    expect(createAssignmentDispute).toHaveBeenCalledWith(assignmentId, "Süre yanlış");
    expect(createAssignmentReview).toHaveBeenCalledWith(assignmentId, 5, "Harikaydı");
    expect(readWorkDetail).toHaveBeenCalledTimes(3);
  });

  it("uyuşmazlık açılıp tek kanıt yüklenemezse güncel kaydı ve uyarıyı döndürür", async () => {
    createAssignmentDisputeWithEvidence.mockResolvedValueOnce({
      disputeId: "dispute-1",
      uploadedCount: 0,
      failedCount: 1,
    });
    const files = [new File(["png"], "vardiya.png", { type: "image/png" })];

    await expect(workDetailAction(assignmentId, {
      type: "dispute",
      reason: "  Süre yanlış  ",
      evidence: files,
    })).resolves.toEqual({
      detail,
      feedback: {
        kind: "warning",
        message: "Uyuşmazlık açıldı. 0 kanıt yüklendi, 1 kanıt yüklenemedi.",
      },
      status: "done",
    });
    expect(createAssignmentDisputeWithEvidence).toHaveBeenCalledWith(
      assignmentId,
      "Süre yanlış",
      files,
    );
  });

  it("bir Server Action komutunda birden fazla kanıtı kabul etmez", async () => {
    const files = [
      new File(["png"], "vardiya.png", { type: "image/png" }),
      new File(["pdf"], "tutanak.pdf", { type: "application/pdf" }),
    ];

    await expect(workDetailAction(assignmentId, {
      type: "dispute",
      reason: "Süre yanlış",
      evidence: files,
    })).resolves.toEqual({
      status: "error",
      errorCode: "DISPUTE_EVIDENCE_TOO_MANY",
      httpStatus: 400,
    });
    expect(createAssignmentDisputeWithEvidence).not.toHaveBeenCalled();
  });

  it.each([
    [new File([], "bos.pdf", { type: "application/pdf" }), "DISPUTE_EVIDENCE_EMPTY"],
    [new File([new Uint8Array(10 * 1024 * 1024 + 1)], "buyuk.pdf", { type: "application/pdf" }), "DISPUTE_EVIDENCE_TOO_LARGE"],
    [new File(["veri"], "pdf", { type: "application/pdf" }), "STORAGE_UNSUPPORTED_TYPE"],
  ])("geçersiz kanıt komutunda dosya hata kodunu korur: %s", async (file, errorCode) => {
    await expect(workDetailAction(assignmentId, {
      type: "dispute",
      reason: "Süre yanlış",
      evidence: [file],
    })).resolves.toEqual({ status: "error", errorCode, httpStatus: 400 });
    expect(createAssignmentDisputeWithEvidence).not.toHaveBeenCalled();
  });

  it("açık uyuşmazlığa sonradan kanıt ekler", async () => {
    const disputeId = "8b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f6a";
    const files = [new File(["pdf"], "tutanak.pdf", { type: "application/pdf" })];
    uploadAssignmentDisputeEvidence.mockResolvedValueOnce({
      disputeId,
      uploadedCount: 1,
      failedCount: 0,
    });

    await expect(workDetailAction(assignmentId, {
      type: "evidence",
      disputeId,
      evidence: files,
    })).resolves.toEqual({
      status: "done",
      detail,
      feedback: { kind: "notice", message: "1 kanıt dosyası yüklendi." },
    });
    expect(uploadAssignmentDisputeEvidence).toHaveBeenCalledWith(disputeId, files);
  });

  it("geçersiz kimlik, koordinat ve form değerlerini backend'e taşımaz", async () => {
    const submissions = [
      ["../other", { type: "refresh" }],
      [assignmentId, { type: "checkpoint", kind: "check-in", point: { latitude: 91, longitude: 29 } }],
      [assignmentId, { type: "cancel", reason: " " }],
      [assignmentId, { type: "dispute", reason: "x".repeat(2001) }],
      [assignmentId, { type: "review", rating: 6, comment: "" }],
      [assignmentId, { type: "seat", shuttleId: "../x", stopId: "cccccccc-cccc-4ccc-8ccc-000000000011" }],
      [assignmentId, { type: "seat", shuttleId: "cccccccc-cccc-4ccc-8ccc-000000000001", stopId: 7 as unknown as string }],
    ] as const;

    for (const [id, command] of submissions) {
      await expect(workDetailAction(id, command)).resolves.toEqual({
        status: "error",
        errorCode: "VALIDATION_FAILED",
        httpStatus: 400,
      });
    }

    expect(readWorkDetail).not.toHaveBeenCalled();
    expect(checkpoint).not.toHaveBeenCalled();
    expect(cancelAssignment).not.toHaveBeenCalled();
    expect(selectSeat).not.toHaveBeenCalled();
  });

  it("koltuk seçimini servis ve durak kimliğiyle gönderir, ekranı sunucu gerçeğiyle tazeler (200)", async () => {
    const seat = { shuttleId: "cccccccc-cccc-4ccc-8ccc-000000000001", stopId: "cccccccc-cccc-4ccc-8ccc-000000000011" };

    await expect(workDetailAction(assignmentId, { type: "seat", ...seat })).resolves.toEqual({
      status: "done",
      detail,
    });

    expect(selectSeat).toHaveBeenCalledWith(assignmentId, seat);
    expect(readWorkDetail).toHaveBeenCalledWith(assignmentId);
  });

  it("dolu serviste 409'u kodla bırakır ve güncel doluluğu yeniden okur", async () => {
    selectSeat.mockRejectedValueOnce(
      new ApiError({
        status: 409,
        errorCode: "TRANSPORT_SHUTTLE_FULL",
        errorCategory: "DATA_CONFLICT",
        message: "ham backend mesajı",
      }),
    );

    const result = await workDetailAction(assignmentId, {
      type: "seat",
      shuttleId: "cccccccc-cccc-4ccc-8ccc-000000000001",
      stopId: "cccccccc-cccc-4ccc-8ccc-000000000011",
    });

    expect(result).toEqual({ status: "error", errorCode: "TRANSPORT_SHUTTLE_FULL", httpStatus: 409, detail });
    expect(JSON.stringify(result)).not.toContain("ham backend mesajı");
  });
});

describe("iş ayrıntısından konuşma açma action'ı", () => {
  const jobId = "9c1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f60";

  beforeEach(() => {
    vi.clearAllMocks();
    requireSessionForCurrentPath.mockResolvedValue({});
  });

  it("konuşma kimliği gelince çalışan mesaj kabuğuna yönlendirir", async () => {
    // `redirect` istisnayla çalışıyor ve bu istisna `try` dışında atılmalı;
    // yönlendirme bir backend hatası gibi yakalansaydı kullanıcı sayfada kalırdı.
    openWorkerConversation.mockResolvedValue("55555555-5555-4555-8555-555555555555");

    await expect(workConversationAction(jobId, { status: "idle" }, new FormData()))
      .rejects.toMatchObject({
        digest: expect.stringContaining(";/panel/mesajlar/55555555-5555-4555-8555-555555555555;"),
      });
    expect(openWorkerConversation).toHaveBeenCalledWith(jobId);
  });

  it("ödeme ve pencere reddini kodla ekrana bırakır, yönlendirmez", async () => {
    // Kapı (`messagingAvailable`) düğmeyi önden kapatıyor; buraya karar
    // bayatladığında düşülür ve metin kataloğdan `errorCode` ile seçilir.
    for (const [status, errorCode] of [
      [403, "MESSAGING_PAYMENT_REQUIRED"],
      [409, "MESSAGING_WINDOW_CLOSED"],
    ] as const) {
      openWorkerConversation.mockRejectedValueOnce(
        new ApiError({ status, errorCode, errorCategory: "ACCESS_DENIED", message: "" }),
      );

      await expect(workConversationAction(jobId, { status: "idle" }, new FormData()))
        .resolves.toEqual({ status: "error", errorCode, httpStatus: status });
    }
  });

  it("UUID olmayan ilan kimliğiyle backend'e çıkmaz", async () => {
    await expect(workConversationAction("../x", { status: "idle" }, new FormData()))
      .resolves.toEqual({ status: "error", errorCode: "VALIDATION_FAILED", httpStatus: 400 });
    expect(openWorkerConversation).not.toHaveBeenCalled();
  });
});
