import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ApplicantDossier } from "@/applications/employer-review";
import { ApiError } from "@/server/api/errors";

import Page from "./page";

const enterShell = vi.hoisted(() => vi.fn());
const readApplicantDossier = vi.hoisted(() => vi.fn());
const notFound = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
);

vi.mock("@/server/session/viewer", () => ({ enterShell }));
vi.mock("@/server/applications/employer-review", () => ({ readApplicantDossier }));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  notFound,
}));

const userId = "6d2c0e58-2f0a-4b1e-9c3d-7a8b9c0d1e2f";

const dossier: ApplicantDossier = {
  profile: {
    id: userId,
    fullName: "Ayşe Yılmaz",
    profilePictureUrl: "https://cdn.example.test/ayse.jpg",
    occupation: "Garson",
    about: "Beş yıldır etkinliklerde çalışıyorum.",
    cityName: "İstanbul",
    districtName: "Kadıköy",
    cvUrl: "https://cdn.example.test/ayse.pdf",
  },
  ratingSummary: { reviewCount: 7, averageRating: "4.6" },
  reviews: [
    { id: "r1", authorName: "Koala Etkinlik", rating: 5, comment: "Dakik ve güler yüzlü.", createdAt: "2026-08-01T10:00:00Z" },
  ],
  badges: [{ code: "PUNCTUAL", name: "Dakik", tier: "GOLD" }],
};

describe("aday dosyası sayfası", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    enterShell.mockResolvedValue({ viewer: { firstName: "Ali" }, failure: null });
  });

  it("profili, puanı, rozetleri ve değerlendirmeleri sunucuda çizer", async () => {
    readApplicantDossier.mockResolvedValue(dossier);

    render(await Page({ params: Promise.resolve({ userId }) }));

    expect(readApplicantDossier).toHaveBeenCalledWith(userId);
    expect(screen.getByRole("heading", { name: "Ayşe Yılmaz" })).toBeVisible();
    expect(screen.getByText("Kadıköy, İstanbul")).toBeVisible();
    expect(screen.getByText("4.6 / 5 · 7 değerlendirme")).toBeVisible();
    expect(screen.getByText("Beş yıldır etkinliklerde çalışıyorum.")).toBeVisible();
    expect(screen.getByRole("list", { name: "Rozetler" })).toHaveTextContent("DakikAltın");
    expect(screen.getByText("Dakik ve güler yüzlü.")).toBeVisible();
    expect(screen.getByRole("link", { name: "Özgeçmişi aç" })).toHaveAttribute(
      "href",
      "https://cdn.example.test/ayse.pdf",
    );
  });

  it("değerlendirmesi ve rozeti olmayan adayda boş durumları yazar", async () => {
    readApplicantDossier.mockResolvedValue({
      ...dossier,
      ratingSummary: null,
      reviews: [],
      badges: [],
      profile: { ...dossier.profile, cvUrl: null, about: null },
    });

    render(await Page({ params: Promise.resolve({ userId }) }));

    expect(screen.getByText("Henüz değerlendirilmemiş")).toBeVisible();
    expect(screen.getByText("Bu aday henüz rozet kazanmamış.")).toBeVisible();
    expect(screen.getByText("Bu adaya henüz değerlendirme yazılmamış.")).toBeVisible();
    expect(screen.queryByRole("link", { name: "Özgeçmişi aç" })).toBeNull();
  });

  it("kimliği UUID olmayan adresi backend'e sormadan 404 yapar", async () => {
    await expect(Page({ params: Promise.resolve({ userId: "../me" }) })).rejects.toThrowError("NOT_FOUND");
    expect(readApplicantDossier).not.toHaveBeenCalled();
  });

  it("backend adayı bulamazsa 404 döner, başka arızada Türkçe hata kartı çizer", async () => {
    readApplicantDossier.mockRejectedValue(
      new ApiError({ status: 404, errorCode: "USER_NOT_FOUND", errorCategory: "RESOURCE_NOT_FOUND", message: "ham" }),
    );
    await expect(Page({ params: Promise.resolve({ userId }) })).rejects.toThrowError("NOT_FOUND");

    readApplicantDossier.mockRejectedValue(
      new ApiError({ status: 503, errorCode: "SERVICE_UNAVAILABLE", errorCategory: "UNEXPECTED", message: "ham" }),
    );
    render(await Page({ params: Promise.resolve({ userId }) }));
    expect(screen.getByRole("alert")).toBeVisible();
    expect(screen.queryByText("ham")).toBeNull();
  });
});
