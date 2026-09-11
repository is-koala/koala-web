import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const enterShell = vi.hoisted(() => vi.fn());
const listCompanyImages = vi.hoisted(() => vi.fn());
const galleryManager = vi.hoisted(() => vi.fn(() => <div>galeri</div>));
const notFound = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
);

vi.mock("@/server/session/viewer", () => ({ enterShell }));
vi.mock("@/server/gallery/gallery", () => ({ listCompanyImages }));
vi.mock("next/navigation", () => ({ notFound, unstable_rethrow: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/components/gallery/gallery-manager", () => ({ GalleryManager: galleryManager }));

import Page, { CompanyGalleryPanel } from "./page";

const companyId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("şirket galerisi sayfası", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listCompanyImages.mockResolvedValue([]);
  });

  it("üyesi olunmayan şirketi 404 yapar, varlığını sızdırmaz", async () => {
    enterShell.mockResolvedValue({
      viewer: { companies: [] },
      failure: null,
    });

    await expect(Page({ params: Promise.resolve({ companyId }) })).rejects.toThrow("NOT_FOUND");
    expect(listCompanyImages).not.toHaveBeenCalled();
  });

  it("ilan yetkilisine 404 yerine yönetici gerekçesini gösterir", async () => {
    enterShell.mockResolvedValue({
      viewer: {
        companies: [
          { companyId, companyName: "Koala Etkinlik", role: "STAFF", approved: true },
        ],
      },
      failure: null,
    });

    render(await Page({ params: Promise.resolve({ companyId }) }));

    expect(screen.getByRole("status")).toHaveTextContent(
      "bu işlem için şirket yöneticisi olman gerekiyor",
    );
    expect(galleryManager).not.toHaveBeenCalled();
    expect(listCompanyImages).not.toHaveBeenCalled();
  });

  it("yöneticiye galeriyi şirketin kendi kimliğiyle çizer", async () => {
    render(await CompanyGalleryPanel({ companyId, companyName: "Koala Etkinlik" }));

    expect(listCompanyImages).toHaveBeenCalledWith(companyId);
    expect(screen.getByRole("heading", { name: "Şirket galerisi" })).toBeVisible();
    expect(galleryManager).toHaveBeenCalled();
  });
});
