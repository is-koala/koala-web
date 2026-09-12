import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const enterShell = vi.hoisted(() => vi.fn());
const redirect = vi.hoisted(() => vi.fn());
const router = vi.hoisted(() => ({ replace: vi.fn() }));
const getCurrentIdentityReview = vi.hoisted(() => vi.fn());

vi.mock("@/server/session/viewer", () => ({ enterShell }));
vi.mock("@/server/identity/documents", () => ({
  getCurrentIdentityReview,
}));
vi.mock("next/navigation", () => ({ redirect, useRouter: () => router }));

import Page from "./page";

describe("kimlik belge ekranı", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    enterShell.mockResolvedValue({
      viewer: { identityVerified: false, firstName: "Ayşe", lastName: "Yılmaz" },
      failure: null,
    });
    getCurrentIdentityReview.mockResolvedValue(null);
  });

  it("oturum kapısının arkasında dört TCKK fotoğrafı yükleme formunu çizer", async () => {
    render(await Page({ searchParams: Promise.resolve({}) }));

    expect(enterShell).toHaveBeenCalled();
    expect(getCurrentIdentityReview).toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Kimliğini belgelerle doğrula" })).toBeVisible();
    expect(screen.getByText(/dört fotoğraf yükle/i)).toBeVisible();
    expect(screen.getByLabelText("Yüz fotoğrafı")).toBeVisible();
    expect(screen.getByLabelText("Kimlik ön yüzü")).toBeVisible();
    expect(screen.getByLabelText("Kimlik arka yüzü")).toBeVisible();
    expect(screen.getByLabelText("Kimlik yüzün altında")).toBeVisible();
    expect(screen.getByLabelText("T.C. kimlik numarası")).toBeVisible();
    expect(screen.queryByRole("link", { name: "Uygulamada aç" })).toBeNull();
    expect(screen.queryByLabelText(/sod|dg1|çip/i)).toBeNull();
  });

  it("bekleyen incelemede formu kapatır", async () => {
    getCurrentIdentityReview.mockResolvedValueOnce({
      status: "PENDING",
      rejectionReason: null,
    });

    render(await Page({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole("heading", { name: "Belgelerin inceleniyor" })).toBeVisible();
    expect(screen.getByText(/personel kuyruğunda/i)).toBeVisible();
    expect(screen.queryByLabelText("Kimlik ön yüzü")).toBeNull();
  });

  it("red gerekçesini gösterip yeniden yüklemeye izin verir", async () => {
    getCurrentIdentityReview.mockResolvedValueOnce({
      status: "REJECTED",
      rejectionReason: "Fotoğraflar okunaksız",
    });

    render(await Page({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole("heading", { name: "Belgelerin reddedildi" })).toBeVisible();
    expect(screen.getByText(/Fotoğraflar okunaksız/)).toBeVisible();
    expect(screen.getByLabelText("Kimlik ön yüzü")).toBeVisible();
  });

  it("dönüş yolunu doğrulama sonrası devam bağlantısında taşır", async () => {
    render(
      await Page({
        searchParams: Promise.resolve({ next: "/isveren/ilan/yeni" }),
      }),
    );

    expect(screen.getByRole("link", { name: "Doğruladıktan sonra devam et" })).toHaveAttribute(
      "href",
      "/isveren/ilan/yeni",
    );
  });

  it("dışarıya çıkan next değerini devam bağlantısına yazmaz", async () => {
    render(
      await Page({
        searchParams: Promise.resolve({ next: "https://evil.example/phish" }),
      }),
    );

    expect(screen.queryByRole("link", { name: "Doğruladıktan sonra devam et" })).toBeNull();
  });

  it("kimlik ekranının query varyantını kendi devam hedefi yapmaz", async () => {
    render(
      await Page({
        searchParams: Promise.resolve({
          next: "/kimlik-dogrula?next=%2Fisveren%2Filan%2Fyeni",
        }),
      }),
    );

    expect(screen.queryByRole("link", { name: "Doğruladıktan sonra devam et" })).toBeNull();
  });

  it("doğrulanmış kullanıcıyı dönüş yoluna bırakır", async () => {
    enterShell.mockResolvedValueOnce({
      viewer: { identityVerified: true, firstName: "Ayşe" },
      failure: null,
    });
    redirect.mockImplementation((destination: string) => {
      throw new Error(`NEXT_REDIRECT:${destination}`);
    });

    await expect(
      Page({ searchParams: Promise.resolve({ next: "/isveren/sirket/yeni" }) }),
    ).rejects.toThrow("NEXT_REDIRECT:/isveren/sirket/yeni");
    expect(getCurrentIdentityReview).not.toHaveBeenCalled();
  });

  it("oturum kapısı yönlendirirse ekranı çizmez", async () => {
    enterShell.mockRejectedValueOnce(new Error("NEXT_REDIRECT"));

    await expect(Page({ searchParams: Promise.resolve({}) })).rejects.toThrow("NEXT_REDIRECT");
    expect(getCurrentIdentityReview).not.toHaveBeenCalled();
  });
});
