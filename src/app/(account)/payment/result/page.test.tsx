import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/server/api/errors";

const readPaymentReconciliation = vi.hoisted(() => vi.fn());
const readSession = vi.hoisted(() => vi.fn());
const requireSessionForCurrentPath = vi.hoisted(() => vi.fn());
const headers = vi.hoisted(() => vi.fn());
const redirect = vi.hoisted(() => vi.fn());

vi.mock("@/server/payments/payments", () => ({ readPaymentReconciliation }));
vi.mock("@/server/session/session", () => ({ readSession }));
vi.mock("@/server/session/guard", () => ({ requireSessionForCurrentPath }));
vi.mock("next/headers", () => ({ headers }));
vi.mock("@/lib/env", () => ({ publicEnvironment: () => ({
  siteUrl: "https://iskoala.com",
  appUrlScheme: "koala",
  androidPackageId: "com.iskoala.koala",
  iosAppStoreId: "123456",
}) }));
vi.mock("@/components/open-in-app", () => ({
  OpenInApp: ({ deepLink }: { deepLink: string }) => <a href={deepLink}>Uygulamada aç</a>,
}));
vi.mock("next/navigation", () => ({
  redirect,
  unstable_rethrow: vi.fn(),
  useRouter: () => ({ replace: vi.fn() }),
}));

import Page from "./page";

const assignmentId = "3b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f6e";

describe("ödeme dönüşü", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readSession.mockResolvedValue({ refreshToken: "refresh-placeholder" });
    headers.mockResolvedValue({ get: () => "Mozilla/5.0 (iPhone) Mobile" });
  });

  it("query success dese bile sonucu backend ataması ve denemelerinden doğrular", async () => {
    readPaymentReconciliation.mockResolvedValue({
      assignment: { id: assignmentId },
      attempts: [{ id: "attempt-1", status: "FAILED" }],
      resolution: "failed",
    });

    await Page({
      searchParams: Promise.resolve({ status: "success", assignmentId }),
    });

    expect(readPaymentReconciliation).toHaveBeenCalledWith(assignmentId);
    expect(redirect).toHaveBeenCalledWith(
      `/isveren/atama/${assignmentId}?paymentReturn=1`,
    );
    expect(redirect.mock.calls[0][0]).not.toContain("success");
  });

  it("oturumu olmayan mobil dönüşü login'e göndermeden uygulama deep-linkini korur", async () => {
    readSession.mockResolvedValue({ refreshToken: null });

    render(await Page({
      searchParams: Promise.resolve({ status: "success", assignmentId }),
    }));

    expect(screen.getByRole("link", { name: "Uygulamada aç" })).toHaveAttribute(
      "href",
      `koala://payment-result?status=success&assignmentId=${assignmentId}`,
    );
    expect(readPaymentReconciliation).not.toHaveBeenCalled();
  });

  it.each([
    ["success", "Ödeme dönüşü alındı"],
    ["failed", "Ödeme tamamlanamadı bildirimi alındı"],
  ] as const)(
    "oturumsuz masaüstü %s dönüşünde boş gövde çizmez ve ana sayfaya dönüş verir",
    async (status, heading) => {
      readSession.mockResolvedValue({ refreshToken: null });
      headers.mockResolvedValue({ get: () => "Mozilla/5.0 (Macintosh)" });

      const view = await Page({
        searchParams: Promise.resolve({ status, assignmentId }),
      });

      expect(view).not.toBeNull();
      render(view);

      expect(screen.getByRole("heading", { name: heading })).toBeVisible();
      expect(screen.getByText(/Otomatik kontrol oturum olmadan yapılamaz/)).toBeVisible();
      expect(screen.getByRole("link", { name: "Ana sayfaya dön" })).toHaveAttribute("href", "/");
      expect(screen.getByRole("link", { name: "İş ilanları" })).toHaveAttribute(
        "href",
        "/is-ilanlari",
      );
      expect(screen.queryByRole("link", { name: "Uygulamada aç" })).toBeNull();
      expect(requireSessionForCurrentPath).not.toHaveBeenCalled();
      expect(readPaymentReconciliation).not.toHaveBeenCalled();
      expect(redirect).not.toHaveBeenCalled();
    },
  );

  it("user-agent yokken masaüstü oturumsuz sonucu çizer", async () => {
    readSession.mockResolvedValue({ refreshToken: null });
    headers.mockResolvedValue({ get: () => null });

    const view = await Page({
      searchParams: Promise.resolve({ status: "success", assignmentId }),
    });

    expect(view).not.toBeNull();
    render(view);

    expect(screen.getByRole("heading", { name: "Ödeme dönüşü alındı" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Ana sayfaya dön" })).toHaveAttribute("href", "/");
    expect(requireSessionForCurrentPath).not.toHaveBeenCalled();
  });

  it("oturumlu mutabakat hatasını backend mesajıyla değil errorCode kataloğuyla çizer", async () => {
    readPaymentReconciliation.mockRejectedValue(
      new ApiError({
        status: 502,
        errorCode: "PAYMENT_PROVIDER_UNAVAILABLE",
        errorCategory: "EXTERNAL_SERVICE",
        message: "iyzico retrieve timed out after 30s",
      }),
    );

    render(
      await Page({
        searchParams: Promise.resolve({ status: "success", assignmentId }),
      }),
    );

    expect(screen.getByRole("heading", { name: "Ödeme sağlayıcısına ulaşılamadı" })).toBeVisible();
    expect(screen.queryByText(/iyzico retrieve timed out/i)).toBeNull();
    expect(requireSessionForCurrentPath).not.toHaveBeenCalled();
  });

  it("mutabakat bekliyorsa kesin sonuç yazmadan bekleme durumunu gösterir", async () => {
    readPaymentReconciliation.mockResolvedValue({
      assignment: { id: assignmentId },
      attempts: [{ id: "attempt-1", status: "INITIATED" }],
      resolution: "pending",
    });

    render(await Page({
      searchParams: Promise.resolve({ status: "failed", assignmentId }),
    }));

    expect(screen.getByRole("heading", { name: "Ödeme tamamlanamadı bildirimi alındı" })).toBeVisible();
    expect(screen.getByText(/backend'den doğruluyor/i)).toBeVisible();
    expect(screen.queryByText(/ödeme başarılı/i)).toBeNull();
    expect(screen.queryByText(/ödeme başarısız/i)).toBeNull();
  });

  it("geçersiz dönüşte oturum veya ödeme backend'ine çıkmaz", async () => {
    render(await Page({
      searchParams: Promise.resolve({ status: "success", assignmentId: "42" }),
    }));

    expect(screen.getByRole("heading", { name: "Ödeme sonucu okunamadı" })).toBeVisible();
    expect(readSession).not.toHaveBeenCalled();
    expect(readPaymentReconciliation).not.toHaveBeenCalled();
  });
});
