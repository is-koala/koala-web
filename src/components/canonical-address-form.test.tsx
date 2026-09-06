import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { AddressCandidate, AddressSuggestion, AddressWrite } from "@/address/contract";
import { AddressGatewayError, type AddressGateway } from "@/address/gateway-client";

import { CanonicalAddressForm, type PositionPickerProps } from "./canonical-address-form";

const suggestion: AddressSuggestion = {
  id: "9c1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f60",
  mainText: "Büyükdere Caddesi 12",
  secondaryText: "Levent, Beşiktaş",
};

const candidate = {
  countryId: "2f0a1e58-6a3c-4a3f-9a10-6a1c2d3e4f52",
  countryName: "Türkiye",
  countryCode: "TR",
  cityId: "6f0a1e58-6a3c-4a3f-9a10-6a1c2d3e4f50",
  cityName: "İstanbul",
  districtId: "1f0a1e58-6a3c-4a3f-9a10-6a1c2d3e4f51",
  districtName: "Beşiktaş",
  components: {
    neighborhood: "Levent",
    thoroughfare: "Büyükdere Caddesi",
    buildingNumber: "12",
    postalCode: "34330",
  },
  position: { latitude: 41.081235, longitude: 29.008765, source: "AUTOCOMPLETE_CONFIRMED" },
  candidateToken: "aday-token-yer-tutucu",
  needsUserReview: false,
  attribution: "Google Maps",
} satisfies AddressCandidate;

function fakeGateway(overrides: Partial<AddressGateway> = {}): AddressGateway {
  return {
    startSession: vi.fn(async () => ({
      id: "3b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f6e",
      expiresAt: new Date(Date.now() + 300_000).toISOString(),
    })),
    suggestions: vi.fn(async () => [suggestion]),
    resolve: vi.fn(async () => candidate),
    reverse: vi.fn(async () => candidate),
    countries: vi.fn(async () => [{ id: candidate.countryId, name: "Türkiye", code: "TR" }]),
    cities: vi.fn(async () => [{ id: candidate.cityId, name: "İstanbul" }]),
    districts: vi.fn(async () => [{ id: candidate.districtId, name: "Beşiktaş" }]),
    ...overrides,
  };
}

function renderForm(gateway: AddressGateway = fakeGateway()) {
  const view = render(<CanonicalAddressForm gateway={gateway} debounceMs={0} />);
  return {
    ...view,
    user: userEvent.setup(),
    body(): AddressWrite | null {
      const field = view.container.querySelector<HTMLInputElement>('input[name="address"]');
      return field?.value ? (JSON.parse(field.value) as AddressWrite) : null;
    },
  };
}

async function pickFromSearch(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Adres ara"), "büyükdere");
  await user.click(await screen.findByRole("option", { name: /Büyükdere Caddesi 12/ }));
}

describe("kanonik adres formu", () => {
  it("aramadan seçilen adayı alanlara yazar ve kanıtı gövdeye taşır", async () => {
    const { user, body } = renderForm();

    await pickFromSearch(user);

    expect(await screen.findByLabelText("Mahalle")).toHaveValue("Levent");
    expect(screen.getByLabelText("Cadde veya sokak")).toHaveValue("Büyükdere Caddesi");
    expect(screen.getByLabelText("Posta kodu")).toHaveValue("34330");
    expect(body()).toEqual({
      countryId: candidate.countryId,
      cityId: candidate.cityId,
      districtId: candidate.districtId,
      components: {
        neighborhood: "Levent",
        thoroughfare: "Büyükdere Caddesi",
        buildingNumber: "12",
        postalCode: "34330",
      },
      position: { latitude: 41.081235, longitude: 29.008765, source: "AUTOCOMPLETE_CONFIRMED" },
      candidateToken: "aday-token-yer-tutucu",
    });
  });

  it("sağlayıcı şartı olan kaynak metnini ekranda gösterir", async () => {
    const { user } = renderForm();

    await pickFromSearch(user);

    expect(await screen.findByText(/Google Maps/)).toBeInTheDocument();
  });

  it("arama sürerken ve sonuç yokken ekran durumlarını ayırır", async () => {
    const gateway = fakeGateway({ suggestions: vi.fn(async () => []) });
    const { user } = renderForm(gateway);

    await user.type(screen.getByLabelText("Adres ara"), "burada-yok");

    expect(await screen.findByRole("status")).toHaveTextContent("Eşleşen adres bulunamadı");
  });

  it("sağlayıcı hatasını kodla çözülmüş metinle gösterir ve alanları kilitlemez", async () => {
    const gateway = fakeGateway({
      suggestions: vi.fn(async () => {
        throw new AddressGatewayError("ADDRESS_SEARCHPROVIDER_UNAVAILABLE", 502);
      }),
    });
    const { user } = renderForm(gateway);

    await user.type(screen.getByLabelText("Adres ara"), "büyükdere");

    expect(await screen.findByRole("alert")).toHaveTextContent("Adres araması şu anda çalışmıyor");
    expect(screen.getByLabelText("Mahalle")).toBeEnabled();
    // Elle seçim yedeği kendiliğinden açılır: arama olmadan tek yol bu.
    expect(await screen.findByLabelText("Ülke")).toBeInTheDocument();
  });

  it("sağlayıcı hatasından sonra aramayı yeniden denemeye izin verir", async () => {
    let down = true;
    const gateway = fakeGateway({
      suggestions: vi.fn(async () => {
        if (down) throw new AddressGatewayError("ADDRESS_SEARCHPROVIDER_UNAVAILABLE", 502);
        return [suggestion];
      }),
    });
    const { user } = renderForm(gateway);

    await user.type(screen.getByLabelText("Adres ara"), "büyükdere");
    await screen.findByRole("alert");

    down = false;
    await user.click(screen.getByRole("button", { name: "Aramayı yeniden dene" }));

    expect(await screen.findByRole("option", { name: /Büyükdere Caddesi 12/ })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("kullanıcı konumu elle onayladığında kanıtı düşürür", async () => {
    const { user, body } = renderForm();

    await pickFromSearch(user);
    await screen.findByLabelText("Mahalle");

    const latitude = screen.getByLabelText("Enlem");
    await user.clear(latitude);
    await user.type(latitude, "41.05");
    await user.click(screen.getByRole("button", { name: "Konumu onayla" }));

    const written = body();
    expect(written?.position).toEqual({
      latitude: 41.05,
      longitude: 29.008765,
      source: "USER_CONFIRMED_PIN",
    });
    expect(written && "candidateToken" in written).toBe(false);
  });

  it("konumdan adres önerisi istendiğinde ters çözümleme kaynağını işaretler", async () => {
    const reverseCandidate: AddressCandidate = {
      ...candidate,
      candidateToken: "ters-kanit",
      position: { ...candidate.position, source: "REVERSE_GEOCODE_CONFIRMED" },
    };
    const gateway = fakeGateway({ reverse: vi.fn(async () => reverseCandidate) });
    const { user, body } = renderForm(gateway);

    await user.click(screen.getByRole("button", { name: "Bu konumdan adres öner" }));

    expect(await screen.findByLabelText("Mahalle")).toHaveValue("Levent");
    expect(body()?.position.source).toBe("REVERSE_GEOCODE_CONFIRMED");
    expect(body()?.candidateToken).toBe("ters-kanit");
  });

  it("hizmet alanı dışındaki konumu ağ geçidine sormadan reddeder", async () => {
    const gateway = fakeGateway();
    const { user } = renderForm(gateway);

    const latitude = screen.getByLabelText("Enlem");
    await user.clear(latitude);
    await user.type(latitude, "39.92");
    await user.click(screen.getByRole("button", { name: "Konumu onayla" }));

    expect(await screen.findByText("Koala şu anda yalnızca İstanbul'da hizmet veriyor."))
      .toBeInTheDocument();
    expect(gateway.reverse).not.toHaveBeenCalled();
  });

  it("gözden geçirme isteyen adayı kullanıcı onaylamadan göndermez", async () => {
    const gateway = fakeGateway({
      resolve: vi.fn(async () => ({ ...candidate, needsUserReview: true })),
    });
    const { user, body } = renderForm(gateway);

    await pickFromSearch(user);
    const confirmation = await screen.findByLabelText(/Adres bilgilerini kontrol ettim/);

    expect(body()).toBeNull();
    await user.click(confirmation);
    expect(body()).not.toBeNull();
  });

  it("öneri listesinde klavyeyle gezinip seçim yapılabilir", async () => {
    const { user, body } = renderForm();

    await user.type(screen.getByLabelText("Adres ara"), "büyükdere");
    await screen.findByRole("listbox");
    await user.keyboard("{ArrowDown}{Enter}");

    expect(await screen.findByLabelText("Mahalle")).toHaveValue("Levent");
    expect(body()?.candidateToken).toBe("aday-token-yer-tutucu");
  });

  it("elle seçilen il ve ilçeyi gövdeye taşır", async () => {
    const gateway = fakeGateway();
    const { user, body } = renderForm(gateway);

    await user.click(screen.getByRole("button", { name: "Ülke, il ve ilçeyi elle seç" }));
    await user.selectOptions(await screen.findByLabelText("Ülke"), candidate.countryId);
    await user.selectOptions(await screen.findByLabelText("İl"), candidate.cityId);
    await user.selectOptions(await screen.findByLabelText("İlçe"), candidate.districtId);

    await user.type(screen.getByLabelText("Mahalle"), "Levent");
    await user.type(screen.getByLabelText("Cadde veya sokak"), "Büyükdere Caddesi");
    await user.type(screen.getByLabelText("Bina numarası"), "12");
    await user.type(screen.getByLabelText("Posta kodu"), "34330");
    await user.click(screen.getByRole("button", { name: "Konumu onayla" }));

    expect(body()).toMatchObject({
      countryId: candidate.countryId,
      cityId: candidate.cityId,
      districtId: candidate.districtId,
      position: { source: "USER_CONFIRMED_PIN" },
    });
    expect(gateway.districts).toHaveBeenCalledWith(candidate.cityId);
  });

  it("elle seçim listesi yüklenirken ve düşerken kendi durumlarını gösterir", async () => {
    // Bu bölüm sağlayıcı düştüğünde tek çıkış yolu; kendi hatası sessiz
    // kalırsa kullanıcı boş üç kutuyla baş başa kalır.
    const gateway = fakeGateway({
      countries: vi.fn(async () => {
        throw new AddressGatewayError("UNEXPECTED", 500);
      }),
    });
    const { user } = renderForm(gateway);

    await user.click(screen.getByRole("button", { name: "Ülke, il ve ilçeyi elle seç" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Bir sorun oluştu");
    expect(screen.queryByLabelText("Ülke")).not.toBeInTheDocument();
  });

  it("elle seçim listesi boş dönerse bunu söyler", async () => {
    const gateway = fakeGateway({ countries: vi.fn(async () => []) });
    const { user } = renderForm(gateway);

    await user.click(screen.getByRole("button", { name: "Ülke, il ve ilçeyi elle seç" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Ülke listesi alınamadı");
  });

  it("sağlayıcı şartını öneri listesi ekrandayken de gösterir", async () => {
    // Öneriler de sağlayıcının verisi; `AddressSuggestionDto` attribution
    // taşımadığı için aday çözümlenene kadar nötr bir kaynak cümlesi durur.
    const { user } = renderForm();

    await user.type(screen.getByLabelText("Adres ara"), "büyükdere");
    await screen.findByRole("listbox");

    const search = screen.getByRole("region", { name: "Adres arama" });
    expect(within(search).getByText(/adres sağlayıcısından/)).toBeInTheDocument();
  });

  it("ters çözümleme 502 verdiğinde de elle seçimi açar", async () => {
    const gateway = fakeGateway({
      reverse: vi.fn(async () => {
        throw new AddressGatewayError("ADDRESS_SEARCHPROVIDER_UNAVAILABLE", 502);
      }),
    });
    const { user } = renderForm(gateway);

    await user.click(screen.getByRole("button", { name: "Bu konumdan adres öner" }));

    expect(await screen.findByLabelText("Ülke")).toBeInTheDocument();
  });

  it("konumu yeniden onaylamak gözden geçirme onayını düşürmez", async () => {
    // Onay adayın eksik bileşenleri içindi; koordinatı doğrulamak o eksiği
    // kapatmıyor.
    const gateway = fakeGateway({
      resolve: vi.fn(async () => ({ ...candidate, needsUserReview: true })),
    });
    const { user, body } = renderForm(gateway);

    await pickFromSearch(user);
    await screen.findByLabelText(/Adres bilgilerini kontrol ettim/);
    await user.click(screen.getByRole("button", { name: "Konumu onayla" }));

    expect(screen.getByLabelText(/Adres bilgilerini kontrol ettim/)).toBeInTheDocument();
    expect(body()).toBeNull();
  });

  it("konum seçimini dışarıdan gelen bir bileşene devredebilir", async () => {
    // Harita seçici (#28) formu yeniden şekillendirmeden bu yuvaya girecek.
    const seen: PositionPickerProps[] = [];
    render(
      <CanonicalAddressForm
        gateway={fakeGateway()}
        debounceMs={0}
        renderPositionPicker={(props) => {
          seen.push(props);
          return <p>Harita buraya gelecek</p>;
        }}
      />,
    );

    expect(screen.getByText("Harita buraya gelecek")).toBeInTheDocument();
    expect(screen.queryByLabelText("Enlem")).not.toBeInTheDocument();
    expect(seen[0].serviceArea).toEqual({ south: 40.8, west: 28.55, north: 41.35, east: 29.5 });
    expect(seen[0].defaultCenter).toEqual({ latitude: 41.008238, longitude: 28.978359 });
    expect(seen[0].position).toBeNull();
    expect(typeof seen[0].confirmPosition).toBe("function");
    expect(typeof seen[0].suggestFromPosition).toBe("function");
  });

  it("aday seçildiğinde öneri listesini kapatır", async () => {
    const { user } = renderForm();

    await pickFromSearch(user);

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("seçilen adayın idari bölümünü okunur biçimde gösterir", async () => {
    const { user } = renderForm();

    await pickFromSearch(user);

    const summary = await screen.findByTestId("address-reference-summary");
    expect(within(summary).getByText(/Beşiktaş/)).toBeInTheDocument();
  });
});
