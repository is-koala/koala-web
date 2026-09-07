import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { EmployerAssignment, EmployerAssignmentPage } from "@/payments/contract";

import { EmployerAssignmentList } from "./employer-assignment-list";

const pricing = {
  pricingVersion: "2026-09-v1",
  currency: "TRY",
  workerPayout: "1500.50",
  serviceFeeRate: "0.075",
  serviceFeeAmount: "112.54",
  employerTotal: "1613.04",
};

function assignment(overrides: Partial<EmployerAssignment> = {}): EmployerAssignment {
  return {
    id: "3b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f6e",
    jobId: "9c1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f60",
    title: "Etkinlik görevlisi",
    position: "Karşılama",
    employerType: "INDIVIDUAL",
    workerName: "Ayşe Yılmaz",
    cityName: "İstanbul",
    districtName: "Kadıköy",
    startsAt: "2026-09-12T09:00:00",
    endsAt: "2026-09-12T18:00:00",
    status: "CONFIRMED",
    paymentStatus: "HELD_IN_ESCROW",
    pricing: null,
    assignedAt: null,
    completedAt: null,
    workHours: 0,
    ...overrides,
  };
}

function page(content: readonly EmployerAssignment[]): EmployerAssignmentPage {
  return {
    content,
    page: 0,
    size: 20,
    totalElements: content.length,
    totalPages: 1,
    first: true,
    last: true,
  };
}

describe("işveren atama listesi", () => {
  it("işveren atamasını ödeme durumu ve ayrıntı bağlantısıyla gösterir", () => {
    render(<EmployerAssignmentList assignments={page([assignment()])} />);

    expect(screen.getByRole("heading", { name: "Etkinlik görevlisi" })).toBeVisible();
    expect(screen.getByText("Ayşe Yılmaz")).toBeVisible();
    expect(screen.getByText("Emanette")).toBeVisible();
    expect(screen.getByRole("link", { name: "Atamayı aç" })).toHaveAttribute(
      "href",
      "/isveren/atama/3b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f6e",
    );
  });

  it("onay bekleyenle onaylanmışı sıradaki adımlarıyla ayırt eder", () => {
    // Rozetler ikisini ayırıyor ama ayrımın **anlamı** ödeme sırasında:
    // ödeme yalnız `CONFIRMED` iken açılabiliyor.
    render(<EmployerAssignmentList assignments={page([
      assignment({ id: "a", status: "PENDING_CONFIRMATION", paymentStatus: "PENDING_COLLECTION" }),
      assignment({ id: "b", status: "CONFIRMED", paymentStatus: "PENDING_COLLECTION" }),
    ])} />);

    const [pending, confirmed] = screen.getAllByRole("article");
    expect(within(pending).getByText("Onay bekliyor")).toBeVisible();
    expect(within(pending).getByText(/işçinin atamayı onaylamasını bekle/i)).toBeVisible();
    expect(within(confirmed).getByText("Onaylandı")).toBeVisible();
    expect(within(confirmed).getByText(/güvenli ödeme sayfasından tamamla/i)).toBeVisible();
  });

  it("çalışılan saati ve işveren toplamını satırda gösterir", () => {
    render(<EmployerAssignmentList assignments={page([
      assignment({ workHours: 9, pricing }),
    ])} />);

    const card = screen.getByRole("article");
    expect(within(card).getByText("Çalışılan saat")).toBeVisible();
    expect(within(card).getByText("9 saat")).toBeVisible();
    expect(within(card).getByText("İşveren toplamı")).toBeVisible();
    expect(within(card).getByText("1.613,04 ₺")).toBeVisible();
  });

  it("henüz çalışılmamış atamada saat satırını hiç açmaz", () => {
    // Sıfır saat "kayıt yok" demek; sayı olarak yazmak çalışıldığını sanırdı.
    render(<EmployerAssignmentList assignments={page([assignment({ workHours: 0 })])} />);

    expect(screen.queryByText("Çalışılan saat")).toBeNull();
  });

  it("fiyat dökümü gelmediğinde toplam uydurmaz", () => {
    render(<EmployerAssignmentList assignments={page([assignment({ pricing: null })])} />);

    expect(screen.queryByText("İşveren toplamı")).toBeNull();
  });
});
