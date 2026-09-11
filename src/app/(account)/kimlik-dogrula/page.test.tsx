import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const enterShell = vi.hoisted(() => vi.fn());
const redirect = vi.hoisted(() => vi.fn());

vi.mock("@/server/session/viewer", () => ({ enterShell }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/app/(account)/kimlik-dogrula/actions", () => ({
  submitIdentityDocumentsAction: async () => ({ status: "idle" }),
}));

import Page from "./page";

describe("kimlik belge ekranı", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    enterShell.mockResolvedValue({
      viewer: { identityVerified: false, firstName: "Ayşe", lastName: "Yılmaz" },
      failure: null,
    });
  });

  it("oturum kapısının arkasında TCKK ön ve arka yükleme formunu çizer", async () => {
    render(await Page({ searchParams: Promise.resolve({}) }));

    expect(enterShell).toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Kimliğini belgelerle doğrula" })).toBeVisible();
    expect(screen.getByText(/ön ve arka yüzünün fotoğrafını/i)).toBeVisible();
    expect(screen.getByLabelText("Kimlik ön yüzü")).toBeVisible();
    expect(screen.getByLabelText("Kimlik arka yüzü")).toBeVisible();
    expect(screen.getByLabelText("T.C. kimlik numarası")).toBeVisible();
    expect(screen.queryByRole("link", { name: "Uygulamada aç" })).toBeNull();
    expect(screen.queryByLabelText(/sod|dg1|çip/i)).toBeNull();
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
  });

  it("oturum kapısı yönlendirirse ekranı çizmez", async () => {
    enterShell.mockRejectedValueOnce(new Error("NEXT_REDIRECT"));

    await expect(Page({ searchParams: Promise.resolve({}) })).rejects.toThrow("NEXT_REDIRECT");
  });
});
