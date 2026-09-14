import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { parseJobSearchParams } from "@/jobs/search";

import { JobLocationFilter } from "./job-location-filter";

type PositionCallback = (position: { coords: { latitude: number; longitude: number } }) => void;
type ErrorCallback = (error: { code: number; PERMISSION_DENIED: number }) => void;

function stubGeolocation(handler: (success: PositionCallback, failure: ErrorCallback) => void) {
  vi.stubGlobal("navigator", {
    ...navigator,
    geolocation: { getCurrentPosition: vi.fn(handler) },
  });
}

function renderInForm(raw: Record<string, string> = {}) {
  const submit = vi.fn();
  const view = render(
    <form action="/is-ilanlari" method="get" onSubmit={(event) => { event.preventDefault(); submit(); }}>
      <JobLocationFilter query={parseJobSearchParams(raw)} />
    </form>,
  );
  const form = view.container.querySelector("form")!;
  // jsdom `requestSubmit` uygulamıyor; gönderimi olay olarak yakalıyoruz.
  form.requestSubmit = () => form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
  return { ...view, submit, form };
}

describe("konum süzgeci", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("konum alınınca gizli alanı yazar ve formu kendisi gönderir", async () => {
    stubGeolocation((success) => success({ coords: { latitude: 41.0082384, longitude: 28.9783594 } }));
    const user = userEvent.setup();
    const { submit, form } = renderInForm();

    await user.click(screen.getByRole("button", { name: "Konumumu kullan" }));

    const hidden = form.elements.namedItem("konum") as HTMLInputElement;
    expect(hidden.value).toBe("41.008238,28.978359");
    expect(screen.getByLabelText("Uzaklık")).toHaveValue("5");
    expect(submit).toHaveBeenCalledOnce();
  });

  it("izin reddedilince il/ilçe yolunu hatırlatır, gizli alan yazmaz", async () => {
    stubGeolocation((_success, failure) => failure({ code: 1, PERMISSION_DENIED: 1 }));
    const user = userEvent.setup();
    const { submit, form } = renderInForm();

    await user.click(screen.getByRole("button", { name: "Konumumu kullan" }));

    expect(screen.getByRole("status")).toHaveTextContent("Konum izni verilmedi");
    expect(form.elements.namedItem("konum")).toBeNull();
    expect(submit).not.toHaveBeenCalled();
  });

  it("adres çubuğundaki konumu ve yarıçapı korur; kaldırılınca ikisi de düşer", async () => {
    const user = userEvent.setup();
    const { form } = renderInForm({ konum: "41.008238,28.978359", mesafe: "10" });

    expect((form.elements.namedItem("konum") as HTMLInputElement).value).toBe("41.008238,28.978359");
    expect(screen.getByLabelText("Uzaklık")).toHaveValue("10");

    await user.click(screen.getByRole("button", { name: "Konumu kaldır" }));

    expect(form.elements.namedItem("konum")).toBeNull();
    expect(form.elements.namedItem("mesafe")).toBeNull();
    expect(screen.getByRole("button", { name: "Konumumu kullan" })).toBeInTheDocument();
  });

  it("tarayıcıda konum API'si yoksa hatayı söyler, kırılmaz", async () => {
    vi.stubGlobal("navigator", { ...navigator, geolocation: undefined });
    const user = userEvent.setup();
    renderInForm();

    await user.click(screen.getByRole("button", { name: "Konumumu kullan" }));

    expect(screen.getByRole("status")).toHaveTextContent("Konum alınamadı");
  });
});
