import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import type { EmployerAssignmentPage } from "@/payments/contract";

import { EmployerAssignmentList } from "./employer-assignment-list";

it("işveren atamasını ödeme durumu ve ayrıntı bağlantısıyla gösterir", () => {
  const assignments: EmployerAssignmentPage = {
    content: [{
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
    }],
    page: 0,
    size: 20,
    totalElements: 1,
    totalPages: 1,
    first: true,
    last: true,
  };

  render(<EmployerAssignmentList assignments={assignments} />);

  expect(screen.getByRole("heading", { name: "Etkinlik görevlisi" })).toBeVisible();
  expect(screen.getByText("Ayşe Yılmaz")).toBeVisible();
  expect(screen.getByText("Emanette")).toBeVisible();
  expect(screen.getByRole("link", { name: "Atamayı aç" })).toHaveAttribute(
    "href",
    "/isveren/atama/3b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f6e",
  );
});
