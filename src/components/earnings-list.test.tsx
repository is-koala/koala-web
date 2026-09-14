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
    failureMessage: null,
    completedAt: "2026-09-05T11:00:00Z",
    createdAt: "2026-09-05T10:30:00Z",
    jobTitle: "Etkinlik görevlisi",
    employerName: "Koala Etkinlik",
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
    expect(completed).toHaveTextContent("1.250,00 ₺");
    expect(pending).toHaveTextContent("100,20 ₺");
    expect(pending).not.toHaveTextContent("900,20 ₺");
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

  it("başarısız çıkışın güvenli açıklamasını, destek yolunu ve atama bağlantısını korur", () => {
    render(<EarningsList payouts={[
      payout({
        status: "FAILED",
        failureMessage: "Banka aktarımı tamamlanamadı. Ödeme hesabını kontrol edip destekten yardım alabilirsin.",
        completedAt: null,
      }),
    ]} />);

    const row = screen.getByRole("listitem");
    expect(within(row).getByText("Aktarılamadı")).toBeVisible();
    expect(within(row).getByText(/Banka aktarımı tamamlanamadı/)).toBeVisible();
    expect(within(row).queryByText("IBAN sahibi eşleşmedi")).toBeNull();
    expect(within(row).getByRole("link", { name: "İşi görüntüle" })).toHaveAttribute(
      "href",
      `/panel/is/${assignmentId}`,
    );
    expect(within(row).getByRole("link", { name: "Destekten yardım al" })).toHaveAttribute(
      "href",
      "/iletisim",
    );
  });

  it("sağlayıcı nedeni geldiyse durum kodundan bağımsız yardım sunar", () => {
    render(<EarningsList payouts={[
      payout({
        status: "PROCESSING",
        failureMessage: "Banka aktarımının güncel durumu doğrulanıyor. Biraz sonra yeniden kontrol edebilirsin.",
      }),
    ]} />);

    expect(screen.getByText(/güncel durumu doğrulanıyor/)).toBeVisible();
    expect(screen.getByRole("link", { name: "Destekten yardım al" })).toBeVisible();
  });

  it("uyuşmazlık sürerken aktarımın beklendiğini açıklar", () => {
    render(<EarningsList payouts={[payout({ status: "PROCESSING" })]} />);

    expect(screen.getByText(/uyuşmazlık çözülene kadar bekler/)).toBeVisible();
  });

  it("satırda iş başlığını ve işvereni, oluşturulma ile tamamlanma anlarını ayrı yazar", () => {
    render(<EarningsList payouts={[payout({})]} />);

    const row = screen.getByRole("listitem");
    expect(within(row).getByText("Etkinlik görevlisi")).toBeVisible();
    expect(within(row).getByText("Koala Etkinlik")).toBeVisible();
    expect(within(row).getByText("Oluşturuldu")).toBeVisible();
    expect(within(row).getByText("5 Eyl 2026 13:30")).toHaveAttribute("datetime", "2026-09-05T10:30:00Z");
    expect(within(row).getByText("Tamamlandı")).toBeVisible();
    expect(within(row).getByText("5 Eyl 2026 14:00")).toHaveAttribute("datetime", "2026-09-05T11:00:00Z");
  });

  it("iş adı eşlenemediyse ve aktarım bitmediyse o satırları çizmez, bağlantı kalır", () => {
    render(<EarningsList payouts={[
      payout({ status: "PENDING", jobTitle: null, employerName: null, completedAt: null }),
    ]} />);

    const row = screen.getByRole("listitem");
    expect(within(row).queryByText("Etkinlik görevlisi")).toBeNull();
    expect(within(row).queryByText("Koala Etkinlik")).toBeNull();
    expect(within(row).getByText("Oluşturuldu")).toBeVisible();
    expect(within(row).queryByText("Tamamlandı")).toBeNull();
    expect(within(row).getByRole("link", { name: "İşi görüntüle" })).toHaveAttribute(
      "href",
      `/panel/is/${assignmentId}`,
    );
  });

  it("yalnız iş adı geldiyse işveren ayracı yazmaz", () => {
    render(<EarningsList payouts={[payout({ employerName: null })]} />);

    expect(screen.getByText("Etkinlik görevlisi").parentElement).toHaveTextContent(/^Etkinlik görevlisi$/);
  });
});
