import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ReceivedApplication } from "@/applications/inbox";

import { ApplicationInbox } from "./application-inbox";

const jobId = "9c1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f60";
const otherJobId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const companyId = "5d3c1b0a-7f60-4c2f-8a9e-9c1f0d244f6c";
const otherCompanyId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const applicationId = "3b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f6e";
const workerId = "6d2c0e58-2f0a-4b1e-9c3d-7a8b9c0d1e2f";

const application: ReceivedApplication = {
  id: applicationId,
  status: "APPLIED",
  appliedAt: "2026-09-06T10:00:00Z",
  answeredAt: null,
  notes: "Hafta sonu uygunum.",
  applicant: {
    id: workerId,
    fullName: "Ayşe Yılmaz",
    profilePictureUrl: null,
  },
  jobId,
  postingTitle: "Etkinlik görevlisi",
  jobStatus: "OPEN",
  companyId,
  companyName: "Koala Etkinlik",
  assignmentId: null,
};

function pageOf(...content: ReceivedApplication[]) {
  return {
    content,
    page: 0,
    size: 20,
    totalElements: content.length,
    totalPages: content.length ? 1 : 0,
    first: true,
    last: true,
  };
}

describe("işveren başvuru gelen kutusu", () => {
  it("adayı, ilanı, şirketi ve inceleme bağlantısını çizer", () => {
    render(
      <ApplicationInbox
        page={pageOf(application)}
        query={{ status: "ALL", jobId: null, companyId: null, page: 0 }}
        companies={[{ companyId, companyName: "Koala Etkinlik" }]}
      />,
    );

    const row = screen.getByRole("listitem", { name: "Ayşe Yılmaz" });
    expect(within(row).getByText("Karar bekliyor")).toBeVisible();
    expect(within(row).getByText("Etkinlik görevlisi")).toBeVisible();
    expect(within(row).getByText("Koala Etkinlik")).toBeVisible();
    expect(within(row).getByText("Hafta sonu uygunum.")).toBeVisible();
    expect(screen.getByRole("link", { name: "Başvuruyu incele" })).toHaveAttribute(
      "href",
      `/isveren/ilan/${jobId}/basvurular#applicant-${applicationId}`,
    );
  });

  it("durum, ilan ve şirket süzgeçlerini URL'de birlikte korur", () => {
    render(
      <ApplicationInbox
        page={{ ...pageOf(application), page: 1, totalPages: 3, first: false, last: false }}
        query={{ status: "REJECTED", jobId, companyId, page: 1 }}
        companies={[
          { companyId, companyName: "Koala Etkinlik" },
          { companyId: otherCompanyId, companyName: "Koala Lojistik" },
        ]}
      />,
    );

    expect(screen.getByRole("link", { name: "Bekleyenler" })).toHaveAttribute(
      "href",
      `/isveren/basvurular?status=APPLIED&jobId=${jobId}&companyId=${companyId}`,
    );
    expect(screen.getByRole("link", { name: "Sonraki sayfa" })).toHaveAttribute(
      "href",
      `/isveren/basvurular?status=REJECTED&jobId=${jobId}&companyId=${companyId}&page=2`,
    );
    expect(screen.getByRole("link", { name: "Koala Lojistik" })).toHaveAttribute(
      "href",
      `/isveren/basvurular?status=REJECTED&jobId=${jobId}&companyId=${otherCompanyId}`,
    );

    const jobFilter = screen.getByRole("combobox", { name: "İlan" });
    expect(jobFilter).toHaveValue(jobId);
    expect(within(jobFilter).getByRole("option", { name: "Etkinlik görevlisi" })).toBeInTheDocument();
    expect(within(jobFilter).getByRole("option", { name: "Tüm ilanlar" })).toBeInTheDocument();
  });

  it("gerçek boşluk ile süzgeç sonucundaki boşluğu ayırır", () => {
    const { rerender } = render(
      <ApplicationInbox
        page={pageOf()}
        query={{ status: "ALL", jobId: null, companyId: null, page: 0 }}
        companies={[]}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Henüz başvuru yok");

    rerender(
      <ApplicationInbox
        page={pageOf()}
        query={{ status: "REJECTED", jobId: otherJobId, companyId: null, page: 0 }}
        companies={[]}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Bu süzgeçte başvuru yok");
  });

  it("aday adını dosyaya bağlar", () => {
    render(
      <ApplicationInbox
        page={pageOf(application)}
        query={{ status: "ALL", jobId: null, companyId: null, page: 0 }}
        companies={[]}
      />,
    );

    expect(screen.getByRole("link", { name: "Ayşe Yılmaz" })).toHaveAttribute(
      "href",
      `/isveren/aday/${workerId}`,
    );
  });
});
