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
  workerName: "Ayşe Yılmaz",
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
  completedAt: null,
  workHours: 0,
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
