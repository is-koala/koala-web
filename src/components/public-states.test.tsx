import { act, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

import { PublicFormAlert } from "./public-form-alert";
import { PublicErrorState } from "./public-states";

const loader = vi.hoisted(() => ({ mock: vi.fn(), real: (): unknown => undefined }));
const loadBackendErrorFamilies = loader.mock;

vi.mock("@/lib/backend-error-families", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/backend-error-families")>();
  loader.real = original.loadBackendErrorFamilies;
  loader.mock.mockImplementation(loader.real);
  return { ...original, loadBackendErrorFamilies: loader.mock };
});

const formStatus = vi.hoisted(() => ({ pending: false }));

vi.mock("react-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-dom")>()),
  useFormStatus: () => formStatus,
}));

/**
 * Askıya giren çizim `act` içinde beklenir: React 19 eşzamanlı `act` içinde
 * askıya giren ağacı sonradan yeniden denemiyor, kart hiç gelmezdi.
 */
async function renderSuspending(ui: ReactElement) {
  await act(async () => {
    render(ui);
  });
}

/** Tembel parçanın inişi; React askıdaki kartı `act` içinde yeniden dener. */
async function mapArrives() {
  await act(async () => {
    await loadBackendErrorFamilies();
  });
}

describe("herkese açık hata kartı", () => {
  it("küçük katalogdaki kodu aile haritasını beklemeden çizer", () => {
    // Giriş ve başvurunun asıl kodları katalogda; onlar için ek parça yok.
    render(<PublicErrorState errorCode="APPLICANT_IDENTITY_NOT_VERIFIED" status={400} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Kimliğini doğrulaman gerekiyor");
  });

  it("kodsuz hatayı durum koduyla hemen çizer", () => {
    render(<PublicErrorState status={404} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Aradığın içerik bulunamadı");
  });

  it("katalogda olmayan kodu aile haritası gelene kadar yanlış metinle çizmez", async () => {
    // Aile haritası ilan ayrıntısının ilk yüküne girmiyor (is-koala/koala-web#184):
    // kart bir parça sonra gelir, ama arada durum koduna göre seçilmiş yanlış
    // bir cümle görünmez. Parçanın inişini test tutuyor ki önceki testlerin
    // ısıttığı modül önbelleği bu beklemeyi gizlemesin.
    const { backendErrorFamilies } = await import("@/lib/backend-error-codes");
    let deliver: (families: typeof backendErrorFamilies) => void = () => {};
    const pending = new Promise<typeof backendErrorFamilies>((resolve) => {
      deliver = resolve;
    });
    loadBackendErrorFamilies.mockReturnValue(pending);

    try {
      await renderSuspending(<PublicErrorState errorCode="VALIDATION_FAILED" status={400} />);
      expect(screen.queryByRole("alert")).toBeNull();

      await act(async () => {
        deliver(backendErrorFamilies);
        await pending;
      });

      expect(screen.getByRole("alert")).toHaveTextContent("Bilgileri kontrol et");
    } finally {
      loadBackendErrorFamilies.mockReset();
      loadBackendErrorFamilies.mockImplementation(loader.real);
    }
  });

  it("ailesi de bilinmeyen kodu harita geldikten sonra durum koduna düşürür", async () => {
    await renderSuspending(<PublicErrorState errorCode="NEW_INTERNAL_DETAIL" status={500} />);
    await mapArrives();

    expect(screen.getByRole("alert")).toHaveTextContent("Bir sorun oluştu");
  });
});

describe("herkese açık form bandı", () => {
  it("gönderim sürerken aile haritasını önden ısıtır", () => {
    // Yavaş ağda ret bir parça daha beklemesin: istek uçuştayken parça iner.
    loadBackendErrorFamilies.mockClear();
    formStatus.pending = false;
    const { rerender } = render(<PublicFormAlert state={{ status: "idle" }} />);
    expect(loadBackendErrorFamilies).not.toHaveBeenCalled();

    formStatus.pending = true;
    rerender(<PublicFormAlert state={{ status: "idle" }} />);

    expect(loadBackendErrorFamilies).toHaveBeenCalled();
    formStatus.pending = false;
  });

  it("aile metnine düşen reddi formun üstünde gösterir", async () => {
    await renderSuspending(
      <PublicFormAlert state={{ status: "error", errorCode: "VALIDATION_FAILED", httpStatus: 400 }} />,
    );
    await mapArrives();

    expect(screen.getByRole("alert")).toHaveTextContent("Bilgileri kontrol et");
  });
});
