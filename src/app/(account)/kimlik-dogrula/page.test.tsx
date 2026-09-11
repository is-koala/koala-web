import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const enterShell = vi.hoisted(() => vi.fn());
const redirect = vi.hoisted(() => vi.fn());

vi.mock("@/server/session/viewer", () => ({ enterShell }));
vi.mock("@/lib/env", () => ({
  publicEnvironment: () => ({
    siteUrl: "https://iskoala.com",
    appUrlScheme: "koala",
    androidPackageId: "com.iskoala.koala",
    iosAppStoreId: "123456",
  }),
}));
vi.mock("@/components/open-in-app", () => ({
  OpenInApp: ({ deepLink }: { deepLink: string }) => <a href={deepLink}>Uygulamada aç</a>,
}));
vi.mock("next/navigation", () => ({ redirect }));

import Page from "./page";

describe("kimlik aktarım ekranı", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    enterShell.mockResolvedValue({
      viewer: { identityVerified: false, firstName: "Ayşe" },
      failure: null,
    });
  });

  it("oturum kapısının arkasında Türkçe gerekçeyi ve uygulama aktarımını çizer", async () => {
    render(await Page({ searchParams: Promise.resolve({}) }));

    expect(enterShell).toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Kimliğini uygulamada doğrula" })).toBeVisible();
    expect(screen.getByText(/kimlik belgenin çipini/i)).toBeVisible();
    expect(screen.getByRole("link", { name: "Uygulamada aç" })).toHaveAttribute("href", "koala://");
    expect(screen.queryByLabelText(/t\.?c\.?|kimlik no|belge/i)).toBeNull();
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
