import { fireEvent, render, screen } from "@testing-library/react";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { consentStorageKey, serializeConsent } from "@/analytics/consent";
import { OpenInApp } from "./open-in-app";

describe("OpenInApp", () => {
  afterEach(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    vi.useRealTimers();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("iOS'ta uygulama açılmazsa kullanıcıyı zamanlayıcıyla mağazaya zorlamaz", () => {
    vi.useFakeTimers();
    const navigate = vi.fn();
    render(
      <OpenInApp
        deepLink="koala://hesap-dogrula?token=t"
        storeLink="https://apps.apple.com/tr/app/id1"
        platformOverride="ios"
        navigate={navigate}
      />,
    );

    expect(navigate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("link", { name: "Uygulamada aç" }));
    expect(navigate).toHaveBeenCalledWith("koala://hesap-dogrula?token=t");

    act(() => vi.advanceTimersByTime(1500));
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("link", { name: "Mağazaya git" })).toHaveAttribute(
      "href",
      "https://apps.apple.com/tr/app/id1",
    );
  });

  it("uygulama sayfayı yeterince uzun süre gizlediyse açılışı ölçer", () => {
    vi.useFakeTimers();
    const navigate = vi.fn();
    localStorage.setItem(consentStorageKey, serializeConsent(true));
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetcher);
    render(
      <OpenInApp
        deepLink="koala://sifre-sifirla?token=t"
        storeLink="https://apps.apple.com/tr/app/id1"
        platformOverride="ios"
        navigate={navigate}
      />,
    );

    fireEvent.click(screen.getByRole("link", { name: "Uygulamada aç" }));
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    fireEvent(document, new Event("visibilitychange"));
    act(() => vi.advanceTimersByTime(1500));

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect((fetcher.mock.calls[1][1] as RequestInit).body).toBe(
      JSON.stringify({ event: "app_opened", platform: "ios" }),
    );
  });

  it("mağaza kimliği yoksa ölü mağaza düğmesi çizmez", () => {
    render(
      <OpenInApp
        deepLink="koala://hesap-dogrula?token=t"
        storeLink={null}
        platformOverride="ios"
      />,
    );

    expect(screen.queryByText("Mağazaya git")).not.toBeInTheDocument();
    expect(screen.getByText("Koala mağazada yayımlandığında burada görünecek.")).toBeVisible();
  });

  it("Android düğmesinde uygulama kurulu değilse mağazaya düşen intenti kullanır", () => {
    render(
      <OpenInApp
        deepLink="koala://payment-result?status=success&assignmentId=1"
        androidIntentLink="intent://payment-result?status=success&assignmentId=1#Intent;scheme=koala;S.browser_fallback_url=https%3A%2F%2Fplay.google.com;end"
        storeLink={null}
        androidStoreLink="https://play.google.com/store/apps/details?id=com.iskoala.koala"
        platformOverride="android"
      />,
    );

    expect(screen.getByRole("link", { name: "Uygulamada aç" })).toHaveAttribute(
      "href",
      expect.stringContaining("S.browser_fallback_url="),
    );
  });

  it("Android denemesini ölçer ama Play Store'a giden pagehide olayını açılış saymaz", () => {
    vi.useFakeTimers();
    localStorage.setItem(consentStorageKey, serializeConsent(true));
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetcher);
    render(
      <OpenInApp
        deepLink="koala://hesap-dogrula?token=secret"
        androidIntentLink="#open-app"
        storeLink={null}
        platformOverride="android"
      />,
    );

    fireEvent.click(screen.getByRole("link", { name: "Uygulamada aç" }));

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect((fetcher.mock.calls[0][1] as RequestInit).body).toBe(
      JSON.stringify({ event: "deep_link_attempted", platform: "android" }),
    );

    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    fireEvent(document, new Event("visibilitychange"));
    fireEvent.pageHide(window);
    act(() => vi.advanceTimersByTime(1500));

    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("elle seçilen mağaza yedeğini ayrı ölçer ve uygulama açılışı üretmez", () => {
    vi.useFakeTimers();
    localStorage.setItem(consentStorageKey, serializeConsent(true));
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetcher);
    render(
      <OpenInApp
        deepLink="koala://hesap-dogrula?token=secret"
        storeLink="https://apps.apple.com/tr/app/id1"
        platformOverride="ios"
        navigate={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("link", { name: "Uygulamada aç" }));
    fireEvent.click(screen.getByRole("link", { name: "Mağazaya git" }));
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    fireEvent(document, new Event("visibilitychange"));
    act(() => vi.advanceTimersByTime(1500));

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect((fetcher.mock.calls[0][1] as RequestInit).body).toBe(
      JSON.stringify({ event: "deep_link_attempted", platform: "ios" }),
    );
    expect((fetcher.mock.calls[1][1] as RequestInit).body).toBe(
      JSON.stringify({ event: "store_fallback", platform: "ios" }),
    );
  });
});
