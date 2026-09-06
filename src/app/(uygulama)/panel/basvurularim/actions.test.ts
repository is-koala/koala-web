import { beforeEach, describe, expect, it, vi } from "vitest";

import type { WorkerApplicationPage } from "@/applications/contract";
import { ApiError } from "@/server/api/errors";

import { withdrawApplicationAction } from "./actions";

const applicationId = "3b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f6e";
const requireSessionForCurrentPath = vi.hoisted(() => vi.fn());
const readWorkerApplications = vi.hoisted(() => vi.fn());
const withdrawWorkerApplication = vi.hoisted(() => vi.fn());

vi.mock("@/server/session/guard", () => ({ requireSessionForCurrentPath }));
vi.mock("@/server/applications/applications", () => ({
  readWorkerApplications,
  withdrawWorkerApplication,
}));

const refreshedPage: WorkerApplicationPage = {
  content: [],
  page: 1,
  size: 20,
  totalElements: 0,
  totalPages: 0,
  first: false,
  last: true,
};

function submission(overrides: Record<string, string> = {}) {
  const formData = new FormData();
  formData.set("applicationId", applicationId);
  formData.set("filter", "REJECTED");
  formData.set("page", "1");
  for (const [name, value] of Object.entries(overrides)) formData.set(name, value);
  return formData;
}

describe("başvuru geri çekme action'ı", () => {
  beforeEach(() => vi.clearAllMocks());

  it("oturumdan sonra geri çeker ve aynı URL durumunu yeniden okur", async () => {
    requireSessionForCurrentPath.mockResolvedValueOnce({ refreshToken: "refresh-placeholder" });
    withdrawWorkerApplication.mockResolvedValueOnce(undefined);
    readWorkerApplications.mockResolvedValueOnce(refreshedPage);

    await expect(
      withdrawApplicationAction({ status: "idle" }, submission()),
    ).resolves.toEqual({ status: "done", applications: refreshedPage });

    expect(withdrawWorkerApplication).toHaveBeenCalledWith(applicationId);
    expect(readWorkerApplications).toHaveBeenCalledWith({ status: "REJECTED", page: 1 });
  });

  it("409 olduğunda sunucu gerçeğini yeniden okuyup hata yanında gösterir", async () => {
    requireSessionForCurrentPath.mockResolvedValueOnce({ refreshToken: "refresh-placeholder" });
    withdrawWorkerApplication.mockRejectedValueOnce(new ApiError({
      status: 409,
      errorCode: "JOB_APPLICATION_INVALID_STATUS_TRANSITION",
      errorCategory: "DATA_CONFLICT",
      message: "Başvuru artık açık değil.",
    }));
    readWorkerApplications.mockResolvedValueOnce(refreshedPage);

    await expect(
      withdrawApplicationAction({ status: "idle" }, submission()),
    ).resolves.toEqual({
      status: "error",
      errorCode: "JOB_APPLICATION_INVALID_STATUS_TRANSITION",
      httpStatus: 409,
      applications: refreshedPage,
    });
    expect(readWorkerApplications).toHaveBeenCalledWith({ status: "REJECTED", page: 1 });
  });

  it("401/404/500 hatalarında ham mesajı değil yapılandırılmış durumu döndürür", async () => {
    requireSessionForCurrentPath.mockResolvedValue({ refreshToken: "refresh-placeholder" });
    for (const [status, errorCode] of [
      [401, "AUTHENTICATION_REQUIRED"],
      [404, "JOB_APPLICATION_NOT_FOUND"],
      [500, "UNEXPECTED_ERROR"],
    ] as const) {
      withdrawWorkerApplication.mockRejectedValueOnce(new ApiError({
        status,
        errorCode,
        errorCategory: "APPLICATION_ERROR",
        message: "Bu ham backend mesajı görünmemeli.",
      }));

      const result = await withdrawApplicationAction({ status: "idle" }, submission());
      expect(result).toEqual({ status: "error", errorCode, httpStatus: status });
      expect(JSON.stringify(result)).not.toContain("ham backend");
    }
  });

  it("geçersiz kimlik ve URL durumunu backend'e göndermez", async () => {
    requireSessionForCurrentPath.mockResolvedValue({ refreshToken: "refresh-placeholder" });

    await expect(
      withdrawApplicationAction(
        { status: "idle" },
        submission({ applicationId: "../auth/login", filter: "NOPE", page: "-1" }),
      ),
    ).resolves.toEqual({ status: "error", errorCode: "VALIDATION_FAILED", httpStatus: 400 });
    expect(withdrawWorkerApplication).not.toHaveBeenCalled();
  });
});
