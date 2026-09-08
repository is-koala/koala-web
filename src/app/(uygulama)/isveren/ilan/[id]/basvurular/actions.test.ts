import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/server/api/errors";

const requireSessionForCurrentPath = vi.hoisted(() => vi.fn());
const readApplicantDossier = vi.hoisted(() => vi.fn());
const readTalentPoolMembership = vi.hoisted(() => vi.fn());
const saveToTalentPool = vi.hoisted(() => vi.fn());
const removeFromTalentPool = vi.hoisted(() => vi.fn());
const openApplicantConversation = vi.hoisted(() => vi.fn());
const respondToApplication = vi.hoisted(() => vi.fn());
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
  respondToApplication,
}));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({ redirect, unstable_rethrow: vi.fn() }));

import {
  applicantConversationAction,
  applicantDecisionAction,
  applicantDossierAction,
  applicantTalentPoolAction,
} from "./actions";

const workerId = "3b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f6e";
const jobId = "11111111-1111-4111-8111-111111111111";
const applicationId = "22222222-2222-4222-8222-222222222222";

/** Karar formunun gövdesi; her alan ayrı ayrı bozulabilsin diye tek yerde. */
function decisionForm(fields: Record<string, string>): FormData {
  const form = new FormData();
  form.set("applicationId", applicationId);
  form.set("jobId", jobId);
  for (const [name, value] of Object.entries(fields)) form.set(name, value);
  return form;
}

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

describe("başvuru kabul/red action'ı", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireSessionForCurrentPath.mockResolvedValue({});
  });

  it("kabulü gönderip atama kimliğini ve tazelenen yolu geri taşır", async () => {
    respondToApplication.mockResolvedValue({ decision: "ACCEPTED", assignmentId: "assignment-1" });

    await expect(
      applicantDecisionAction({ status: "idle" }, decisionForm({ decision: "ACCEPTED" })),
    ).resolves.toEqual({
      status: "done",
      applicationId,
      outcome: { decision: "ACCEPTED", assignmentId: "assignment-1" },
    });

    expect(respondToApplication).toHaveBeenCalledWith({
      applicationId,
      decision: "ACCEPTED",
      rejectionReason: "",
    });
    // Liste sunucudan iniyor: tazelenmezse kart bir sonraki gezinmede yine
    // `APPLIED` görünür ve ikinci karara açık kalırdı.
    expect(revalidatePath).toHaveBeenCalledWith(
      `/isveren/ilan/${jobId}/basvurular`,
    );
  });

  it("oturum kapısını backend çağrısından önce geçer", async () => {
    // Kapı çağrıdan sonra sorulsaydı, oturumsuz bir istek geri alınamaz
    // kararı zaten göndermiş olurdu.
    const order: string[] = [];
    requireSessionForCurrentPath.mockImplementation(async () => {
      order.push("guard");
      return {};
    });
    respondToApplication.mockImplementation(async () => {
      order.push("respond");
      return { decision: "ACCEPTED", assignmentId: null };
    });

    await applicantDecisionAction({ status: "idle" }, decisionForm({ decision: "ACCEPTED" }));

    expect(order).toEqual(["guard", "respond"]);
  });

  it("oturum kapısı reddettiğinde kararı hiç göndermez", async () => {
    // `requireSessionForCurrentPath` yönlendirme atarak çalışıyor; eylem o
    // istisnayı yutmamalı ve sunucuya hiç gitmemeli.
    requireSessionForCurrentPath.mockRejectedValue(new Error("NEXT_REDIRECT:/giris"));

    await expect(
      applicantDecisionAction({ status: "idle" }, decisionForm({ decision: "ACCEPTED" })),
    ).rejects.toThrow("NEXT_REDIRECT:/giris");
    expect(respondToApplication).not.toHaveBeenCalled();
  });

  it("gerekçesiz reddi backend'e hiç sormaz", async () => {
    // Sözleşme alanı zorunlu tutmuyor: boş bırakılan gerekçe sunucuda `null`
    // olarak kalıcılaşır ve adayın okuyacağı tek açıklama kaybolurdu.
    await expect(
      applicantDecisionAction(
        { status: "idle" },
        decisionForm({ decision: "REJECTED", rejectionReason: "   " }),
      ),
    ).resolves.toEqual({
      status: "error",
      applicationId,
      errorCode: "DECISION_REASON_REQUIRED",
      httpStatus: 400,
    });
    expect(respondToApplication).not.toHaveBeenCalled();
  });

  it("gerekçeli reddi gönderir", async () => {
    respondToApplication.mockResolvedValue({ decision: "REJECTED", assignmentId: null });

    await expect(
      applicantDecisionAction(
        { status: "idle" },
        decisionForm({ decision: "REJECTED", rejectionReason: "Tarih uymuyor." }),
      ),
    ).resolves.toMatchObject({ status: "done", applicationId });

    expect(respondToApplication).toHaveBeenCalledWith({
      applicationId,
      decision: "REJECTED",
      rejectionReason: "Tarih uymuyor.",
    });
  });

  it("tanınmayan karar adını backend'e hiç sormaz", async () => {
    // Gövde tarayıcıdan geliyor. `WITHDRAWN` sunucuda geçerli bir
    // `ApplicationStatus` ama işverenin verebileceği bir karar değil.
    for (const decision of ["WITHDRAWN", "APPLIED", "accepted", ""]) {
      await expect(
        applicantDecisionAction({ status: "idle" }, decisionForm({ decision })),
      ).resolves.toMatchObject({ status: "error", errorCode: "VALIDATION_FAILED" });
    }

    expect(respondToApplication).not.toHaveBeenCalled();
  });

  it("UUID olmayan başvuru kimliğini yola hiç koymaz", async () => {
    const form = decisionForm({ decision: "ACCEPTED" });
    form.set("applicationId", "../job-applications/all");

    await expect(applicantDecisionAction({ status: "idle" }, form)).resolves.toEqual({
      status: "error",
      applicationId: "",
      errorCode: "VALIDATION_FAILED",
      httpStatus: 400,
    });
    expect(respondToApplication).not.toHaveBeenCalled();
  });

  it("UUID olmayan ilan kimliğinde tazeleme yolunu uydurmaz", async () => {
    const form = decisionForm({ decision: "ACCEPTED" });
    form.set("jobId", "..%2Fetc");

    await expect(applicantDecisionAction({ status: "idle" }, form)).resolves.toMatchObject({
      status: "error",
      errorCode: "VALIDATION_FAILED",
    });
    expect(respondToApplication).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("yetkisiz kullanıcının 404'ünü kodu ve kimliğiyle karta taşır", async () => {
    // Backend yetkisiz çağırana başvurunun varlığını sızdırmadan 404 veriyor
    // (`assertCurrentUserIsEmployerOf`). İstemci o kodu olduğu gibi taşır;
    // yerine bir yetki kuralı kopyalamak ikinci bir doğruluk kaynağı olurdu.
    respondToApplication.mockRejectedValue(
      new ApiError({
        status: 404,
        errorCode: "JOB_APPLICATION_NOT_FOUND",
        errorCategory: "NOT_FOUND",
        message: "Başvuru bulunamadı.",
      }),
    );

    await expect(
      applicantDecisionAction({ status: "idle" }, decisionForm({ decision: "ACCEPTED" })),
    ).resolves.toEqual({
      status: "error",
      applicationId,
      errorCode: "JOB_APPLICATION_NOT_FOUND",
      httpStatus: 404,
    });
    // Karar geçmediyse liste de tazelenmemeli: tazeleme kullanıcıya kararın
    // işlendiğini düşündürürdü.
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("ikinci kararın 409'unu kodu ile taşır", async () => {
    respondToApplication.mockRejectedValue(
      new ApiError({
        status: 409,
        errorCode: "JOB_APPLICATION_ALREADY_RESPONDED",
        errorCategory: "CONFLICT",
        message: "Bu başvuru daha önce yanıtlanmış.",
      }),
    );

    await expect(
      applicantDecisionAction({ status: "idle" }, decisionForm({ decision: "ACCEPTED" })),
    ).resolves.toMatchObject({
      status: "error",
      errorCode: "JOB_APPLICATION_ALREADY_RESPONDED",
      httpStatus: 409,
    });
  });
});
