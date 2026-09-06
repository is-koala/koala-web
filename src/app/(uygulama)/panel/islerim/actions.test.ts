import { beforeEach, describe, expect, it, vi } from "vitest";

import type { WorkerAssignmentPage } from "@/assignments/contract";
import { ApiError } from "@/server/api/errors";

import { readAssignmentAcceptanceAction, respondAssignmentAction } from "./actions";

const assignmentId = "3b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f6e";
const requireSessionForCurrentPath = vi.hoisted(() => vi.fn());
const readAssignmentAddress = vi.hoisted(() => vi.fn());
const readWorkerAssignments = vi.hoisted(() => vi.fn());
const respondToWorkerAssignment = vi.hoisted(() => vi.fn());

vi.mock("@/server/session/guard", () => ({ requireSessionForCurrentPath }));
vi.mock("@/server/assignments/assignments", () => ({
  readAssignmentAddress,
  readWorkerAssignments,
  respondToWorkerAssignment,
}));

const refreshedPage: WorkerAssignmentPage = {
  content: [],
  page: 0,
  size: 20,
  totalElements: 0,
  totalPages: 0,
  first: true,
  last: true,
};

function submission(decision: "accept" | "reject", currentPage = 0) {
  const formData = new FormData();
  formData.set("assignmentId", assignmentId);
  formData.set("decision", decision);
  formData.set("currentPage", String(currentPage));
  return formData;
}

describe("atama cevap action'ı", () => {
  beforeEach(() => vi.clearAllMocks());

  it("kabulü kaydeder ve sonucu tahmin etmek yerine listeyi yeniden okur", async () => {
    requireSessionForCurrentPath.mockResolvedValueOnce({ refreshToken: "refresh-placeholder" });
    respondToWorkerAssignment.mockResolvedValueOnce(undefined);
    readWorkerAssignments.mockResolvedValueOnce(refreshedPage);

    await expect(
      respondAssignmentAction({ status: "idle" }, submission("accept")),
    ).resolves.toEqual({ status: "done", assignments: refreshedPage });

    expect(respondToWorkerAssignment).toHaveBeenCalledWith(assignmentId, true);
    expect(readWorkerAssignments).toHaveBeenCalledWith(0);
    expect(respondToWorkerAssignment.mock.invocationCallOrder[0]).toBeLessThan(
      readWorkerAssignments.mock.invocationCallOrder[0],
    );
  });

  it("reddi accepted false olarak gönderir ve listeyi yeniden okur", async () => {
    requireSessionForCurrentPath.mockResolvedValueOnce({ refreshToken: "refresh-placeholder" });
    respondToWorkerAssignment.mockResolvedValueOnce(undefined);
    readWorkerAssignments.mockResolvedValueOnce(refreshedPage);

    await respondAssignmentAction({ status: "idle" }, submission("reject", 2));

    expect(respondToWorkerAssignment).toHaveBeenCalledWith(assignmentId, false);
    expect(readWorkerAssignments).toHaveBeenCalledWith(2);
  });

  it("oturum kapısı açılmadan hiçbir atamayı değiştirmez", async () => {
    requireSessionForCurrentPath.mockRejectedValueOnce(new Error("NEXT_REDIRECT"));

    await expect(
      respondAssignmentAction({ status: "idle" }, submission("accept")),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(respondToWorkerAssignment).not.toHaveBeenCalled();
    expect(readWorkerAssignments).not.toHaveBeenCalled();
  });

  it("ikinci yanıtta hata olursa daha önce yeniden okunan listeyi korur", async () => {
    requireSessionForCurrentPath.mockResolvedValueOnce({ refreshToken: "refresh-placeholder" });
    respondToWorkerAssignment.mockRejectedValueOnce(
      new ApiError({
        status: 409,
        errorCode: "JOB_ASSIGNMENT_ALREADY_ANSWERED",
        errorCategory: "DATA_CONFLICT",
        message: "Atama yanıtlandı.",
      }),
    );

    await expect(
      respondAssignmentAction(
        { status: "done", assignments: refreshedPage },
        submission("accept"),
      ),
    ).resolves.toEqual({
      status: "error",
      errorCode: "JOB_ASSIGNMENT_ALREADY_ANSWERED",
      httpStatus: 409,
      assignments: refreshedPage,
    });
  });

  it("oturum yenilemesinin yönlendirmesini hata kartına dönüştürmez", async () => {
    requireSessionForCurrentPath.mockResolvedValueOnce({ refreshToken: "refresh-placeholder" });
    const redirect = Object.assign(new Error("redirect"), {
      digest: "NEXT_REDIRECT;replace;/giris;307;",
    });
    respondToWorkerAssignment.mockRejectedValueOnce(redirect);

    await expect(
      respondAssignmentAction({ status: "idle" }, submission("accept")),
    ).rejects.toBe(redirect);
  });

  it("sayfa değişimini mutation yapmadan backend sayfasından okur", async () => {
    requireSessionForCurrentPath.mockResolvedValueOnce({ refreshToken: "refresh-placeholder" });
    readWorkerAssignments.mockResolvedValueOnce({ ...refreshedPage, page: 1 });
    const formData = new FormData();
    formData.set("decision", "page");
    formData.set("targetPage", "1");

    await expect(
      respondAssignmentAction({ status: "idle" }, formData),
    ).resolves.toEqual({ status: "done", assignments: { ...refreshedPage, page: 1 } });

    expect(readWorkerAssignments).toHaveBeenCalledWith(1);
    expect(respondToWorkerAssignment).not.toHaveBeenCalled();
  });

  it("kabul özeti için oturumdan sonra yalnız kesin adresi okur", async () => {
    const jobId = "9c1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f60";
    requireSessionForCurrentPath.mockResolvedValueOnce({ refreshToken: "refresh-placeholder" });
    readAssignmentAddress.mockResolvedValueOnce("Caferağa Mahallesi, Moda Caddesi No: 12/4");

    await expect(readAssignmentAcceptanceAction(assignmentId, jobId)).resolves.toEqual({
      status: "done",
      fullAddress: "Caferağa Mahallesi, Moda Caddesi No: 12/4",
    });

    expect(readAssignmentAddress).toHaveBeenCalledWith(jobId);
    expect(requireSessionForCurrentPath.mock.invocationCallOrder[0]).toBeLessThan(
      readAssignmentAddress.mock.invocationCallOrder[0],
    );
  });

  it("geçersiz kabul özeti kimliklerini backend'e taşımaz", async () => {
    requireSessionForCurrentPath.mockResolvedValueOnce({ refreshToken: "refresh-placeholder" });

    await expect(readAssignmentAcceptanceAction("../auth/login", "not-a-job")).resolves.toEqual({
      status: "error",
      errorCode: "VALIDATION_FAILED",
      httpStatus: 400,
    });
    expect(readAssignmentAddress).not.toHaveBeenCalled();
  });
});
