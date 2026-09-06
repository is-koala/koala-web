import { beforeEach, describe, expect, it, vi } from "vitest";

const createPaymentSession = vi.hoisted(() => vi.fn());
const readPaymentAttempts = vi.hoisted(() => vi.fn());
const requireSessionForCurrentPath = vi.hoisted(() => vi.fn());
const redirect = vi.hoisted(() => vi.fn());

vi.mock("@/server/payments/payments", () => ({ createPaymentSession, readPaymentAttempts }));
vi.mock("@/server/session/guard", () => ({ requireSessionForCurrentPath }));
vi.mock("next/navigation", () => ({
  redirect,
  unstable_rethrow: vi.fn(),
}));

import { startPaymentAction } from "./actions";

const assignmentId = "3b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f6e";
const pricing = {
  pricingVersion: "2026-09-v1",
  currency: "TRY",
  workerPayout: "1500.50",
  serviceFeeRate: "0.075",
  serviceFeeAmount: "112.54",
  employerTotal: "1613.04",
};

describe("ödeme başlatma action'ı", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireSessionForCurrentPath.mockResolvedValue({});
    readPaymentAttempts.mockResolvedValue([]);
  });

  it.each(["INITIATED", "IN_REVIEW"])(
    "%s denemesi kesinleşmeden ikinci ödeme oturumu açmaz",
    async (status) => {
      readPaymentAttempts.mockResolvedValue([{ status: "FAILED" }, { status }]);

      const result = await startPaymentAction(
        assignmentId,
        { status: "idle" },
        new FormData(),
      );

      expect(result).toEqual({
        status: "error",
        errorCode: "PAYMENT_ATTEMPT_IN_PROGRESS",
        httpStatus: 409,
      });
      expect(createPaymentSession).not.toHaveBeenCalled();
      expect(redirect).not.toHaveBeenCalled();
    },
  );

  it("izinli Iyzico adresine sunucuda doğruladıktan sonra yönlendirir", async () => {
    createPaymentSession.mockResolvedValue({
      paymentPageUrl: "https://sandbox-payment.iyzipay.com/checkout/token",
      pricing,
    });

    await startPaymentAction(assignmentId, { status: "idle" }, new FormData());

    expect(readPaymentAttempts.mock.invocationCallOrder[0])
      .toBeLessThan(createPaymentSession.mock.invocationCallOrder[0]);
    expect(redirect).toHaveBeenCalledWith(
      "https://sandbox-payment.iyzipay.com/checkout/token",
    );
  });

  it("beklenmeyen ana makineye yönlendirmez", async () => {
    createPaymentSession.mockResolvedValue({
      paymentPageUrl: "https://example.test/fake-checkout",
      pricing,
    });

    const result = await startPaymentAction(
      assignmentId,
      { status: "idle" },
      new FormData(),
    );

    expect(redirect).not.toHaveBeenCalled();
    expect(result).toEqual({
      status: "error",
      errorCode: "PAYMENT_PAGE_URL_REJECTED",
      httpStatus: 502,
    });
  });
});
