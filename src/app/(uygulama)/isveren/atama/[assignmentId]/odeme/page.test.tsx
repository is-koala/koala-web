import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

const enterShell = vi.hoisted(() => vi.fn());
const readEmployerAssignment = vi.hoisted(() => vi.fn());
const fetchPriceQuote = vi.hoisted(() => vi.fn());
const viewerGates = vi.hoisted(() => vi.fn());

vi.mock("@/server/session/viewer", () => ({ enterShell }));
vi.mock("@/server/payments/payments", () => ({ readEmployerAssignment }));
vi.mock("@/server/jobs/jobs", () => ({ fetchPriceQuote }));
vi.mock("@/server/session/gates", () => ({ viewerGates }));
vi.mock("@/app/(uygulama)/shell", () => ({ ShellGate: ({ children }: { children: React.ReactNode }) => children }));

import { CheckoutPage } from "./page";

const assignmentId = "3b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f6e";
const pricing = {
  pricingVersion: "2026-09-v1",
  currency: "TRY",
  workerPayout: "1500.50",
  serviceFeeRate: "0.075",
  serviceFeeAmount: "112.54",
  employerTotal: "1613.04",
};

beforeEach(() => {
  vi.clearAllMocks();
  enterShell.mockResolvedValue({
    viewer: { identityVerified: true, hasIdentityNumber: false, hasAddress: false },
    failure: null,
  });
  viewerGates.mockReturnValue({
    individualPayment: {
      open: false,
      blockedBy: ["identityNumber", "individualBillingAddress"],
    },
  });
  readEmployerAssignment.mockResolvedValue({
    id: assignmentId,
    title: "Etkinlik görevlisi",
    workerName: "Ayşe Yılmaz",
    employerType: "INDIVIDUAL",
    status: "CONFIRMED",
    paymentStatus: "PENDING_COLLECTION",
    pricing,
  });
  fetchPriceQuote.mockResolvedValue(pricing);
});

it("ödeme öncesinde backend fiyat teklifini ve eksik ön koşulları birlikte gösterir", async () => {
  render(await CheckoutPage({ params: Promise.resolve({ assignmentId }) }));

  expect(fetchPriceQuote).toHaveBeenCalledWith("1500.50");
  expect(screen.getByText("1.613,04 ₺")).toBeVisible();
  expect(screen.getByText("Kimlik numaran hesabında kayıtlı değil")).toBeVisible();
  expect(screen.getByText("Fatura adresin eksik")).toBeVisible();
  expect(screen.getByRole("button", { name: "Iyzico ile güvenli öde" })).toBeDisabled();
});
