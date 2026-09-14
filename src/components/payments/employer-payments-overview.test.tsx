import { render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";

import type { EmployerAssignment } from "@/payments/contract";

import { EmployerPaymentsOverview } from "./employer-payments-overview";

const base: EmployerAssignment = {
  id: "assignment-1",
  jobId: "job-1",
  title: "Etkinlik görevlisi",
  position: null,
  employerType: "INDIVIDUAL",
  workerId: "6d2c0e58-2f0a-4b1e-9c3d-7a8b9c0d1e2f",
  workerName: "Ayşe Yılmaz",
  workerPictureUrl: null,
  companyName: null,
  cityName: "İstanbul",
  districtName: "Kadıköy",
  startsAt: "2026-09-12T09:00:00",
  endsAt: "2026-09-12T18:00:00",
  status: "CONFIRMED",
  paymentStatus: "HELD_IN_ESCROW",
  pricing: {
    pricingVersion: "v1",
    currency: "TRY",
    workerPayout: "9007199254740993.00",
    serviceFeeRate: "0.075",
    serviceFeeAmount: "1.00",
    employerTotal: "9007199254740994.00",
  },
  assignedAt: null,
  confirmedAt: null,
  paymentSecuredAt: null,
  cancelledAt: null,
  completedAt: null,
  workHours: 0,
  messaging: null,
};

it("backend toplamlarını kuruş kaybetmeden ödeme ve emanet özetinde toplar", () => {
  render(<EmployerPaymentsOverview assignments={[
    base,
    {
      ...base,
      id: "assignment-2",
      paymentStatus: "RELEASED_TO_WORKER",
      pricing: { ...base.pricing!, employerTotal: "6.00" },
    },
  ]} filter="all" totalsComplete />);

  expect(screen.getByText("9.007.199.254.741.000,00 ₺")).toBeVisible();
  expect(within(screen.getByRole("heading", { name: "Emanette bekleyen" }).parentElement!)
    .getByText("9.007.199.254.740.994,00 ₺")).toBeVisible();
  expect(screen.getByText("İşçiye aktarıldı")).toBeVisible();
});

it("sayfalama sınırına gelince finansal özeti tam toplam diye sunmaz", () => {
  render(<EmployerPaymentsOverview assignments={[base]} filter="all" totalsComplete={false} />);

  expect(screen.getByRole("status")).toHaveTextContent("tam toplam değildir");
  expect(screen.getByRole("heading", { name: "Listelenen atamalarda tahsil edilen" })).toBeVisible();
  expect(screen.queryByRole("heading", { name: "Toplam tahsil edilen" })).toBeNull();
});

it("REFUNDED filtresini tamamlanmış iade değil devam eden süreç olarak adlandırır", () => {
  render(<EmployerPaymentsOverview assignments={[
    { ...base, paymentStatus: "REFUNDED" },
  ]} filter="REFUNDED" totalsComplete />);

  expect(screen.getByRole("link", { name: "İade sürecinde" })).toBeVisible();
  expect(screen.queryByRole("link", { name: "İade edilen" })).toBeNull();
  expect(screen.getByText("İade sürecinde", { selector: ".payment-status" })).toBeVisible();
});

it("satırda çalışma zamanını, şirket adını ve gelen ödeme tarihini yazar", () => {
  // `paymentSecuredAt` is-koala/koala-backend#282 ile geliyor; yoksa satır
  // yalnız çalışma zamanını yazıyor, tarih uydurmuyor.
  const { rerender } = render(<EmployerPaymentsOverview assignments={[
    { ...base, companyName: "Koala Etkinlik", paymentSecuredAt: "2026-09-02T14:30:00Z" },
  ]} filter="all" totalsComplete />);

  expect(screen.getByText("Koala Etkinlik · Ayşe Yılmaz")).toBeVisible();
  expect(screen.getByText("12 Eylül 2026, 09:00–18:00")).toBeVisible();
  expect(screen.getByText("2 Eyl 2026 17:30")).toBeVisible();

  rerender(<EmployerPaymentsOverview assignments={[base]} filter="all" totalsComplete />);
  expect(screen.getByText("Ayşe Yılmaz")).toBeVisible();
  expect(screen.queryByText(/Ödeme:/)).toBeNull();
});
