import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { EmployerAssignment } from "@/payments/contract";

import {
  EmployerAssignmentPayment,
  PaymentBreakdown,
  PaymentHistory,
  PaymentResultNotice,
  PaymentStatusBadge,
} from "./employer-payment";

const assignment: EmployerAssignment = {
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
  paymentStatus: "PENDING_COLLECTION",
  pricing: {
    pricingVersion: "2026-09-v1",
    currency: "TRY",
    workerPayout: "1500.50",
    serviceFeeRate: "0.075",
    serviceFeeAmount: "112.54",
    employerTotal: "1613.04",
  },
};

describe("işveren ödeme sunumu", () => {
  it("POST /payment-quotes çıktısını yeniden hesaplamadan tam döküm olarak gösterir", () => {
    render(<PaymentBreakdown pricing={assignment.pricing!} />);

    expect(screen.getByText("1.500,50 ₺")).toBeVisible();
    expect(screen.getByText("112,54 ₺")).toBeVisible();
    expect(screen.getByText("1.613,04 ₺")).toBeVisible();
    expect(screen.getByText("0.075")).toBeVisible();
    expect(screen.getByText("2026-09-v1")).toBeVisible();
  });

  it("atama ödeme durumunu tanınmayan bir değerle de nötr olarak gösterir", () => {
    render(<PaymentStatusBadge status={"CHARGEBACK"} />);

    expect(screen.getByText("Durum güncelleniyor")).toBeVisible();
  });

  it("atama CONFIRMED değilken ödeme eylemini devre dışı bırakır", () => {
    render(
      <EmployerAssignmentPayment
        assignment={{ ...assignment, status: "PENDING_CONFIRMATION" }}
        blocked={[]}
      />,
    );

    expect(screen.getByRole("button", { name: "Ödemeye geç" })).toBeDisabled();
    expect(screen.getByText(/işçinin atamayı onaylaması gerekiyor/i)).toBeVisible();
  });

  it("bireysel işverenin kimlik numarası ve adres eksiklerini eylemin yanında açıklar", () => {
    render(
      <EmployerAssignmentPayment
        assignment={assignment}
        blocked={["identityNumber", "individualBillingAddress"]}
      />,
    );

    expect(screen.getByRole("button", { name: "Ödemeye geç" })).toBeDisabled();
    expect(screen.getByText("Kimlik numaran hesabında kayıtlı değil")).toBeVisible();
    expect(screen.getByText("Fatura adresin eksik")).toBeVisible();
    expect(screen.queryByRole("link", { name: "Ödemeye geç" })).toBeNull();
  });

  it("ödeme geçmişinde bilinmeyen deneme durumunu ve boş listeyi güvenle gösterir", () => {
    const { rerender } = render(<PaymentHistory attempts={[]} />);
    expect(screen.getByRole("status")).toHaveTextContent("Henüz ödeme denemesi yok");

    rerender(<PaymentHistory attempts={[{
      id: "attempt-1",
      status: "VERIFY_PENDING",
      currency: "TRY",
      workerPayout: "1500.50",
      serviceFeeRate: "0.075",
      serviceFeeAmount: "112.54",
      employerTotal: "1613.04",
      completedAt: null,
      createdAt: "2026-09-06T18:00:00Z",
    }]} />);

    expect(screen.getByText("Sonuç doğrulanıyor")).toBeVisible();
    expect(screen.getByText("1.613,04 ₺")).toBeVisible();
  });

  it("atama dönüş bildirimini yalnız mutabakat sonucundan üretir", () => {
    const { rerender } = render(<PaymentResultNotice resolution="failed" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Ödeme tamamlanamadı");

    rerender(<PaymentResultNotice resolution="succeeded" />);
    expect(screen.getByRole("status")).toHaveTextContent("Ödeme doğrulandı");
  });
});
