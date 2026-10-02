import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Page, { metadata } from "./page";

describe("abonelikten çıkma sayfası", () => {
  it("arama motoruna kapalı ve tokenı Referer ile sızdırmaz", () => {
    // Başlık politikası `private-routes.ts`'ten geliyor; meta etiketi ters
    // vekil başlığı düşürse bile tarayıcıyı aynı kurala bağlar.
    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(metadata.referrer).toBe("no-referrer");
  });

  it("onay düğmesini ve tercihi yalnız onayın değiştirdiğini gösterir", () => {
    window.history.replaceState({}, "", "/bildirim-tercihleri/cikis?token=abc");

    render(<Page />);

    expect(screen.getByRole("heading", { level: 1, name: "Abonelikten çık" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Abonelikten çık" })).toBeVisible();
    expect(screen.getByText("Düğmeye basmadan hiçbir tercihin değişmez.")).toBeVisible();
  });
});
