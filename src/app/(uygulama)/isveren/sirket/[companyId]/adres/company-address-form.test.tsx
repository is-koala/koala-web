import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AddressGateway } from "@/address/gateway-client";

import type { CompanyAddressState } from "./state";
import { CompanyAddressForm } from "./company-address-form";

const profileHref = "/isveren/sirket/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const saved = {
  countryName: "Türkiye",
  cityName: "İstanbul",
  districtName: "Beşiktaş",
  components: { neighborhood: "Levent", thoroughfare: "Büyükdere Caddesi", postalCode: "34330" },
  displayAddress: "Büyükdere Caddesi No: 12, Levent / Beşiktaş",
  needsReview: false,
  position: { latitude: 41.081235, longitude: 29.008765 },
};

/** Sağlayıcı kapalı: form elle seçim yedeğine düşer, ağ turu yok. */
function offlineGateway(): AddressGateway {
  return {
    startSession: vi.fn(async () => {
      throw new Error("kapalı");
    }),
    suggestions: vi.fn(async () => []),
    resolve: vi.fn(async () => {
      throw new Error("kapalı");
    }),
    reverse: vi.fn(async () => {
      throw new Error("kapalı");
    }),
    countries: vi.fn(async () => []),
    cities: vi.fn(async () => []),
    districts: vi.fn(async () => []),
  };
}

function renderForm(action: (state: CompanyAddressState, formData: FormData) => Promise<CompanyAddressState>) {
  render(<CompanyAddressForm action={action} profileHref={profileHref} gateway={offlineGateway()} />);
  return userEvent.setup();
}

describe("şirket adresi formu", () => {
  afterEach(cleanup);

  it("kanonik adres bileşenini ve kaydet düğmesini çizer", () => {
    renderForm(async () => ({ status: "idle" }));

    expect(screen.getByRole("combobox", { name: "Adres ara" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Adresi kaydet" })).toBeInTheDocument();
  });

  it("başarıda kaydedilen adresi ve profile dönüş bağlantısını gösterir", async () => {
    const user = renderForm(async () => ({ status: "done", address: saved }));

    await user.click(screen.getByRole("button", { name: "Adresi kaydet" }));

    const notice = await screen.findByRole("status");
    expect(notice).toHaveTextContent("Şirket adresi kaydedildi");
    expect(notice).toHaveTextContent(saved.displayAddress);
    expect(screen.getByRole("link", { name: "Yeni adresi profilde gör" })).toHaveAttribute(
      "href",
      profileHref,
    );
    expect(screen.queryByRole("button", { name: "Adresi kaydet" })).not.toBeInTheDocument();
  });

  it("adresi düşüren eski sunucunun hatasını koddan seçilmiş metinle, formu koruyarak gösterir", async () => {
    // Backend 200 döndü ama adres değişmedi; eylem bunu web'in kendi koduyla
    // bildiriyor. Sayfa kırılmaz: form yerinde kalır, üst bant nedeni yazar.
    const user = renderForm(async () => ({
      status: "error",
      errorCode: "COMPANY_ADDRESS_UPDATE_NOT_APPLIED",
      httpStatus: 200,
    }));

    await user.click(screen.getByRole("button", { name: "Adresi kaydet" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Şirket adresi kaydedilemedi"),
    );
    expect(screen.getByRole("button", { name: "Adresi kaydet" })).toBeInTheDocument();
  });

  it("400'ün alan hatasını adresin altına, üst banda da doğrulama metnini yazar", async () => {
    const user = renderForm(async () => ({
      status: "error",
      errorCode: "VALIDATION_FAILED",
      httpStatus: 400,
      fieldErrors: { address: "Bilinmeyen alan: address", postalCode: "Posta kodu 5 haneli olmalı." },
    }));

    await user.click(screen.getByRole("button", { name: "Adresi kaydet" }));

    expect(await screen.findByText("Bilinmeyen alan: address")).toBeInTheDocument();
    expect(screen.getByText("Posta kodu 5 haneli olmalı.")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
