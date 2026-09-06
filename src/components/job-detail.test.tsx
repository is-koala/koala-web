import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { JobDetail } from "@/jobs/contract";

import { JobDetailView } from "./job-detail";

const job: JobDetail = {
  id: "9c1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f60",
  title: "Etkinlik görevlisi",
  description: "Festival alanında misafirleri karşıla.",
  duties: "Bilet kontrolü ve yönlendirme",
  dressCode: "Siyah kıyafet",
  categoryName: "Etkinlik",
  companyName: "Koala Etkinlik",
  employerName: "Ayşe Yıldız",
  salaryType: "DAILY",
  startsAt: "2026-09-12T09:00:00",
  endsAt: "2026-09-12T18:00:00",
  workerPayout: "1250.00",
  currency: "TRY",
  insuranceRequired: true,
  experienceRequired: false,
  location: "Kadıköy, İstanbul",
  addressPrecision: "APPROXIMATE",
};

describe("ilan ayrıntısı", () => {
  it("sunucudan gelen ilan, yaklaşık adres ve fiyat anlık görüntüsünü gösterir", () => {
    render(<JobDetailView job={job} applyAction={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Etkinlik görevlisi" })).toBeVisible();
    expect(screen.getByText("12 Eylül 2026, 09:00–18:00")).toBeVisible();
    expect(screen.getByText("1.250,00 TRY / gün")).toBeVisible();
    expect(screen.getByText("Kadıköy, İstanbul")).toBeVisible();
    expect(screen.getByText("Yaklaşık konum")).toBeVisible();
    expect(screen.getByText("Sigorta gerekiyor")).toBeVisible();
    expect(screen.getByText("Deneyim şartı yok")).toBeVisible();
  });

  it("backend konum vermediyse gizli adres üretmez", () => {
    render(<JobDetailView job={{ ...job, location: null }} applyAction={vi.fn()} />);

    expect(screen.getByText("Konum bilgisi paylaşılmadı")).toBeVisible();
    expect(screen.queryByText("Kadıköy, İstanbul")).toBeNull();
  });
});
