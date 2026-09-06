import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { WorkerPayout } from "@/payments/payouts";

import { EarningsList } from "./earnings-list";

const assignmentId = "b1f0d24c-4c2f-4f6c-8a9e-5d3c1b0a7f6e";

function payout(overrides: Partial<WorkerPayout>): WorkerPayout {
  return {
    id: "a1f0d24c-4c2f-4f6c-8a9e-5d3c1b0a7f6e",
    assignmentId,
    amount: "1000.10",
    currency: "TRY",
    status: "COMPLETED",
    failureReason: null,
    completedAt: "2026-09-05T11:00:00Z",
    createdAt: "2026-09-05T10:30:00Z",
    ...overrides,
  };
}

describe("kazanç listesi", () => {
  it("tamamlanan ve bekleyen tutarları birbirine karıştırmadan toplar", () => {
    render(<EarningsList payouts={[
      payout({ id: "1", amount: "1000.10" }),
      payout({ id: "2", amount: "249.90" }),
      payout({ id: "3", amount: "100.05", status: "PENDING" }),
      payout({ id: "4", amount: "0.15", status: "PROCESSING" }),
      payout({ id: "5", amount: "800.00", status: "FAILED" }),
    ]} />);

    const completed = screen.getByTestId("completed-total");
    const pending = screen.getByTestId("pending-total");
    expect(completed).toHaveTextContent("₺1.250,00");
    expect(pending).toHaveTextContent("₺100,20");
    expect(pending).not.toHaveTextContent("₺900,20");
  });

  it("her durumu insan dilinde gösterir ve yalnız tamamlanana ödendi der", () => {
    render(<EarningsList payouts={[
      payout({ id: "1", status: "COMPLETED" }),
      payout({ id: "2", status: "PENDING" }),
      payout({ id: "3", status: "PROCESSING" }),
      payout({ id: "4", status: "UNKNOWN" }),
    ]} />);

    expect(screen.getByText("Ödendi")).toBeVisible();
    expect(screen.getByText("Aktarım bekliyor")).toBeVisible();
    expect(screen.getByText("Aktarılıyor")).toBeVisible();
    expect(screen.getByText("Durum güncelleniyor")).toBeVisible();
    expect(screen.getAllByText("Ödendi")).toHaveLength(1);
  });

  it("başarısız çıkışın nedenini, destek yolunu ve atama bağlantısını korur", () => {
    render(<EarningsList payouts={[
      payout({
        status: "FAILED",
        failureReason: "IBAN sahibi eşleşmedi",
        completedAt: null,
      }),
    ]} />);

    const row = screen.getByRole("listitem");
    expect(within(row).getByText("Aktarılamadı")).toBeVisible();
    expect(within(row).getByText("IBAN sahibi eşleşmedi")).toBeVisible();
    expect(within(row).getByRole("link", { name: "İşi görüntüle" })).toHaveAttribute(
      "href",
      `/panel/is/${assignmentId}`,
    );
    expect(within(row).getByRole("link", { name: "Destekten yardım al" })).toHaveAttribute(
      "href",
      "/iletisim",
    );
  });

  it("uyuşmazlık sürerken aktarımın beklendiğini açıklar", () => {
    render(<EarningsList payouts={[payout({ status: "PROCESSING" })]} />);

    expect(screen.getByText(/Açık bir uyuşmazlık varsa para aktarımı/)).toBeVisible();
  });
});
