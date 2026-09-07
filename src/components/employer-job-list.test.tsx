import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { EmployerJob, EmployerJobPage } from "@/jobs/employer-jobs";

import { EmployerJobList } from "./employer-job-list";

const job: EmployerJob = {
  id: "4d0a1e58-6a3c-4a3f-9a10-6a1c2d3e4f99",
  title: "Hafta sonu garson",
  position: "Garson",
  companyName: "Koala Etkinlik",
  employerType: "COMPANY",
  status: "OPEN",
  salaryType: "DAILY",
  workerPayout: "1500.50",
  currency: "TRY",
  startsAt: "2026-10-10T09:00:00",
  endsAt: "2026-10-11T18:00:00",
  cityName: "İstanbul",
  districtName: "Beşiktaş",
  insuranceRequired: true,
  applicationCount: 7,
  hiredCount: 2,
  headcount: 4,
};

function pageWith(overrides: Partial<EmployerJobPage> = {}): EmployerJobPage {
  return {
    content: [job],
    page: 0,
    size: 20,
    totalElements: 1,
    totalPages: 1,
    first: true,
    last: true,
    ...overrides,
  };
}

describe("işverenin ilan listesi", () => {
  it("ilanın durumunu, başvuru ve işe alım sayısını gösterir", () => {
    render(<EmployerJobList jobs={pageWith()} sort="createdAt,desc" />);

    const card = screen.getByRole("article", { name: /Hafta sonu garson/ });
    expect(within(card).getByText(/Yayında/)).toBeVisible();
    expect(within(card).getByText("7")).toBeVisible();
    expect(within(card).getByText("2")).toBeVisible();
  });

  it("kilitlenen ücreti yanıttaki değerle yazar", () => {
    render(<EmployerJobList jobs={pageWith()} sort="createdAt,desc" />);

    expect(screen.getByText("1.500,50 ₺")).toBeVisible();
  });

  it("fiyat anlık görüntüsü olmayan ilanda tutar uydurmaz", () => {
    render(
      <EmployerJobList
        jobs={pageWith({ content: [{ ...job, workerPayout: null, currency: null }] })}
        sort="createdAt,desc"
      />,
    );

    expect(screen.getByText(/ücret dökümü okunamadı/i)).toBeVisible();
  });

  it("yalnız sunucunun tanıdığı dört sıralamayı sunar", () => {
    // Beşinci bir seçenek `PAGE_SORT_FIELD_NOT_ALLOWED` ile 400 dönerdi.
    render(<EmployerJobList jobs={pageWith()} sort="createdAt,desc" />);

    const sorting = screen.getByRole("navigation", { name: "Sıralama" });
    const links = within(sorting).getAllByRole("link");

    expect(links).toHaveLength(4);
    for (const link of links) {
      expect(link.getAttribute("href")).toMatch(
        /^\/isveren\/ilanlar\?sort=(createdAt%2Cdesc|startDateTime%2Casc|salary%2Cdesc|title%2Casc)$/,
      );
    }
  });

  it("sayfa değiştirirken seçili sıralamayı korur", () => {
    render(<EmployerJobList jobs={pageWith({ totalPages: 3, last: false })} sort="title,asc" />);

    expect(screen.getByRole("link", { name: "Sonraki sayfa" })).toHaveAttribute(
      "href",
      "/isveren/ilanlar?sort=title%2Casc&page=1",
    );
  });

  it("ilan yokken boş durumu yazar", () => {
    render(
      <EmployerJobList
        jobs={pageWith({ content: [], totalElements: 0, totalPages: 0 })}
        sort="createdAt,desc"
      />,
    );

    expect(screen.getByText("Henüz ilan açmadın")).toBeVisible();
  });

  it("ilanı kendi yönetim sayfasına bağlar", () => {
    render(<EmployerJobList jobs={pageWith()} sort="createdAt,desc" />);

    expect(screen.getByRole("link", { name: "Hafta sonu garson" })).toHaveAttribute(
      "href",
      `/isveren/ilan/${job.id}`,
    );
  });

  it("ismi gelmeyen şirket ilanını bireysel göstermiyor", () => {
    render(
      <EmployerJobList
        jobs={pageWith({ content: [{ ...job, companyName: null }] })}
        sort="createdAt,desc"
      />,
    );

    expect(screen.getByText(/Şirket ilanı/)).toBeInTheDocument();
    expect(screen.queryByText(/Bireysel ilan/)).toBeNull();
  });

  it("okunamayan işveren tipi için rozet uydurmuyor", () => {
    render(
      <EmployerJobList
        jobs={pageWith({ content: [{ ...job, employerType: "UNKNOWN", companyName: null }] })}
        sort="createdAt,desc"
      />,
    );

    expect(screen.queryByText(/Bireysel ilan/)).toBeNull();
    expect(screen.queryByText(/Şirket ilanı/)).toBeNull();
  });
});
