import { fireEvent, render, screen } from "@testing-library/react";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenInApp } from "./open-in-app";

describe("OpenInApp", () => {
  afterEach(() => vi.useRealTimers());

  it("iOS'ta kullanıcı dokunmadan şema tetiklemez ve görünür kalırsa mağazaya gider", () => {
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
    expect(navigate).toHaveBeenLastCalledWith("https://apps.apple.com/tr/app/id1");
  });

  it("uygulama sayfayı gizlediyse mağaza yedeğini çalıştırmaz", () => {
    vi.useFakeTimers();
    const navigate = vi.fn();
    render(
      <OpenInApp
        deepLink="koala://sifre-sifirla?token=t"
        storeLink="https://apps.apple.com/tr/app/id1"
        platformOverride="ios"
        navigate={navigate}
      />,
    );

    fireEvent.click(screen.getByRole("link", { name: "Uygulamada aç" }));
    fireEvent.pageHide(window);
    act(() => vi.advanceTimersByTime(1500));

    expect(navigate).toHaveBeenCalledTimes(1);
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
});
