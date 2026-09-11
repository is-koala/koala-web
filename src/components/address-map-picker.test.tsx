import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { AddressCandidate, Coordinates } from "@/address/contract";
import { defaultMapCenter, istanbulServiceArea } from "@/address/contract";
import { AddressGatewayError } from "@/address/gateway-client";
import type { MapSurface } from "@/address/maps";

import {
  AddressMapPicker,
  type AddressMapPickerProps,
} from "./address-map-picker";

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
  position: { latitude: 41.008238, longitude: 28.978359, source: "REVERSE_GEOCODE_CONFIRMED" },
  candidateToken: "ters-kanit",
  needsUserReview: false,
  attribution: "Google Maps",
} satisfies AddressCandidate;

function fakeMap(initial: Coordinates = defaultMapCenter) {
  let center = { ...initial };
  let onIdle: ((position: Coordinates) => void) | null = null;
  const attach = vi.fn<MapSurface["attach"]>((_element, options) => {
    center = { ...options.center };
    onIdle = options.onIdle;
    return {
      getCenter: () => center,
      destroy: vi.fn(),
    };
  });

  return {
    surface: { attach } satisfies MapSurface,
    options: () => attach.mock.calls[0]?.[1],
    pan(next: Coordinates) {
      center = next;
      onIdle?.(center);
    },
  };
}

function pickerProps(
  overrides: Partial<AddressMapPickerProps> = {},
): AddressMapPickerProps {
  return {
    position: null,
    defaultCenter: defaultMapCenter,
    serviceArea: istanbulServiceArea,
    confirmPosition: vi.fn(() => null),
    suggestFromPosition: vi.fn(async () => undefined),
    lookupFromPosition: vi.fn(async () => candidate),
    applyCandidate: vi.fn(),
    status: "idle",
    errorCode: null,
    httpStatus: 0,
    ...overrides,
  };
}

describe("harita seçici", () => {
  it("anahtar boşken Maps betiğini yüklemez ve formu elle tamamlatır", async () => {
    const loadMap = vi.fn();
    const user = userEvent.setup();
    const props = pickerProps({ mapsKey: "", loadMap });

    render(<AddressMapPicker {...props} />);

    expect(loadMap).not.toHaveBeenCalled();
    expect(screen.getByText(/Harita şu anda kullanılamıyor/)).toBeInTheDocument();
    await user.type(screen.getByLabelText("Enlem"), "{Control>}a{/Control}41.05");
    await user.click(screen.getByRole("button", { name: "Konumu onayla" }));
    expect(props.confirmPosition).toHaveBeenCalled();
  });

  it("pin onayında aday ve yalnız pin yollarını ayırır", async () => {
    const map = fakeMap();
    const props = pickerProps({
      mapsKey: "test-key",
      loadMap: async () => map.surface,
    });
    const user = userEvent.setup();

    render(<AddressMapPicker {...props} />);

    await user.click(await screen.findByRole("button", { name: "Bu konumu kullan" }));

    expect(await screen.findByRole("button", { name: "Adresi kullan" })).toBeInTheDocument();
    expect(screen.getAllByText(/Google Maps/).length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "Adresi kullan" }));
    expect(props.applyCandidate).toHaveBeenCalledWith(candidate);

    await user.click(screen.getByRole("button", { name: "Bu konumu kullan" }));
    await user.click(await screen.findByRole("button", { name: "Sadece pini kullan" }));
    expect(props.confirmPosition).toHaveBeenCalledWith({
      latitude: 41.008238,
      longitude: 28.978359,
    });
  });

  it("aday uygulandıktan sonra pin oynayınca kanıtı düşürür", async () => {
    const map = fakeMap();
    const props = pickerProps({
      mapsKey: "test-key",
      loadMap: async () => map.surface,
      position: { latitude: 41.008238, longitude: 28.978359, source: "REVERSE_GEOCODE_CONFIRMED" },
    });
    const user = userEvent.setup();

    render(<AddressMapPicker {...props} />);
    await user.click(await screen.findByRole("button", { name: "Bu konumu kullan" }));
    await user.click(await screen.findByRole("button", { name: "Adresi kullan" }));

    map.pan({ latitude: 41.05, longitude: 29.01 });

    expect(props.confirmPosition).toHaveBeenCalledWith({
      latitude: 41.05,
      longitude: 29.01,
    });
  });

  it("seçilen koordinatı altı ondalıkla gösterir", async () => {
    const map = fakeMap();
    render(
      <AddressMapPicker
        {...pickerProps({ mapsKey: "test-key", loadMap: async () => map.surface })}
      />,
    );

    expect(await screen.findByText("41.008238, 28.978359")).toBeInTheDocument();
  });

  it("kamerayı İstanbul dikdörtgenine kilitler", async () => {
    const map = fakeMap();
    render(
      <AddressMapPicker
        {...pickerProps({ mapsKey: "test-key", loadMap: async () => map.surface })}
      />,
    );

    await screen.findByRole("button", { name: "Bu konumu kullan" });
    expect(map.options()?.bounds).toEqual(istanbulServiceArea);
    expect(map.options()?.minZoom).toBe(10);
    expect(map.options()?.maxZoom).toBe(20);
    expect(map.options()?.zoom).toBe(15);
  });

  it("ters çözümleme 502 verdiğinde pini korur ve formu kilitlemez", async () => {
    const map = fakeMap();
    const user = userEvent.setup();
    const props = pickerProps({
      mapsKey: "test-key",
      loadMap: async () => map.surface,
      lookupFromPosition: vi.fn(async () => {
        throw new AddressGatewayError("ADDRESS_SEARCHPROVIDER_UNAVAILABLE", 502);
      }),
      status: "error",
      errorCode: "ADDRESS_SEARCHPROVIDER_UNAVAILABLE",
      httpStatus: 502,
    });

    render(<AddressMapPicker {...props} />);
    await user.click(await screen.findByRole("button", { name: "Bu konumu kullan" }));

    await waitFor(() => expect(props.lookupFromPosition).toHaveBeenCalled());
    expect(props.confirmPosition).toHaveBeenCalledWith({
      latitude: 41.008238,
      longitude: 28.978359,
    });
    expect(screen.queryByRole("button", { name: "Adresi kullan" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Enlem")).toBeEnabled();
    expect(screen.getByRole("button", { name: "Konumu onayla" })).toBeEnabled();
  });
});
