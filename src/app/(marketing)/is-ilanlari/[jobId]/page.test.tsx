import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { JobDetail } from "@/jobs/contract";
import { JobDetailState } from "@/components/job-detail-state";
import { readJobDetail } from "@/server/jobs/jobs";

import Page from "./page";

vi.mock("@/server/jobs/jobs", () => ({ readJobDetail: vi.fn() }));
vi.mock("./actions", () => ({ applyToJobAction: vi.fn() }));

const jobId = "9c1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f60";
const job: JobDetail = {
  id: jobId,
  title: "Etkinlik görevlisi",
  description: "Misafirleri karşıla.",
  duties: null,
  dressCode: null,
  categoryName: "Etkinlik",
  companyName: null,
  employerName: "Ayşe Yıldız",
  salaryType: "DAILY",
  startsAt: "2026-09-12T09:00:00",
  endsAt: "2026-09-12T18:00:00",
  workerPayout: "1250.00",
  currency: "TRY",
  insuranceRequired: false,
  experienceRequired: false,
  location: "Kadıköy, İstanbul",
  addressPrecision: "APPROXIMATE",
};

describe("ilan ayrıntısı sayfası", () => {
  beforeEach(() => vi.mocked(readJobDetail).mockReset());

  it("geçerli ilanın ayrıntısını çizer", async () => {
    vi.mocked(readJobDetail).mockResolvedValue(job);

    render(await Page({ params: Promise.resolve({ jobId }) }));

    expect(screen.getByRole("heading", { name: job.title })).toBeVisible();
    expect(readJobDetail).toHaveBeenCalledWith(jobId);
  });

  it("boş GET yanıtını ilan bulunamadı durumuna çevirir", async () => {
    vi.mocked(readJobDetail).mockResolvedValue(null);

    render(await Page({ params: Promise.resolve({ jobId }) }));

    expect(screen.getByRole("status")).toHaveTextContent("İlan bulunamadı");
  });

  it("404 hata durumunu backend mesajı olmadan sunar", () => {
    render(
      <JobDetailState
        state={{ status: "error", errorCode: "JOB_NOT_FOUND", httpStatus: 404 }}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("İçerik bulunamadı");
  });

  it("beklenmedik hata durumunu nötr metinle sunar", () => {
    render(
      <JobDetailState state={{ status: "error", errorCode: "UNEXPECTED", httpStatus: 500 }} />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Bir sorun oluştu");
  });

  it("geçersiz ilan kimliği için backend'e gitmez", async () => {
    render(await Page({ params: Promise.resolve({ jobId: "not-a-job" }) }));

    expect(screen.getByRole("status")).toHaveTextContent("İlan bulunamadı");
    expect(readJobDetail).not.toHaveBeenCalled();
  });
});
