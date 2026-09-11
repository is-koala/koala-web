import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { CanonicalAddress } from "@/address/contract";

import { AddressView } from "./address-view";

const address: CanonicalAddress = {
  countryName: "Türkiye",
  cityName: "İstanbul",
  districtName: "Beşiktaş",
  components: {
    neighborhood: "Levent",
    thoroughfare: "Büyükdere Caddesi",
    buildingNumber: "12",
    floor: "3",
    unitNumber: "7",
    postalCode: "34330",
  },
  displayAddress: null,
  needsReview: false,
};

describe("salt okunur adres görünümü", () => {
  it("bileşenleri okunur bir Türkçe satıra dizer", () => {
    render(<AddressView address={address} />);

    expect(screen.getByText(/Büyükdere Caddesi No: 12 Kat: 3 Daire: 7/)).toBeInTheDocument();
    expect(screen.getByText(/Levent, Beşiktaş\/İstanbul 34330/)).toBeInTheDocument();
  });

  it("backend biçimlendirilmiş adresi verdiyse onu kullanır", () => {
    render(<AddressView address={{ ...address, displayAddress: "Backend'in yazdığı adres" }} />);

    expect(screen.getByText("Backend'in yazdığı adres")).toBeInTheDocument();
  });

  it("adres yokken boş durumu gösterir", () => {
    render(<AddressView address={null} />);

    expect(screen.getByRole("status")).toHaveTextContent("Adres eklenmemiş");
  });

  it("gözden geçirme bekleyen adresi işaretler", () => {
    render(<AddressView address={{ ...address, needsReview: true }} />);

    expect(screen.getByText(/kontrol edilmesi gerekiyor/)).toBeInTheDocument();
  });

  it("kayıtlı koordinatı altı ondalıkla gösterir", () => {
    render(
      <AddressView
        address={{
          ...address,
          displayAddress: "Backend'in yazdığı adres",
          position: { latitude: 41.081235, longitude: 29.008765 },
        }}
      />,
    );

    expect(screen.getByText("41.081235, 29.008765")).toBeInTheDocument();
  });
});
