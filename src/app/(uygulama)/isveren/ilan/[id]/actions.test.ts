import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/server/api/errors";

const requireSessionForCurrentPath = vi.hoisted(() => vi.fn());
const closeJob = vi.hoisted(() => vi.fn());
const cancelJob = vi.hoisted(() => vi.fn());
const revalidatePath = vi.hoisted(() => vi.fn());
const readTransportPlan = vi.hoisted(() => vi.fn());
const writeTransportPlan = vi.hoisted(() => vi.fn());

vi.mock("@/server/session/guard", () => ({ requireSessionForCurrentPath }));
vi.mock("@/server/jobs/jobs", () => ({ cancelJob, closeJob }));
vi.mock("@/server/transport/transport", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/transport/transport")>()),
  readTransportPlan,
  writeTransportPlan,
}));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({ unstable_rethrow: vi.fn() }));

import { jobLifecycleAction, writeTransportPlanAction } from "./actions";

const jobId = "4d0a1e58-6a3c-4a3f-9a10-6a1c2d3e4f99";

function form(operation: string): FormData {
  const data = new FormData();
  data.set("operation", operation);
  return data;
}

describe("ilan yaşam döngüsü action'ı", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireSessionForCurrentPath.mockResolvedValue({});
  });

  it("kapatmayı ilanın kendi ucuna gönderip sayfayı tazeler", async () => {
    await expect(jobLifecycleAction(jobId, { status: "idle" }, form("close"))).resolves.toEqual({
      status: "done",
      operation: "close",
    });

    expect(closeJob).toHaveBeenCalledWith(jobId);
    expect(cancelJob).not.toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith(`/isveren/ilan/${jobId}`);
  });

  it("iptali kapatmayla karıştırmadan kendi ucuna gönderir", async () => {
    await expect(jobLifecycleAction(jobId, { status: "idle" }, form("cancel"))).resolves.toEqual({
      status: "done",
      operation: "cancel",
    });

    expect(cancelJob).toHaveBeenCalledWith(jobId);
    expect(closeJob).not.toHaveBeenCalled();
  });

  it("gövdeden gelen tanımsız bir geçişi backend'e hiç sormaz", async () => {
    // İstemci geçiş icat etmesin: `complete` bir ilan ucu değil ve gövde
    // tarayıcıdan geliyor.
    await expect(jobLifecycleAction(jobId, { status: "idle" }, form("complete"))).resolves.toEqual({
      status: "error",
      errorCode: "VALIDATION_FAILED",
      httpStatus: 400,
    });

    expect(closeJob).not.toHaveBeenCalled();
    expect(cancelJob).not.toHaveBeenCalled();
  });

  it("UUID olmayan kimliği backend'e hiç sormaz", async () => {
    await expect(
      jobLifecycleAction("../auth/login", { status: "idle" }, form("cancel")),
    ).resolves.toEqual({ status: "error", errorCode: "VALIDATION_FAILED", httpStatus: 400 });

    expect(cancelJob).not.toHaveBeenCalled();
  });

  it("oturumu her çağrıda yeniden okur", async () => {
    // Devre dışı bir düğmenin arkasındaki form yine gönderilebilir; kapı
    // istemcide değil burada.
    await jobLifecycleAction(jobId, { status: "idle" }, form("close"));

    expect(requireSessionForCurrentPath).toHaveBeenCalled();
  });

  it("canlı atama çakışmasında kodu koruyup sayfayı tazeler", async () => {
    cancelJob.mockRejectedValueOnce(
      new ApiError({
        status: 409,
        errorCode: "JOB_HAS_LIVE_ASSIGNMENT",
        errorCategory: "DATA_CONFLICT",
        message: "ham backend mesajı",
      }),
    );

    await expect(jobLifecycleAction(jobId, { status: "idle" }, form("cancel"))).resolves.toEqual({
      status: "error",
      errorCode: "JOB_HAS_LIVE_ASSIGNMENT",
      httpStatus: 409,
    });
    // Reddin nedeni ilanın durumu olabilir; kullanıcı güncel durumu görmeli.
    expect(revalidatePath).toHaveBeenCalledWith(`/isveren/ilan/${jobId}`);
  });

  it("durum yarışında ham backend mesajını taşımaz", async () => {
    closeJob.mockRejectedValueOnce(
      new ApiError({
        status: 409,
        errorCode: "JOB_NOT_OPEN",
        errorCategory: "DATA_CONFLICT",
        message: "ham backend mesajı",
      }),
    );

    const state = await jobLifecycleAction(jobId, { status: "idle" }, form("close"));

    expect(state).toEqual({ status: "error", errorCode: "JOB_NOT_OPEN", httpStatus: 409 });
    expect(JSON.stringify(state)).not.toContain("ham backend mesajı");
  });
});

describe("ulaşım planı action'ı", () => {
  const plan = { outboundMethod: "SELF", returnMethod: "NONE", allowanceAmount: null, allowanceNote: null, notes: null, shuttles: [], updatedAt: null };
  const draft = { outboundMethod: "SELF", returnMethod: "NONE", allowanceAmount: "", allowanceNote: "", notes: " Kapıda buluşalım ", shuttles: [] };

  function planForm(value: unknown = draft): FormData {
    const data = new FormData();
    data.set("transportPlan", JSON.stringify(value));
    return data;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    requireSessionForCurrentPath.mockResolvedValue({});
    writeTransportPlan.mockResolvedValue(plan);
  });

  it("gövdeyi süzüp ilanın ucuna yazar; ilan ve herkese açık sayfayı tazeler", async () => {
    await expect(writeTransportPlanAction(jobId, { status: "idle" }, planForm())).resolves.toEqual({
      status: "done",
      plan,
    });

    expect(writeTransportPlan).toHaveBeenCalledWith(jobId, {
      outboundMethod: "SELF",
      returnMethod: "NONE",
      allowanceAmount: null,
      allowanceNote: null,
      notes: "Kapıda buluşalım",
      shuttles: [],
    });
    expect(revalidatePath).toHaveBeenCalledWith(`/isveren/ilan/${jobId}`);
    expect(revalidatePath).toHaveBeenCalledWith(`/is-ilanlari/${jobId}`);
  });

  it("kural ihlalini ve bozuk gövdeyi backend'e taşımaz", async () => {
    await expect(
      writeTransportPlanAction(jobId, { status: "idle" }, planForm({ ...draft, returnMethod: "CASH_ALLOWANCE" })),
    ).resolves.toEqual({
      status: "error",
      errorCode: "VALIDATION_FAILED",
      httpStatus: 400,
      fieldErrors: { allowanceAmount: "Yol parası tutarını yazmalısın." },
    });
    await expect(writeTransportPlanAction(jobId, { status: "idle" }, new FormData())).resolves.toMatchObject({
      status: "error",
      errorCode: "VALIDATION_FAILED",
    });
    await expect(writeTransportPlanAction("../auth", { status: "idle" }, planForm())).resolves.toMatchObject({
      status: "error",
      errorCode: "VALIDATION_FAILED",
    });
    expect(writeTransportPlan).not.toHaveBeenCalled();
  });

  it("409'da kodu korur, ham mesajı taşımaz ve güncel planı yeniden okur", async () => {
    writeTransportPlan.mockRejectedValueOnce(
      new ApiError({
        status: 409,
        errorCode: "TRANSPORT_SHUTTLE_CAPACITY_BELOW_SEATS",
        errorCategory: "DATA_CONFLICT",
        message: "ham backend mesajı",
      }),
    );
    readTransportPlan.mockResolvedValueOnce(plan);

    const state = await writeTransportPlanAction(jobId, { status: "idle" }, planForm());

    expect(state).toEqual({
      status: "error",
      errorCode: "TRANSPORT_SHUTTLE_CAPACITY_BELOW_SEATS",
      httpStatus: 409,
      fieldErrors: undefined,
      plan,
    });
    expect(JSON.stringify(state)).not.toContain("ham backend mesajı");
    expect(readTransportPlan).toHaveBeenCalledWith(jobId);
  });

  it("400 alan hatalarını olduğu gibi taşır, planı yeniden okumaz", async () => {
    writeTransportPlan.mockRejectedValueOnce(
      new ApiError({
        status: 400,
        errorCode: "VALIDATION_FAILED",
        errorCategory: "VALIDATION",
        message: "ham",
        details: [{ field: "shuttles[0].plate", message: "Plaka en fazla 20 karakter." }],
      }),
    );

    await expect(writeTransportPlanAction(jobId, { status: "idle" }, planForm())).resolves.toEqual({
      status: "error",
      errorCode: "VALIDATION_FAILED",
      httpStatus: 400,
      fieldErrors: { "shuttles[0].plate": "Plaka en fazla 20 karakter." },
    });
    expect(readTransportPlan).not.toHaveBeenCalled();
  });

  it("oturumu her çağrıda yeniden okur", async () => {
    await writeTransportPlanAction(jobId, { status: "idle" }, planForm());

    expect(requireSessionForCurrentPath).toHaveBeenCalled();
  });
});
