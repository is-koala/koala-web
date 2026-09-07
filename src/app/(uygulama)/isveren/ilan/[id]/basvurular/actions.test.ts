import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/server/api/errors";

const requireSessionForCurrentPath = vi.hoisted(() => vi.fn());
const readApplicantDossier = vi.hoisted(() => vi.fn());
const readTalentPoolMembership = vi.hoisted(() => vi.fn());
const saveToTalentPool = vi.hoisted(() => vi.fn());
const removeFromTalentPool = vi.hoisted(() => vi.fn());
const openApplicantConversation = vi.hoisted(() => vi.fn());
const revalidatePath = vi.hoisted(() => vi.fn());
const redirect = vi.hoisted(() =>
  vi.fn((target: string) => {
    throw new Error(`NEXT_REDIRECT:${target}`);
  }),
);

vi.mock("@/server/session/guard", () => ({ requireSessionForCurrentPath }));
vi.mock("@/server/applications/employer-review", () => ({
  readApplicantDossier,
  readTalentPoolMembership,
  saveToTalentPool,
  removeFromTalentPool,
  openApplicantConversation,
}));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({ redirect, unstable_rethrow: vi.fn() }));

import {
  applicantConversationAction,
  applicantDossierAction,
  applicantTalentPoolAction,
} from "./actions";

const workerId = "3b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f6e";
const jobId = "11111111-1111-4111-8111-111111111111";

describe("aday inceleme action'ları", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireSessionForCurrentPath.mockResolvedValue({});
    readTalentPoolMembership.mockResolvedValue(new Set([workerId]));
  });

  it("aday dosyasını kimlikle birlikte döndürür", async () => {
    const dossier = { profile: { id: workerId }, ratingSummary: null, reviews: [] };
    readApplicantDossier.mockResolvedValue(dossier);
    const form = new FormData();
    form.set("userId", workerId);

    await expect(applicantDossierAction({ status: "idle" }, form)).resolves.toEqual({
      status: "done",
      userId: workerId,
      dossier,
    });
  });

  it("UUID olmayan aday kimliğini backend'e hiç sormaz", async () => {
    const form = new FormData();
    form.set("userId", "../users/me");

    await expect(applicantDossierAction({ status: "idle" }, form)).resolves.toEqual({
      status: "error",
      userId: "",
      errorCode: "VALIDATION_FAILED",
      httpStatus: 400,
    });
    expect(readApplicantDossier).not.toHaveBeenCalled();
  });

  it("dosya okunamadığında hatayı adayın kimliğiyle taşır", async () => {
    // Kimlik olmadan hata kartı hangi kartın altında çizileceğini bilemezdi.
    readApplicantDossier.mockRejectedValue(
      new ApiError({ status: 404, errorCode: "USER_NOT_FOUND_BY_ID", errorCategory: "RESOURCE_NOT_FOUND", message: "" }),
    );
    const form = new FormData();
    form.set("userId", workerId);

    await expect(applicantDossierAction({ status: "idle" }, form)).resolves.toEqual({
      status: "error",
      userId: workerId,
      errorCode: "USER_NOT_FOUND_BY_ID",
      httpStatus: 404,
    });
  });

  it("havuza eklemeden sonra güncel üyelik kümesini geri taşır", async () => {
    const form = new FormData();
    form.set("workerId", workerId);
    form.set("operation", "add");
    form.set("note", "  Hızlı öğreniyor.  ");

    await expect(applicantTalentPoolAction({ status: "idle" }, form)).resolves.toEqual({
      status: "done",
      workerIds: [workerId],
    });
    expect(saveToTalentPool).toHaveBeenCalledWith(workerId, "  Hızlı öğreniyor.  ");
    expect(revalidatePath).toHaveBeenCalledWith("/isveren/yetenek-havuzu");
  });

  it("havuzdan çıkarmayı DELETE koluna yollar", async () => {
    readTalentPoolMembership.mockResolvedValue(new Set<string>());
    const form = new FormData();
    form.set("workerId", workerId);
    form.set("operation", "remove");

    await expect(applicantTalentPoolAction({ status: "idle" }, form)).resolves.toEqual({
      status: "done",
      workerIds: [],
    });
    expect(removeFromTalentPool).toHaveBeenCalledWith(workerId);
    expect(saveToTalentPool).not.toHaveBeenCalled();
  });

  it("tanınmayan havuz işlemini backend'e hiç sormaz", async () => {
    const form = new FormData();
    form.set("workerId", workerId);
    form.set("operation", "drop");

    await expect(applicantTalentPoolAction({ status: "idle" }, form)).resolves.toEqual({
      status: "error",
      errorCode: "VALIDATION_FAILED",
      httpStatus: 400,
    });
    expect(saveToTalentPool).not.toHaveBeenCalled();
    expect(removeFromTalentPool).not.toHaveBeenCalled();
  });

  it("havuz reddinde bilinen üyeliği kaybetmez", async () => {
    saveToTalentPool.mockRejectedValue(
      new ApiError({ status: 400, errorCode: "TALENT_CANNOT_ADD_SELF", errorCategory: "VALIDATION_FAILED", message: "" }),
    );
    const form = new FormData();
    form.set("workerId", workerId);
    form.set("operation", "add");

    await expect(applicantTalentPoolAction({ status: "done", workerIds: ["x"] }, form))
      .resolves.toEqual({
        status: "error",
        errorCode: "TALENT_CANNOT_ADD_SELF",
        httpStatus: 400,
        workerIds: ["x"],
      });
  });

  it("konuşmayı açıp işveren mesaj kabuğuna yönlendirir", async () => {
    openApplicantConversation.mockResolvedValue("conversation-1");
    const form = new FormData();
    form.set("jobId", jobId);
    form.set("workerId", workerId);

    await expect(applicantConversationAction({ status: "idle" }, form)).rejects.toThrow(
      "NEXT_REDIRECT:/isveren/mesajlar/conversation-1",
    );
    expect(openApplicantConversation).toHaveBeenCalledWith(jobId, workerId);
  });

  it("konuşma açılamadığında yönlendirmez, kodu ekrana bırakır", async () => {
    openApplicantConversation.mockRejectedValue(
      new ApiError({
        status: 403,
        errorCode: "MESSAGING_NO_RELATIONSHIP_WITH_JOB",
        errorCategory: "ACCESS_DENIED",
        message: "",
      }),
    );
    const form = new FormData();
    form.set("jobId", jobId);
    form.set("workerId", workerId);

    await expect(applicantConversationAction({ status: "idle" }, form)).resolves.toEqual({
      status: "error",
      errorCode: "MESSAGING_NO_RELATIONSHIP_WITH_JOB",
      httpStatus: 403,
    });
    expect(redirect).not.toHaveBeenCalled();
  });
});
