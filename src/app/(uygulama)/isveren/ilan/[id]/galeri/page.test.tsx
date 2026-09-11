import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/server/api/errors";

const enterShell = vi.hoisted(() => vi.fn());
const fetchJobDetail = vi.hoisted(() => vi.fn());
const listJobImages = vi.hoisted(() => vi.fn());
const listCompanyImages = vi.hoisted(() => vi.fn());
const galleryManager = vi.hoisted(() =>
  vi.fn((props: { companyImages?: unknown }) => {
    void props;
    return <div>galeri</div>;
  }),
);
const notFound = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
);

vi.mock("@/server/session/viewer", () => ({ enterShell }));
vi.mock("@/server/jobs/jobs", () => ({ fetchJobDetail }));
vi.mock("@/server/gallery/gallery", () => ({ listJobImages, listCompanyImages }));
vi.mock("next/navigation", () => ({ notFound, unstable_rethrow: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/components/gallery/gallery-manager", () => ({ GalleryManager: galleryManager }));

import Page, { JobGalleryPanel } from "./page";

const jobId = "4d0a1e58-6a3c-4a3f-9a10-6a1c2d3e4f99";
const companyId = "5d3c1b0a-7f60-4c2f-8a9e-9c1f0d244f6c";

describe("ilan galerisi sayfası", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    enterShell.mockResolvedValue({ viewer: { firstName: "Ayşe" }, failure: null });
    fetchJobDetail.mockResolvedValue(jobDetail(null));
    listJobImages.mockResolvedValue([]);
    listCompanyImages.mockResolvedValue([]);
  });

  it("UUID olmayan ilan kimliğini backend'e hiç sormaz", async () => {
    await expect(Page({ params: Promise.resolve({ id: "../hesap" }) })).rejects.toThrow("NOT_FOUND");
    expect(fetchJobDetail).not.toHaveBeenCalled();
  });

  it("ilan yoksa 404 verir", async () => {
    fetchJobDetail.mockRejectedValue(
      new ApiError({
        status: 404,
        errorCode: "JOB_NOT_FOUND",
        errorCategory: "RESOURCE_NOT_FOUND",
        message: "ham mesaj",
      }),
    );

    await expect(Page({ params: Promise.resolve({ id: jobId }) })).rejects.toThrow("NOT_FOUND");
  });

  it("bireysel ilanda şirket galerisinden seçme yolunu açmaz", async () => {
    render(await JobGalleryPanel({ job: jobDetail(null) }));

    expect(listCompanyImages).not.toHaveBeenCalled();
    expect(galleryManager.mock.calls[0][0].companyImages).toBeNull();
  });

  it("şirket ilanında şirket galerisini seçim listesine taşır", async () => {
    const companyImages = [{ id: "33333333-3333-4333-8333-333333333333" }];
    listCompanyImages.mockResolvedValue(companyImages);

    render(await JobGalleryPanel({ job: jobDetail(companyId) }));

    expect(listCompanyImages).toHaveBeenCalledWith(companyId);
    expect(galleryManager.mock.calls[0][0].companyImages).toBe(companyImages);
    expect(screen.getByRole("heading", { name: "Hafta sonu garson" })).toBeVisible();
  });
});

function jobDetail(company: string | null) {
  return {
    id: jobId,
    title: "Hafta sonu garson",
    status: "OPEN",
    salaryType: "DAILY",
    startDateTime: "2026-10-10T09:00",
    endDateTime: "2026-10-11T18:00",
    pricing: null,
    headcount: null,
    hiredCount: 0,
    companyId: company,
  };
}
