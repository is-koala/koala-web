import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const enterShell = vi.hoisted(() => vi.fn());
const currentUserAddress = vi.hoisted(() => vi.fn());
const form = vi.hoisted(() => vi.fn(() => <form aria-label="Adres formu" />));

vi.mock("@/server/session/viewer", () => ({ enterShell, currentUserAddress }));
vi.mock("./applicant-address-form", () => ({ ApplicantAddressForm: form }));

import Page from "./page";

describe("iş arayan adres sayfası", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    enterShell.mockResolvedValue({ viewer: { firstName: "Ayşe" }, failure: null });
    currentUserAddress.mockResolvedValue(null);
  });

  it("kabuk kapısının arkasında kanonik formu çizer", async () => {
    render(await Page());

    expect(enterShell).toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Adresin" })).toBeVisible();
    expect(form).toHaveBeenCalled();
    expect(screen.queryByRole("heading", { name: "Kayıtlı adres" })).toBeNull();
  });

  it("kayıtlı adresi formun üstünde gösterir", async () => {
    currentUserAddress.mockResolvedValue({
      countryName: "Türkiye",
      cityName: "İstanbul",
      districtName: "Beşiktaş",
      components: { thoroughfare: "Büyükdere Caddesi" },
      displayAddress: "Büyükdere Caddesi No: 12, Levent / Beşiktaş",
      needsReview: false,
      position: { latitude: 41.081235, longitude: 29.008765 },
    });

    render(await Page());

    expect(screen.getByRole("heading", { name: "Kayıtlı adres" })).toBeVisible();
    expect(screen.getByText("Büyükdere Caddesi No: 12, Levent / Beşiktaş")).toBeVisible();
  });

  it("oturum kapısı yönlendirirse adresi okumaz", async () => {
    enterShell.mockRejectedValueOnce(new Error("NEXT_REDIRECT"));

    await expect(Page()).rejects.toThrow("NEXT_REDIRECT");
    expect(currentUserAddress).not.toHaveBeenCalled();
  });
});
