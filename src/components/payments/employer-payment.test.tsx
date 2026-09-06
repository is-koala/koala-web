import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { EmployerAssignment } from "@/payments/contract";

import {
  EmployerAssignmentPayment,
  DisputeEscrowNotice,
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
    expect(screen.getByText("İşveren toplamı")).toBeVisible();
    expect(screen.queryByText("Ödeyeceğin toplam")).toBeNull();
    expect(screen.getByText("0.075")).toBeVisible();
    expect(screen.getByText("2026-09-v1")).toBeVisible();
  });

  it("atama ödeme durumunu tanınmayan bir değerle de nötr olarak gösterir", () => {
    render(<PaymentStatusBadge status="UNKNOWN" />);

    expect(screen.getByText("Durum güncelleniyor")).toBeVisible();
  });

  it("atama CONFIRMED değilken ödeme eylemini devre dışı bırakır", () => {
    render(
      <EmployerAssignmentPayment
        assignment={{ ...assignment, status: "PENDING_CONFIRMATION" }}
        requirements={{ advisories: [], blocked: [] }}
      />,
    );

    expect(screen.getByRole("button", { name: "Ödemeye geç" })).toBeDisabled();
    expect(screen.getByText(/işçinin atamayı onaylaması gerekiyor/i)).toBeVisible();
  });

  it("atama REFUNDED olduğunda sağlayıcı tamamlanmasını değil iade sürecini anlatır", () => {
    render(
      <EmployerAssignmentPayment
        assignment={{ ...assignment, paymentStatus: "REFUNDED" }}
        requirements={{ advisories: [], blocked: [] }}
      />,
    );

    expect(screen.getAllByText("İade sürecinde")).not.toHaveLength(0);
    expect(screen.getByText("Bu atama için iade süreci başlatıldı.")).toBeVisible();
    expect(screen.queryByText("Bu atamanın ödemesi iade edildi.")).toBeNull();
  });

  it("bireysel işverenin kimlik numarası ve adres eksiklerini eylemin yanında açıklar", () => {
    render(
      <EmployerAssignmentPayment
        assignment={assignment}
        requirements={{
          advisories: ["individualBillingAddress"],
          blocked: ["identityNumber"],
        }}
      />,
    );

    expect(screen.getByRole("button", { name: "Ödemeye geç" })).toBeDisabled();
    expect(screen.getByText("Kimlik numaran hesabında kayıtlı değil")).toBeVisible();
    expect(screen.getByText("Fatura adresin eksik")).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("Fatura adresin eksik");
    expect(screen.getByRole("alert")).toHaveTextContent("Kimlik numaran hesabında kayıtlı değil");
    expect(screen.queryByRole("link", { name: "Ödemeye geç" })).toBeNull();
  });

  it("ödeme geçmişinde bilinmeyen deneme durumunu ve boş listeyi güvenle gösterir", () => {
    const { rerender } = render(<PaymentHistory attempts={[]} />);
    expect(screen.getByRole("status")).toHaveTextContent("Henüz ödeme denemesi yok");

    rerender(<PaymentHistory attempts={[{
      id: "attempt-1",
      status: "UNKNOWN",
      currency: "TRY",
      workerPayout: "1500.50",
      serviceFeeRate: "0.075",
      serviceFeeAmount: "112.54",
      employerTotal: "1613.04",
      completedAt: null,
      createdAt: "2026-09-06T18:00:00Z",
      failureMessage: null,
    }]} />);

    expect(screen.getByText("Sonuç doğrulanıyor")).toBeVisible();
    expect(screen.getByText("Çalışan ücreti")).toBeVisible();
    expect(screen.getByText("Hizmet bedeli")).toBeVisible();
    expect(screen.getByText("Toplam")).toBeVisible();
    expect(screen.getByText("1.500,50 ₺")).toBeVisible();
    expect(screen.getByText("112,54 ₺")).toBeVisible();
    expect(screen.getByText("1.613,04 ₺")).toBeVisible();
  });

  it("atama dönüş bildirimini backend'in kesin durumuna göre ayırır", () => {
    const { rerender } = render(<PaymentResultNotice resolution="failed" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Ödeme tamamlanamadı");

    rerender(<PaymentResultNotice resolution="held" />);
    expect(screen.getByRole("status")).toHaveTextContent("emanete alındı");

    rerender(<PaymentResultNotice resolution="released" />);
    expect(screen.getByRole("status")).toHaveTextContent("işçiye aktarıldı");
    expect(screen.queryByText(/emanete alındı/i)).toBeNull();

    rerender(<PaymentResultNotice resolution="pending" />);
    expect(screen.getByRole("status")).toHaveTextContent("Ödeme sonucunu bekliyoruz");
    expect(screen.queryByText(/iade edildi/i)).toBeNull();
  });

  it("sağlayıcı ayrıntısı yerine BFF'in güvenli Türkçe yönlendirmesini gösterir", () => {
    render(<PaymentHistory attempts={[{
      id: "attempt-1",
      status: "FAILED",
      currency: "TRY",
      workerPayout: "1500.50",
      serviceFeeRate: "0.075",
      serviceFeeAmount: "112.54",
      employerTotal: "1613.04",
      completedAt: "2026-09-06T18:05:00Z",
      createdAt: "2026-09-06T18:00:00Z",
      failureMessage:
        "Ödeme sağlayıcısı bu deneme için ek kontrol gerektirdi. Kartını ve banka doğrulamasını kontrol edebilirsin.",
    }]} />);

    expect(screen.getByText(/ödeme sağlayıcısı bu deneme için ek kontrol gerektirdi/i)).toBeVisible();
    expect(screen.queryByText(/provider internal detail/i)).toBeNull();
  });

  it("başarısız denemede sağlayıcı ayrıntısı yoksa güvenli genel yönlendirmeye düşer", () => {
    render(<PaymentHistory attempts={[{
      id: "attempt-1",
      status: "FAILED",
      currency: "TRY",
      workerPayout: "1500.50",
      serviceFeeRate: "0.075",
      serviceFeeAmount: "112.54",
      employerTotal: "1613.04",
      completedAt: "2026-09-06T18:05:00Z",
      createdAt: "2026-09-06T18:00:00Z",
      failureMessage: null,
    }]} />);

    expect(screen.getByText(/kartını ve banka doğrulamasını kontrol edip yeniden deneyebilirsin/i))
      .toBeVisible();
  });

  it("aktif uyuşmazlığın emanetten çıkışı durdurduğunu açıklar", () => {
    const { rerender } = render(<DisputeEscrowNotice hasActiveDispute={false} />);
    expect(screen.queryByText(/emanetten çıkış/i)).toBeNull();

    rerender(<DisputeEscrowNotice hasActiveDispute />);
    expect(screen.getByRole("status")).toHaveTextContent("emanetten çıkış bekler");
  });
});
