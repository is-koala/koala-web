import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AddressCandidate, AddressSuggestion } from "@/address/contract";
import type { AddressGateway } from "@/address/gateway-client";
import type { FormAction } from "@/lib/form-state";
import type { JobCategory, PriceQuoteResult } from "@/lib/job-posting";

import { JobForm, type JobFormOwner, type JobFormProps } from "./job-form";

const waiter: JobCategory = {
  id: "9f0a1e58-6a3c-4a3f-9a10-6a1c2d3e4f01",
  name: "Garson",
  code: "WAITER",
  requiresInsurance: false,
};

const courier: JobCategory = {
  id: "9f0a1e58-6a3c-4a3f-9a10-6a1c2d3e4f02",
  name: "Motorlu kurye",
  code: "COURIER",
  requiresInsurance: true,
};

const breakdown = {
  pricingVersion: "2026-09-v1",
  currency: "TRY",
  workerPayout: "1500.50",
  serviceFeeRate: "0.075",
  serviceFeeAmount: "112.54",
  employerTotal: "1613.04",
};

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

function fakeAddressGateway(): AddressGateway {
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

const asCompany: JobFormOwner = {
  kind: "company",
  companyId: "5d3c1b0a-7f60-4c2f-8a9e-9c1f0d244f6c",
  companyName: "Koala Etkinlik",
};

function renderForm(overrides: Partial<JobFormProps> = {}) {
  const props: JobFormProps = {
    owner: { kind: "individual" },
    categories: { status: "ready", data: [waiter, courier] },
    templates: { status: "ready", data: [] },
    blocked: [],
    action: vi.fn(async () => ({ status: "idle" as const })),
    quote: vi.fn(async () => ({ status: "ready", breakdown }) as PriceQuoteResult),
    addressGateway: fakeAddressGateway(),
    addressDebounceMs: 0,
    ...overrides,
  };

  return { ...render(<JobForm {...props} />), user: userEvent.setup(), props };
}

function renderCompanyForm(overrides: Partial<JobFormProps> = {}) {
  return renderForm({ owner: asCompany, ...overrides });
}

/** Adım gezinmesi formun kendi düğmeleriyle yapılır; panel dışı içerik gizli. */
function goToStep(user: ReturnType<typeof userEvent.setup>, step: string) {
  return user.click(screen.getByRole("button", { name: step }));
}

/** Kuralları tek tek kırabilmek için önce geçerli bir taslak yazılır. */
async function fillForm(
  user: ReturnType<typeof userEvent.setup>,
  overrides: Partial<Record<string, string>> = {},
) {
  const values = {
    title: "Hafta sonu garson",
    description: "İki günlük etkinlikte servis desteği.",
    position: "Garson",
    salary: "1500",
    startDateTime: "2026-10-10T09:00",
    endDateTime: "2026-10-11T18:00",
    minAge: "18",
    maxAge: "45",
    ...overrides,
  };

  await user.click(screen.getByRole("radio", { name: /Garson/ }));

  await goToStep(user, "Temel bilgiler");
  await user.type(screen.getByLabelText("İlan başlığı"), values.title);
  await user.type(screen.getByLabelText("İlan açıklaması"), values.description);
  await user.type(screen.getByLabelText("Pozisyon"), values.position);

  await goToStep(user, "Tarih ve ücret");
  await user.selectOptions(screen.getByLabelText("İlan türü"), "ONE_TIME");
  await user.selectOptions(screen.getByLabelText("Ücret türü"), "DAILY");
  await user.type(screen.getByLabelText(/Çalışana ödenecek ücret/), values.salary);
  await user.type(screen.getByLabelText("Başlangıç"), values.startDateTime);
  await user.type(screen.getByLabelText("Bitiş"), values.endDateTime);

  await goToStep(user, "Koşullar");
  await user.type(screen.getByLabelText("En küçük yaş"), values.minAge);
  await user.type(screen.getByLabelText("En büyük yaş"), values.maxAge);
  await user.selectOptions(screen.getByLabelText("Deneyim gerekli mi"), "false");
}

async function priceStepWith(salary: string, overrides: Partial<JobFormProps> = {}) {
  const view = renderForm(overrides);
  await goToStep(view.user, "Tarih ve ücret");
  if (salary) await view.user.type(screen.getByLabelText(/Çalışana ödenecek ücret/), salary);
  await goToStep(view.user, "Fiyat ve yayımla");
  await view.user.click(screen.getByRole("button", { name: "Fiyatı hesapla" }));
  return view;
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("bireysel ilan formu — kategori adımı", () => {
  it("sigorta zorunlu kategoriyi listeden çıkarmaz, seçilemez gösterir", () => {
    // Listeden çıkarmak kullanıcıyı aradığı işi bulamaz **ve** nedenini
    // öğrenemez hâlde bırakırdı.
    renderForm();

    expect(screen.getByRole("radio", { name: /Motorlu kurye/ })).toBeDisabled();
    expect(screen.getByRole("radio", { name: /Garson/ })).toBeEnabled();
  });

  it("seçilememe sebebini ekrana yazar ve şirket ilanı yolunu gösterir", () => {
    renderForm();

    expect(
      screen.getByText(/sigorta zorunlu.*bireysel ilanla açılamaz.*şirket ilanı/i),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: /Şirketlerim/ })).toHaveAttribute(
      "href",
      "/isveren/sirket",
    );
  });
});

describe("bireysel ilan formu — backend'in sabitlediği alanlar", () => {
  it("sigorta anahtarı ve 'adresi herkese göster' seçeneği bulunmaz", () => {
    // İkisini de sunucu sabitliyor (`JobManager.java:153,155`); forma koymak
    // kullanıcıya olmayan bir seçim yaptırırdı.
    const { container } = renderForm();

    expect(container.querySelector("[name='insuranceRequired']")).toBeNull();
    expect(container.querySelector("[name='addressPublic']")).toBeNull();
    expect(screen.queryByText(/adresi ilanda göster|adresi herkese/i)).toBeNull();
  });

  it("adresin yalnız atanan işçiye açılacağını yazar", async () => {
    const { user } = renderForm();

    await goToStep(user, "Adres");

    expect(screen.getByText(/adresin.*yalnızca.*işçi/i)).toBeVisible();
  });
});

describe("bireysel ilan formu — yayımlama kapısı", () => {
  it("kimlik doğrulanmamışken form doldurulabilir ama yayımlama düğmesi kapalıdır", () => {
    // Düğme ve gerekçesi kalıcı altlıkta: kullanıcı hangi adımda olursa olsun
    // ilanı yayımlayamayacağını okumadan formu doldurmaya başlamamalı.
    renderForm({ blocked: ["identityVerification"] });

    expect(screen.getByLabelText("İlan başlığı")).toBeEnabled();
    expect(screen.getByRole("button", { name: "İlanı yayımla" })).toBeDisabled();
    expect(screen.getByText("Kimliğini doğrulaman gerekiyor")).toBeVisible();
  });

  it("kapı açıkken yayımlama düğmesi gönderilebilir", () => {
    renderForm();

    expect(screen.getByRole("button", { name: "İlanı yayımla" })).toBeEnabled();
  });
});

describe("bireysel ilan formu — fiyat özeti", () => {
  it("üç tutarı da yanıttan okur ve biçimleyip gösterir", async () => {
    const { props } = await priceStepWith("1500.50");

    const summary = await screen.findByRole("group", { name: "Fiyat özeti" });
    // `type="number"` sondaki kuruş sıfırını düşürüyor ("1500.50" → "1500.5").
    // Sayı aynı ve ölçeği sunucu kuruyor (`setScale(2, HALF_UP)`), yani
    // kilitlenen tutar değişmiyor.
    expect(props.quote).toHaveBeenCalledWith("1500.5");
    expect(within(summary).getByText("1.500,50 ₺")).toBeVisible();
    expect(within(summary).getByText("112,54 ₺")).toBeVisible();
    expect(within(summary).getByText("1.613,04 ₺")).toBeVisible();
  });

  it("ayrı KDV kalemi ve 'KDV dahil/hariç' ibaresi geçmez", async () => {
    // ADR-0002: vergi gösterimi muhasebe kararı verilene kadar hizmet bedeli
    // tanımından ayrı tutuluyor.
    const { container } = await priceStepWith("1500.50");
    await screen.findByRole("group", { name: "Fiyat özeti" });

    expect(container.textContent).not.toMatch(/KDV/i);
  });

  it("yayımlamadan önce fiyatın kilitleneceğini yazar", async () => {
    await priceStepWith("1500.50");
    await screen.findByRole("group", { name: "Fiyat özeti" });

    expect(screen.getByText(/ilan yayımlandığında kilitlenir ve sonradan değişmez/i)).toBeVisible();
  });

  it("fiyat sorusu reddedilirse nedeni koddan seçilmiş Türkçe metinle yazar", async () => {
    await priceStepWith("1500.50", {
      quote: vi.fn(async () => ({
        status: "error",
        errorCode: "JOB_SALARY_MIN_VALUE",
        httpStatus: 400,
      }) as PriceQuoteResult),
    });

    expect(await screen.findByRole("alert")).toHaveTextContent("Bilgileri kontrol et");
  });

  it("ücret girilmeden fiyat sorulmaz", async () => {
    const { props } = await priceStepWith("");

    expect(props.quote).not.toHaveBeenCalled();
    expect(screen.getByText(/ücreti girdiğinde/i)).toBeVisible();
  });
});

describe("bireysel ilan formu — istemci doğrulaması", () => {
  it("bitiş tarihi başlangıçtan önceyse alanın altına yazar", async () => {
    const { user } = renderForm();

    await fillForm(user, { endDateTime: "2026-10-09T09:00" });
    await user.click(screen.getByRole("button", { name: "İlanı yayımla" }));

    // Gönderim eksiği olan ilk adıma dönüyor; mesaj gizli bir panelde kalmaz.
    expect(await screen.findByText("Bitiş tarihi başlangıçtan sonra olmalı.")).toBeVisible();
  });

  it("yaş aralığı ters çevrildiğinde mesaj maxAge alanının altında görünür", async () => {
    const { user } = renderForm();

    await fillForm(user, { minAge: "40", maxAge: "20" });
    await user.click(screen.getByRole("button", { name: "İlanı yayımla" }));

    expect(await screen.findByText("En büyük yaş, en küçük yaştan küçük olamaz.")).toBeVisible();
  });
});

describe("bireysel ilan formu — kazara yayımlama", () => {
  it("bir alanda Enter'a basmak ilanı yayımlamaz", async () => {
    // Uzun ve çok adımlı bir form: adres arama kutusunda Enter'a basan
    // kullanıcı ilanı yayımlamış olmamalı. Yayım yalnız düğmeyle olur.
    const action = vi.fn(async () => ({ status: "idle" as const }));
    const { user } = renderForm({ action });

    await goToStep(user, "Temel bilgiler");
    await user.type(screen.getByLabelText("İlan başlığı"), "Hafta sonu garson{Enter}");

    expect(action).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("bireysel ilan formu — kaza ile kaybolmama", () => {
  it("yazılanları tarayıcıya saklar ve dönüldüğünde geri yükler", async () => {
    const { user, unmount } = renderForm();
    await goToStep(user, "Temel bilgiler");
    await user.type(screen.getByLabelText("İlan başlığı"), "Hafta sonu garson");
    unmount();

    renderForm();

    expect(await screen.findByLabelText("İlan başlığı")).toHaveValue("Hafta sonu garson");
  });

  it("sunucuya gidebilen bir gönderimden sonra saklanan taslağı bırakmaz", async () => {
    // Yayımlanan ilan yönetim sayfasına yönlendiriyor; saklanan taslak
    // kalsaydı kullanıcı bir dahaki gelişinde yayımladığı ilanı yeniden
    // doldurulmuş hâlde bulurdu.
    const { user } = renderForm();

    await fillForm(user);
    await goToStep(user, "Adres");
    await user.click(screen.getByRole("button", { name: "İlanı yayımla" }));

    // Adres onaylanmadığı için gönderim sunucuya çıkmıyor; taslak duruyor.
    expect(Object.values(window.localStorage).join(" ")).toContain("Hafta sonu garson");
  });

  it("gönderim sunucuya çıktığında saklanan taslağı siler", async () => {
    // Yayımlanan ilan yönetim sayfasına yönlendiriyor ve form geride kalıyor;
    // taslak silinmezse kullanıcı bir dahaki gelişinde yayımladığı ilanı
    // yeniden doldurulmuş hâlde bulur.
    const action = vi.fn(async () => ({ status: "idle" as const }));
    const { user } = renderForm({ action });

    await fillForm(user);
    await goToStep(user, "Adres");
    await user.type(screen.getByLabelText("Adres ara"), "büyükdere");
    await user.click(await screen.findByRole("option", { name: /Büyükdere Caddesi 12/ }));
    await user.click(screen.getByRole("button", { name: "İlanı yayımla" }));

    expect(action).toHaveBeenCalled();
    expect(Object.values(window.localStorage).join(" ")).not.toContain("Hafta sonu garson");
  });

  it("adres kanıtını hiç saklamaz", async () => {
    // `candidateToken` 10 dakika yaşıyor; saklanmış bir kanıt kullanıcıyı
    // çözemeyeceği bir 400'e sokardı.
    const { user } = renderForm();
    await goToStep(user, "Temel bilgiler");
    await user.type(screen.getByLabelText("İlan başlığı"), "Hafta sonu garson");

    const stored = Object.values(window.localStorage);
    expect(stored.length).toBeGreaterThan(0);
    expect(stored.join(" ")).not.toContain("candidateToken");
    expect(stored.join(" ")).not.toContain("address");
  });
});

describe("şirket ilanı formu — sigorta kuralı", () => {
  it("sigorta zorunlu kategoriyi seçilebilir bırakır", () => {
    // Bireyselden tek farkı bu: `JobManager.createCorporateJob` o kategoriyi
    // kabul ediyor, yalnız `insuranceRequired=true` istiyor.
    renderCompanyForm();

    expect(screen.getByRole("radio", { name: /Motorlu kurye/ })).toBeEnabled();
  });

  it("sigorta zorunlu kategori seçilince anahtar açık ve kapatılamaz olur", async () => {
    const { user } = renderCompanyForm();

    await user.click(screen.getByRole("radio", { name: /Motorlu kurye/ }));
    await goToStep(user, "Koşullar");

    const insurance = screen.getByRole("checkbox", { name: /Sigortalı çalışma/ });
    expect(insurance).toBeChecked();
    expect(insurance).toBeDisabled();
    expect(screen.getByText(/bu kategoride sigorta zorunlu/i)).toBeVisible();
  });

  it("zorunlu olmayan kategoride işverenin kendi tercihini taşır", async () => {
    const { user } = renderCompanyForm();

    await user.click(screen.getByRole("radio", { name: /Garson/ }));
    await goToStep(user, "Koşullar");

    const insurance = screen.getByRole("checkbox", { name: /Sigortalı çalışma/ });
    expect(insurance).toBeEnabled();
    expect(insurance).not.toBeChecked();

    await user.click(insurance);
    expect(insurance).toBeChecked();
  });

  it("kategori şablondan değiştiğinde de sigorta değerini gönderime taşır", async () => {
    // koala-mobile#24'ün tam senaryosu: kategoriyi değiştiren ikinci yol.
    // Değer kategori seçiminde elle güncellenen bir alan olsaydı şablon yolu
    // onu güncellemeyi unutur ve kural sessizce düşerdi.
    const action = vi.fn<FormAction>().mockResolvedValue({ status: "idle" });
    const { user } = renderCompanyForm({
      action,
      templates: {
        status: "ready",
        data: [
          {
            id: "8f0a1e58-6a3c-4a3f-9a10-6a1c2d3e4f11",
            templateName: "Kurye şablonu",
            categoryId: courier.id,
            title: null,
            description: null,
            sector: null,
            position: null,
            duties: null,
            dressCode: null,
            type: null,
            salaryType: null,
            salary: null,
            minAge: null,
            maxAge: null,
            experienceRequired: null,
          },
        ],
      },
    });

    await fillForm(user);
    await user.selectOptions(screen.getByLabelText("Şablondan doldur"), "8f0a1e58-6a3c-4a3f-9a10-6a1c2d3e4f11");
    await goToStep(user, "Adres");
    await user.type(screen.getByLabelText("Adres ara"), "büyükdere");
    await user.click(await screen.findByRole("option", { name: /Büyükdere Caddesi 12/ }));
    await user.click(screen.getByRole("button", { name: "İlanı yayımla" }));

    expect(action).toHaveBeenCalled();
    const submitted = action.mock.calls[0][1];
    expect(submitted.get("categoryId")).toBe(courier.id);
    expect(submitted.get("insurancePreference")).toBe("true");
  });
});

describe("bireysel ilan formu — sigorta yüzeyi hiç yok", () => {
  it("sigorta anahtarını çizmez", async () => {
    // Bireysel uç `insuranceRequired`'ı `false` sabitliyor; anahtar koymak
    // kullanıcıya olmayan bir seçim yaptırırdı.
    const { user } = renderForm();

    await goToStep(user, "Koşullar");

    expect(screen.queryByRole("checkbox", { name: /Sigortalı çalışma/ })).toBeNull();
  });
});
