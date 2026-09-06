import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

import type { EmployerAssignment } from "@/payments/contract";

const enterShell = vi.hoisted(() => vi.fn());
const readEmployerAssignment = vi.hoisted(() => vi.fn());
const readPaymentDetailsForAssignment = vi.hoisted(() => vi.fn());
const notFound = vi.hoisted(() => vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); }));

vi.mock("@/server/session/viewer", () => ({ enterShell }));
vi.mock("@/server/payments/payments", () => ({
  readEmployerAssignment,
  readPaymentDetailsForAssignment,
}));
vi.mock("@/app/(uygulama)/shell", () => ({ ShellGate: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("next/navigation", () => ({ notFound, unstable_rethrow: vi.fn() }));

import { PaymentHistoryContent, PaymentHistoryPage } from "./page";

const assignmentId = "3b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f6e";
const assignment = {
  id: assignmentId, title: "Etkinlik görevlisi",
} as EmployerAssignment;

beforeEach(() => {
  vi.clearAllMocks();
  enterShell.mockResolvedValue({ viewer: { id: "viewer-1" }, failure: null });
  readEmployerAssignment.mockResolvedValue(assignment);
});

it("ownership yoksa deneme ve dispute verisine çıkmadan notFound üretir", async () => {
  readEmployerAssignment.mockResolvedValue(null);
  await expect(PaymentHistoryPage({ params: Promise.resolve({ assignmentId }) }))
    .rejects.toThrow("NEXT_NOT_FOUND");
  expect(readPaymentDetailsForAssignment).not.toHaveBeenCalled();
});

it("aktif dispute ile başarısızlık nedenini ödeme geçmişinde birlikte gösterir", async () => {
  readPaymentDetailsForAssignment.mockResolvedValue({
    assignment,
    resolution: "failed",
    hasActiveDispute: true,
    attempts: [{
      id: "attempt-1", status: "FAILED", currency: "TRY", workerPayout: "100.00",
      serviceFeeRate: "0.10", serviceFeeAmount: "10.00", employerTotal: "110.00",
      completedAt: null, createdAt: "2026-09-06T18:00:00Z", failureMessage: null,
    }],
  });

  render(await PaymentHistoryContent({ assignment }));
  expect(screen.getByText(/emanetten çıkış bekler/i)).toBeVisible();
  expect(screen.getByText(/kartını ve banka doğrulamasını kontrol edip yeniden deneyebilirsin/i))
    .toBeVisible();
  expect(screen.queryByText("3DS reddedildi")).toBeNull();
});
