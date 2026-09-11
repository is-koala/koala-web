import { beforeEach, describe, expect, it, vi } from "vitest";

import { idleFormState } from "@/lib/form-state";
import { ApiError } from "@/server/api/errors";

import { redirectTo } from "../../../../../tests/support/navigation";

import { applyToJobAction } from "./actions";

const createJobApplication = vi.hoisted(() => vi.fn());
const requireSessionForCurrentPath = vi.hoisted(() => vi.fn());
const currentGates = vi.hoisted(() => vi.fn());

vi.mock("@/server/jobs/jobs", () => ({ createJobApplication }));
vi.mock("@/server/session/guard", () => ({ requireSessionForCurrentPath }));
vi.mock("@/server/session/gates", () => ({ currentGates }));
vi.mock("next/navigation", async () => ({
  redirect: (await import("../../../../../tests/support/navigation")).throwingRedirect(),
  unstable_rethrow: (error: unknown) => {
    if (error instanceof Error && error.message.startsWith("NEXT_REDIRECT")) throw error;
  },
}));

const jobId = "9c1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f60";

describe("ilana başvuru action'ı", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireSessionForCurrentPath.mockResolvedValue({ refreshToken: "refresh-placeholder" });
    currentGates.mockResolvedValue({
      viewer: { identityVerified: true },
      failure: null,
      gates: { application: { open: true } },
    });
  });

  it("başarılı sunucu yanıtından sonra başvurularım ekranına gider", async () => {
    createJobApplication.mockResolvedValueOnce({
      id: "3b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f6e",
    });

    await expect(applyToJobAction(jobId, idleFormState, submission("Uygunum."))).rejects.toThrow(
      new Error(redirectTo("/panel/basvurularim")),
    );

    expect(createJobApplication).toHaveBeenCalledWith(jobId, "Uygunum.");
  });

  it("boş notu opsiyonel bırakır", async () => {
    createJobApplication.mockResolvedValueOnce({
      id: "3b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f6e",
    });

    await applyToJobAction(jobId, idleFormState, submission("   ")).catch(() => {});

    expect(createJobApplication).toHaveBeenCalledWith(jobId, undefined);
  });

  it("2000 karakteri aşan notu backend'e göndermeden alan hatası döndürür", async () => {
    const result = await applyToJobAction(jobId, idleFormState, submission("a".repeat(2001)));

    expect(result).toEqual({
      status: "error",
      errorCode: "VALIDATION_FAILED",
      httpStatus: 400,
      fieldErrors: { notes: "Başvuru notu en fazla 2000 karakter olabilir." },
    });
    expect(createJobApplication).not.toHaveBeenCalled();
  });

  it("geçersiz ilan kimliğini backend'e taşımaz", async () => {
    const result = await applyToJobAction("../applications", idleFormState, submission(""));

    expect(result).toMatchObject({ status: "error", errorCode: "JOB_NOT_FOUND", httpStatus: 404 });
    expect(createJobApplication).not.toHaveBeenCalled();
  });

  it("oturum kapısı açılmadan başvuru oluşturmaz", async () => {
    requireSessionForCurrentPath.mockRejectedValueOnce(new Error("NEXT_REDIRECT;/giris"));

    await expect(applyToJobAction(jobId, idleFormState, submission(""))).rejects.toThrow(
      "NEXT_REDIRECT",
    );
    expect(createJobApplication).not.toHaveBeenCalled();
  });

  it("kimlik kapısı kapalıyken isteği hiç göndermez", async () => {
    currentGates.mockResolvedValueOnce({
      viewer: { identityVerified: false },
      failure: null,
      gates: { application: { open: false, blockedBy: ["identityVerification"] } },
    });

    await expect(applyToJobAction(jobId, idleFormState, submission(""))).resolves.toEqual({
      status: "error",
      errorCode: "APPLICANT_IDENTITY_NOT_VERIFIED",
      httpStatus: 400,
    });
    expect(createJobApplication).not.toHaveBeenCalled();
  });

  it.each([
    [400, "JOB_APPLICATION_USER_CANNOT_APPLY_TO_OWN_JOB"],
    [401, "AUTHENTICATION_REQUIRED"],
    [404, "JOB_NOT_FOUND"],
    [409, "JOB_APPLICATION_USER_ALREADY_APPLIED_TO_JOB"],
    [400, "APPLICANT_IDENTITY_NOT_VERIFIED"],
    [400, "APPLICANT_ADDRESS_REQUIRED"],
    [400, "APPLICANT_BANK_ACCOUNT_REQUIRED"],
  ])("%i / %s backend hatasını yapılandırılmış durumda korur", async (status, errorCode) => {
    createJobApplication.mockRejectedValueOnce(
      new ApiError({
        status,
        errorCode,
        errorCategory: status === 409 ? "DATA_CONFLICT" : "VALIDATION_FAILED",
        message: "Ham backend mesajı",
      }),
    );

    await expect(applyToJobAction(jobId, idleFormState, submission(""))).resolves.toEqual({
      status: "error",
      errorCode,
      httpStatus: status,
      fieldErrors: undefined,
    });
  });

  it("201 zarfı başvuru kaydı taşımıyorsa başarı yönlendirmesi yapmaz", async () => {
    createJobApplication.mockResolvedValueOnce(null);

    await expect(applyToJobAction(jobId, idleFormState, submission(""))).resolves.toEqual({
      status: "error",
      errorCode: "UNEXPECTED",
      httpStatus: 500,
    });
  });
});

function submission(notes: string): FormData {
  const formData = new FormData();
  formData.set("notes", notes);
  return formData;
}
