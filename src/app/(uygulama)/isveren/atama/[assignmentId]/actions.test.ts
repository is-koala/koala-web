import { beforeEach, describe, expect, it, vi } from "vitest";

const requireSessionForCurrentPath = vi.hoisted(() => vi.fn());
const cancelAssignment = vi.hoisted(() => vi.fn());
const createAssignmentDispute = vi.hoisted(() => vi.fn());
const revalidatePath = vi.hoisted(() => vi.fn());

vi.mock("@/server/session/guard", () => ({ requireSessionForCurrentPath }));
vi.mock("@/server/assignments/resolution", () => ({
  cancelAssignment,
  createAssignmentDispute,
}));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({ unstable_rethrow: vi.fn() }));

import { employerResolutionAction } from "./actions";

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
      .resolves.toEqual({ status: "done", message: "Atama iptal edildi. İade talebi alındı." });
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

  it("bozuk kimlik ve boş nedeni backend'e göndermez", async () => {
    const form = new FormData();
    form.set("operation", "cancel");
    form.set("reason", " ");

    await expect(employerResolutionAction("../jobs", { status: "idle" }, form))
      .resolves.toEqual({ status: "error", errorCode: "VALIDATION_FAILED", httpStatus: 400 });
    expect(cancelAssignment).not.toHaveBeenCalled();
  });
});

