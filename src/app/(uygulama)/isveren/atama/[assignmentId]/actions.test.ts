import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/server/api/errors";

const requireSessionForCurrentPath = vi.hoisted(() => vi.fn());
const cancelAssignment = vi.hoisted(() => vi.fn());
const createAssignmentDispute = vi.hoisted(() => vi.fn());
const createAssignmentDisputeWithEvidence = vi.hoisted(() => vi.fn());
const uploadAssignmentDisputeEvidence = vi.hoisted(() => vi.fn());
const completeAssignment = vi.hoisted(() => vi.fn());
const revalidatePath = vi.hoisted(() => vi.fn());
const openApplicantConversation = vi.hoisted(() => vi.fn());
const redirect = vi.hoisted(() =>
  vi.fn((target: string) => {
    throw new Error(`NEXT_REDIRECT:${target}`);
  }),
);

vi.mock("@/server/session/guard", () => ({ requireSessionForCurrentPath }));
vi.mock("@/server/assignments/resolution", () => ({
  cancelAssignment,
  createAssignmentDispute,
  createAssignmentDisputeWithEvidence,
  uploadAssignmentDisputeEvidence,
}));
vi.mock("@/server/assignments/employer-tracking", () => ({ completeAssignment }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/server/applications/employer-review", () => ({ openApplicantConversation }));
vi.mock("next/navigation", () => ({ redirect, unstable_rethrow: vi.fn() }));

import {
  completeAssignmentAction,
  employerConversationAction,
  employerResolutionAction,
} from "./actions";

const assignmentId = "3b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f6e";

describe("işveren atama sonuçlandırma action'ı", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireSessionForCurrentPath.mockResolvedValue({});
  });

  it("iptal nedenini temizleyip atama görünümünü yeniler", async () => {
    const form = new FormData();
    form.set("operation", "cancel");
    form.set("reason", "  Plan değişti  ");

    await expect(employerResolutionAction(assignmentId, { status: "idle" }, form))
      .resolves.toEqual({ status: "done", message: "Atama iptal edildi. Güncel iade durumu sayfada gösteriliyor." });
    expect(cancelAssignment).toHaveBeenCalledWith(assignmentId, "Plan değişti");
    expect(revalidatePath).toHaveBeenCalledWith(`/isveren/atama/${assignmentId}`);
  });

  it("uyuşmazlığı dar gerekçe gövdesiyle açar", async () => {
    const form = new FormData();
    form.set("operation", "dispute");
    form.set("reason", "Süre kaydı yanlış");

    await expect(employerResolutionAction(assignmentId, { status: "idle" }, form))
      .resolves.toEqual({ status: "done", message: "Uyuşmazlık kaydınız alındı." });
    expect(createAssignmentDispute).toHaveBeenCalledWith(assignmentId, "Süre kaydı yanlış");
  });

  it("uyuşmazlık açılıp tek kanıt yüklenemezse kaydı yenileyip kısmi sonucu açıklar", async () => {
    createAssignmentDisputeWithEvidence.mockResolvedValueOnce({
      disputeId: "dispute-1",
      uploadedCount: 0,
      failedCount: 1,
    });
    const form = new FormData();
    form.set("operation", "dispute");
    form.set("reason", "Süre kaydı yanlış");
    form.append("evidence", new File(["png"], "vardiya.png", { type: "image/png" }));

    await expect(employerResolutionAction(assignmentId, { status: "idle" }, form))
      .resolves.toEqual({
        status: "partial",
        message: "Uyuşmazlık açıldı. 0 kanıt yüklendi, 1 kanıt yüklenemedi.",
      });
    expect(createAssignmentDisputeWithEvidence).toHaveBeenCalledWith(
      assignmentId,
      "Süre kaydı yanlış",
      [expect.objectContaining({ name: "vardiya.png" })],
    );
    expect(revalidatePath).toHaveBeenCalledWith(`/isveren/atama/${assignmentId}`);
  });

  it("bir Server Action isteğinde birden fazla kanıtı kabul etmez", async () => {
    const form = new FormData();
    form.set("operation", "dispute");
    form.set("reason", "Süre kaydı yanlış");
    form.append("evidence", new File(["png"], "vardiya.png", { type: "image/png" }));
    form.append("evidence", new File(["pdf"], "tutanak.pdf", { type: "application/pdf" }));

    await expect(employerResolutionAction(assignmentId, { status: "idle" }, form))
      .resolves.toEqual({ status: "error", errorCode: "DISPUTE_EVIDENCE_TOO_MANY", httpStatus: 400 });
    expect(createAssignmentDisputeWithEvidence).not.toHaveBeenCalled();
  });

  it.each([
    [new File([], "bos.pdf", { type: "application/pdf" }), "DISPUTE_EVIDENCE_EMPTY"],
    [new File([new Uint8Array(10 * 1024 * 1024 + 1)], "buyuk.pdf", { type: "application/pdf" }), "DISPUTE_EVIDENCE_TOO_LARGE"],
    [new File(["veri"], "pdf", { type: "application/pdf" }), "STORAGE_UNSUPPORTED_TYPE"],
  ])("geçersiz kanıtı gerekçe hatası gibi göstermeden reddeder: %s", async (file, errorCode) => {
    const form = new FormData();
    form.set("operation", "dispute");
    form.set("reason", "Süre kaydı yanlış");
    form.append("evidence", file);

    await expect(employerResolutionAction(assignmentId, { status: "idle" }, form))
      .resolves.toEqual({ status: "error", errorCode, httpStatus: 400 });
    expect(createAssignmentDisputeWithEvidence).not.toHaveBeenCalled();
  });

  it("açık uyuşmazlığa sonradan kanıt ekler", async () => {
    const disputeId = "8b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f6a";
    uploadAssignmentDisputeEvidence.mockResolvedValueOnce({
      disputeId,
      uploadedCount: 1,
      failedCount: 0,
    });
    const form = new FormData();
    form.set("operation", "evidence");
    form.set("disputeId", disputeId);
    form.append("evidence", new File(["pdf"], "tutanak.pdf", { type: "application/pdf" }));

    await expect(employerResolutionAction(assignmentId, { status: "idle" }, form))
      .resolves.toEqual({ status: "done", message: "1 kanıt dosyası yüklendi." });
    expect(uploadAssignmentDisputeEvidence).toHaveBeenCalledWith(
      disputeId,
      [expect.objectContaining({ name: "tutanak.pdf" })],
    );
  });

  it("bozuk kimlik ve boş nedeni backend'e göndermez", async () => {
    const form = new FormData();
    form.set("operation", "cancel");
    form.set("reason", " ");

    await expect(employerResolutionAction("../jobs", { status: "idle" }, form))
      .resolves.toEqual({ status: "error", errorCode: "VALIDATION_FAILED", httpStatus: 400 });
    expect(cancelAssignment).not.toHaveBeenCalled();
  });

  it("durum yarışında hata kodunu koruyup atama görünümünü yeniler", async () => {
    cancelAssignment.mockRejectedValueOnce(new ApiError({
      status: 409,
      errorCode: "DISPUTE_BLOCKS_RELEASE",
      errorCategory: "DATA_CONFLICT",
      message: "ham backend mesajı",
    }));
    const form = new FormData();
    form.set("operation", "cancel");
    form.set("reason", "Plan değişti");

    await expect(employerResolutionAction(assignmentId, { status: "idle" }, form))
      .resolves.toEqual({
        status: "error",
        errorCode: "DISPUTE_BLOCKS_RELEASE",
        httpStatus: 409,
      });
    expect(revalidatePath).toHaveBeenCalledWith(`/isveren/atama/${assignmentId}`);
  });

  it("tamamlamayı gövdesiz gönderip atama görünümünü yeniler", async () => {
    await expect(completeAssignmentAction(assignmentId, { status: "idle" }, new FormData()))
      .resolves.toEqual({ status: "done" });
    expect(completeAssignment).toHaveBeenCalledWith(assignmentId);
    expect(revalidatePath).toHaveBeenCalledWith(`/isveren/atama/${assignmentId}`);
  });

  it("bozuk atama kimliğinde tamamlamayı backend'e hiç sormaz", async () => {
    await expect(completeAssignmentAction("../jobs", { status: "idle" }, new FormData()))
      .resolves.toEqual({ status: "error", errorCode: "VALIDATION_FAILED", httpStatus: 400 });
    expect(completeAssignment).not.toHaveBeenCalled();
  });

  it("tamamlama reddinde kodu taşır ve görünümü yine tazeler", async () => {
    // Redlerin ikisi de atamanın durumunun bu sırada değişmiş olmasından
    // gelebiliyor; kullanıcı hatayı okurken bayat bir ekran görmemeli.
    completeAssignment.mockRejectedValueOnce(new ApiError({
      status: 409,
      errorCode: "ASSIGNMENT_PAYMENT_NOT_SECURED",
      errorCategory: "DATA_CONFLICT",
      message: "ham backend mesajı",
    }));

    await expect(completeAssignmentAction(assignmentId, { status: "idle" }, new FormData()))
      .resolves.toEqual({
        status: "error",
        errorCode: "ASSIGNMENT_PAYMENT_NOT_SECURED",
        httpStatus: 409,
      });
    expect(revalidatePath).toHaveBeenCalledWith(`/isveren/atama/${assignmentId}`);
  });
});

describe("işveren atama ekranından konuşma açma action'ı", () => {
  const jobId = "9c1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f60";
  const workerId = "6d2c0e58-2f0a-4b1e-9c3d-7a8b9c0d1e2f";

  beforeEach(() => {
    vi.clearAllMocks();
    requireSessionForCurrentPath.mockResolvedValue({});
  });

  it("işçi kimliğini göndererek açar ve işveren mesaj kabuğuna yönlendirir", async () => {
    openApplicantConversation.mockResolvedValue("conversation-1");

    await expect(employerConversationAction(jobId, workerId, { status: "idle" }, new FormData()))
      .rejects.toThrow("NEXT_REDIRECT:/isveren/mesajlar/conversation-1");
    expect(openApplicantConversation).toHaveBeenCalledWith(jobId, workerId);
  });

  it("ödeme reddini kodla ekrana bırakır, yönlendirmez", async () => {
    openApplicantConversation.mockRejectedValue(
      new ApiError({
        status: 403,
        errorCode: "MESSAGING_PAYMENT_REQUIRED",
        errorCategory: "ACCESS_DENIED",
        message: "",
      }),
    );

    await expect(employerConversationAction(jobId, workerId, { status: "idle" }, new FormData()))
      .resolves.toEqual({ status: "error", errorCode: "MESSAGING_PAYMENT_REQUIRED", httpStatus: 403 });
    expect(redirect).not.toHaveBeenCalled();
  });

  it("işçi kimliği okunamayan atamada backend'e çıkmaz", async () => {
    // `MyAssignmentDto.worker.id` boş gelirse `workerId` parametresiz istek
    // işvereni kendisiyle konuşturur (`MessagingManager.java:91`).
    await expect(employerConversationAction(jobId, "", { status: "idle" }, new FormData()))
      .resolves.toEqual({ status: "error", errorCode: "VALIDATION_FAILED", httpStatus: 400 });
    expect(openApplicantConversation).not.toHaveBeenCalled();
  });
});
