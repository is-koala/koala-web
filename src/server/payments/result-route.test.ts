import { beforeEach, expect, it, vi } from "vitest";

const readSession = vi.hoisted(() => vi.fn());
const readPaymentReconciliation = vi.hoisted(() => vi.fn());
const unstable_rethrow = vi.hoisted(() => vi.fn());

vi.mock("@/server/session/session", () => ({ readSession }));
vi.mock("./payments", () => ({ readPaymentReconciliation }));
vi.mock("next/navigation", () => ({ unstable_rethrow }));

import { readPaymentResultPoll } from "./result-route";

const assignmentId = "3b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f6e";

beforeEach(() => {
  vi.clearAllMocks();
  readSession.mockResolvedValue({ refreshToken: "refresh-placeholder" });
  unstable_rethrow.mockImplementation(() => undefined);
});

it("Next kontrol akışı hatasını genel ödeme hatasına dönüştürmez", async () => {
  const controlFlowError = new Error("NEXT_CONTROL_FLOW");
  unstable_rethrow.mockImplementation((error) => {
    if (error === controlFlowError) throw error;
  });
  readPaymentReconciliation.mockRejectedValue(controlFlowError);

  await expect(readPaymentResultPoll(assignmentId)).rejects.toBe(controlFlowError);
  expect(unstable_rethrow).toHaveBeenCalledWith(controlFlowError);
});

it("oturumsuz poll isteğini backend'e çıkmadan reddeder", async () => {
  readSession.mockResolvedValue({ refreshToken: null });
  await expect(readPaymentResultPoll(assignmentId)).resolves.toEqual({
    status: 401,
    body: { status: "error", errorCode: "AUTHENTICATION_REQUIRED", httpStatus: 401 },
  });
  expect(readPaymentReconciliation).not.toHaveBeenCalled();
});

it("finansal sonucu açmadan yalnız pending veya resolved döndürür", async () => {
  readPaymentReconciliation
    .mockResolvedValueOnce({ assignment: { id: assignmentId }, resolution: "pending" })
    .mockResolvedValueOnce({ assignment: { id: assignmentId }, resolution: "released" });

  await expect(readPaymentResultPoll(assignmentId)).resolves.toEqual({
    status: 200,
    body: { status: "pending" },
  });
  await expect(readPaymentResultPoll(assignmentId)).resolves.toEqual({
    status: 200,
    body: { status: "resolved" },
  });
});

it("işverene ait olmayan atamayı bulunamadı olarak döndürür", async () => {
  readPaymentReconciliation.mockResolvedValue({ assignment: null, resolution: "pending" });
  await expect(readPaymentResultPoll(assignmentId)).resolves.toMatchObject({
    status: 404,
    body: { status: "error", errorCode: "PAYMENT_ASSIGNMENT_NOT_FOUND" },
  });
});
