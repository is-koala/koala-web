import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AddressCandidate, AddressSuggestion } from "@/address/contract";
import type { AddressGateway } from "@/address/gateway-client";
import type { FormState } from "@/lib/form-state";

import { CompanyForm } from "./company-form";

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

function fakeGateway(): AddressGateway {
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
  };
}

function renderForm(action: (state: FormState, formData: FormData) => Promise<FormState>) {
  render(<CompanyForm action={action} addressGateway={fakeGateway()} addressDebounceMs={0} />);
  return userEvent.setup();
}

async function goToStep(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole("button", { name }));
}

async function fillIdentity(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Şirket adı"), "Koala Temizlik");
  await user.type(screen.getByLabelText("Şirket e-postası"), "bilgi@koala.test");
  await user.type(screen.getByLabelText("Telefon numarası"), "05001112233");
  await user.type(screen.getByLabelText("Vergi numarası"), "1234567890");
  await user.selectOptions(screen.getByLabelText("Şirket türü"), "LIMITED");
}

async function chooseAddress(user: ReturnType<typeof userEvent.setup>) {
  await goToStep(user, "Adres");
  await user.type(screen.getByLabelText("Adres ara"), "Büyükdere");
  await user.click(await screen.findByText("Büyükdere Caddesi 12"));
  await screen.findByDisplayValue("Levent");
}

describe("şirket oluşturma formu", () => {
  afterEach(cleanup);

  it("sekiz şirket türünü de seçtirir", async () => {
    // Tür kayıt anında sabitleniyor: `UpdateCompanyRequestDto` bu alanı
    // taşımadığı için eksik bir seçenek kullanıcıyı düzeltilemez bir kayda
    // hapsederdi.
    renderForm(async () => ({ status: "idle" }));

    const options = screen.getByLabelText("Şirket türü").querySelectorAll("option[value]:not([value=''])");
    expect(options).toHaveLength(8);
  });

  it("hizmet alanını adres adımında, gönderimden önce yazar", async () => {
    // Backend `ADDRESS_SEARCHCANDIDATE_OUTSIDESERVICEAREA` ile reddediyor ve
    // o an kullanıcı formu çoktan doldurmuş oluyor.
    const user = renderForm(async () => ({ status: "idle" }));
    await goToStep(user, "Adres");

    expect(
      screen.getByText(/Koala şu anda yalnızca İstanbul'da hizmet veriyor/),
    ).toBeInTheDocument();
  });

  it("eksik alanla gönderimde backend'e çıkmaz ve kullanıcıyı eksiğin adımına götürür", async () => {
    const action = vi.fn(async () => ({ status: "idle" }) as FormState);
    const user = renderForm(action);

    await goToStep(user, "Önizleme ve gönder");
    await user.click(screen.getByRole("button", { name: "Şirketi oluştur" }));

    expect(action).not.toHaveBeenCalled();
    expect(await screen.findByText("Şirket adı zorunlu.")).toBeInTheDocument();
  });

  it("adres onaylanmadan gönderimi engeller", async () => {
    // `POST /companies` geçerli bir `AddressWriteV2` olmadan hiç çağrılamaz;
    // serbest metin bir adres ya da istemcide üretilmiş koordinat gitmez.
    const action = vi.fn(async () => ({ status: "idle" }) as FormState);
    const user = renderForm(action);

    await fillIdentity(user);
    await goToStep(user, "Önizleme ve gönder");
    await user.click(screen.getByRole("button", { name: "Şirketi oluştur" }));

    expect(action).not.toHaveBeenCalled();
    expect(await screen.findByText("Adresi onaylaman gerekiyor.")).toBeInTheDocument();
  });

  it("tamamlanmış formu tek istekte, adresi kanonik gövdeyle gönderir", async () => {
    const action = vi.fn(async (_state: FormState, _formData: FormData) => {
      void _state;
      void _formData;
      return { status: "idle" } as FormState;
    });
    const user = renderForm(action);

    await fillIdentity(user);
    await chooseAddress(user);
    await goToStep(user, "Önizleme ve gönder");
    await user.click(screen.getByRole("button", { name: "Şirketi oluştur" }));

    expect(action).toHaveBeenCalledTimes(1);
    const formData = action.mock.calls[0][1];
    expect(formData.get("name")).toBe("Koala Temizlik");
    expect(formData.get("taxNumber")).toBe("1234567890");
    expect(formData.get("type")).toBe("LIMITED");
    expect(JSON.parse(formData.get("address") as string)).toMatchObject({
      cityId: candidate.cityId,
      districtId: candidate.districtId,
      candidateToken: "aday-token-yer-tutucu",
    });
  });

  it("ilk gönderim sürerken düğmeyi kapatır ve çift tıklamayı ikinci şirkete dönüştürmez", async () => {
    /*
     * Şirket **silinemiyor**: `DELETE /companies/{id}` yok, ret ucu yok ve
     * `taxNumber` üzerinde tekillik kısıtı yok. Çift gönderim iki kalıcı
     * şirket üretir ve kullanıcının bunu geri alma yolu hiç yok.
     */
    let finish: (state: FormState) => void = () => {};
    const pending = new Promise<FormState>((resolve) => {
      finish = resolve;
    });
    const action = vi.fn(() => pending);
    const user = renderForm(action);

    await fillIdentity(user);
    await chooseAddress(user);
    await goToStep(user, "Önizleme ve gönder");
    await user.dblClick(screen.getByRole("button", { name: "Şirketi oluştur" }));

    expect(await screen.findByRole("button", { name: "Şirket oluşturuluyor…" })).toBeDisabled();
    expect(action).toHaveBeenCalledTimes(1);
    finish({ status: "idle" });
  });

  it("sunucudan dönen alan hatasını ilgili alanın altına yazar", async () => {
    // `details[]` içindeki metin backend'de zaten Türkçe çözülüyor; üst
    // banttaki cümle ise `errorCode` üzerinden seçiliyor.
    const user = renderForm(async () => ({
      status: "error",
      errorCode: "VALIDATION_FAILED",
      httpStatus: 400,
      fieldErrors: { email: "Geçerli bir e-posta adresi giriniz." },
    }));

    await fillIdentity(user);
    await chooseAddress(user);
    await goToStep(user, "Önizleme ve gönder");
    await user.click(screen.getByRole("button", { name: "Şirketi oluştur" }));

    expect(await screen.findByText("Geçerli bir e-posta adresi giriniz.")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Bilgileri kontrol et");
  });

  it("kimlik reddini kapının kendi metniyle gösterir", async () => {
    // `CompanyManager.java:103-105` kimliği doğrulanmamış kullanıcıyı 400 ile
    // reddediyor; ham backend mesajı ekrana basılmıyor.
    const user = renderForm(async () => ({
      status: "error",
      errorCode: "USER_MUST_VERIFY_IDENTITY",
      httpStatus: 400,
    }));

    await fillIdentity(user);
    await chooseAddress(user);
    await goToStep(user, "Önizleme ve gönder");
    await user.click(screen.getByRole("button", { name: "Şirketi oluştur" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Kimliğini doğrulaman gerekiyor");
  });

  it("onayın bildirimle duyurulmayacağını gönderimden önce yazar", async () => {
    // `approveCompany` yalnız bayrağı çeviriyor, hiçbir bildirim
    // göndermiyor (is-koala/koala-backend#62). "Onaylandığında haber
    // vereceğiz" demek, gelmeyecek bir e-postayı beklettirirdi.
    const user = renderForm(async () => ({ status: "idle" }));
    await goToStep(user, "Önizleme ve gönder");

    expect(screen.getByText(/onay tamamlandığında bildirim gönderilmiyor/i)).toBeInTheDocument();
  });
});
