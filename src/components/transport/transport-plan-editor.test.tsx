import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { AddressGateway } from "@/address/gateway-client";
import { storeTransportDraftForHandoff } from "@/transport/carry-over";
import type { TransportPlan } from "@/transport/contract";
import type { TransportPlanFormAction, TransportPlanFormState } from "@/transport/editor-state";
import { emptyTransportPlanDraft } from "@/transport/plan-form";

import { TransportPlanEditor } from "./transport-plan-editor";

const shuttleId = "cccccccc-cccc-4ccc-8ccc-000000000001";
const stopId = "cccccccc-cccc-4ccc-8ccc-000000000011";

const plan: TransportPlan = {
  outboundMethod: "SHUTTLE",
  returnMethod: "CASH_ALLOWANCE",
  allowanceAmount: "150.00",
  allowanceNote: "İş bitince",
  notes: "Servis 5 dk bekler.",
  updatedAt: "2026-09-14T08:00:00Z",
  shuttles: [
    {
      id: shuttleId,
      direction: "OUTBOUND",
      name: "Anadolu yakası servisi",
      plate: "34 ABC 12",
      capacity: 12,
      seatsTaken: 3,
      driverName: "Mehmet Şoför",
      driverPhone: "0500 000 00 00",
      stops: [
        {
          id: stopId,
          label: "Kadıköy İskele",
          scheduledAt: "2026-09-20T03:40:00Z",
          seatsTaken: 3,
          address: { displayAddress: "Rıhtım Caddesi No: 1, Caferağa, Kadıköy/İstanbul", position: { latitude: 40.99, longitude: 29.02 } },
        },
      ],
    },
  ],
};

const countryId = "2f0a1e58-6a3c-4a3f-9a10-6a1c2d3e4f52";
const cityId = "6f0a1e58-6a3c-4a3f-9a10-6a1c2d3e4f50";
const districtId = "1f0a1e58-6a3c-4a3f-9a10-6a1c2d3e4f53";

/** Sağlayıcı yok: adres formu elle seçim yedeğine düşer, referans listeleri dolu. */
function silentGateway(): AddressGateway {
  return {
    startSession: vi.fn(async () => ({ id: "3b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f6e", expiresAt: new Date(Date.now() + 300_000).toISOString() })),
    suggestions: vi.fn(async () => []),
    resolve: vi.fn(async () => { throw new Error("yok"); }),
    reverse: vi.fn(async () => { throw new Error("yok"); }),
    countries: vi.fn(async () => [{ id: countryId, name: "Türkiye", code: "TR" }]),
    cities: vi.fn(async () => [{ id: cityId, name: "İstanbul" }]),
    districts: vi.fn(async () => [{ id: districtId, name: "Kadıköy" }]),
  };
}

/** Durak adresini elle seçim yoluyla doldurur (`sirket-adres.spec.ts` ile aynı adımlar). */
async function fillStopAddress(user: ReturnType<typeof userEvent.setup>, scope: HTMLElement) {
  const stop = within(scope);
  await user.click(stop.getByRole("button", { name: "Ülke, il ve ilçeyi elle seç" }));
  await user.selectOptions(await stop.findByLabelText("Ülke"), countryId);
  await user.selectOptions(await stop.findByLabelText("İl", { exact: true }), cityId);
  await user.selectOptions(await stop.findByLabelText("İlçe"), districtId);
  await user.type(stop.getByLabelText("Mahalle"), "Caferağa");
  await user.type(stop.getByLabelText("Cadde veya sokak"), "Moda Caddesi");
  await user.type(stop.getByLabelText("Bina numarası"), "5");
  await user.type(stop.getByLabelText("Posta kodu"), "34710");
  await user.clear(stop.getByLabelText("Enlem"));
  await user.type(stop.getByLabelText("Enlem"), "40.98");
  await user.clear(stop.getByLabelText("Boylam"));
  await user.type(stop.getByLabelText("Boylam"), "29.03");
  await user.click(stop.getByRole("button", { name: "Konumu onayla" }));
}

function savingAction(): TransportPlanFormAction {
  return vi.fn<TransportPlanFormAction>(async (_state, formData) => ({ status: "done", plan: planFrom(formData) }));
}

function renderEditor(initial: TransportPlan | null = plan, action: TransportPlanFormAction = savingAction()) {
  const view = render(
    <TransportPlanEditor plan={initial} action={action} addressGateway={silentGateway()} addressDebounceMs={0} />,
  );
  return { ...view, user: userEvent.setup(), action };
}

/** Gönderilen gizli alandan "kaydedilmiş" plan: yeni servis kimlik alır. */
function planFrom(formData: FormData): TransportPlan {
  const draft = JSON.parse(String(formData.get("transportPlan")));
  return {
    ...plan,
    outboundMethod: draft.outboundMethod,
    returnMethod: draft.returnMethod,
    updatedAt: "2026-09-15T09:00:00Z",
    shuttles: draft.shuttles.map((shuttle: { id: string | null; name: string; direction: "OUTBOUND" | "RETURN" }, index: number) => ({
      ...plan.shuttles[0],
      id: shuttle.id ?? `cccccccc-cccc-4ccc-8ccc-0000000001${String(index).padStart(2, "0")}`,
      name: shuttle.name,
      direction: shuttle.direction,
      seatsTaken: shuttle.id ? 3 : 0,
    })),
  };
}

function submittedDraft(action: TransportPlanFormAction) {
  const formData = (action as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1] as FormData;
  return JSON.parse(String(formData.get("transportPlan")));
}

describe("işverenin ulaşım planı düzenleyicisi", () => {
  it("kayıtlı planı alanlara açar: yöntemler, yol parası, servis, durak, kayıtlı adres ve doluluk", () => {
    renderEditor();

    expect(screen.getByLabelText("İşe gidiş")).toHaveValue("SHUTTLE");
    expect(screen.getByLabelText("İşten dönüş")).toHaveValue("CASH_ALLOWANCE");
    expect(screen.getByLabelText("Yol parası (₺)")).toHaveValue(150);
    expect(screen.getByLabelText("Servis adı")).toHaveValue("Anadolu yakası servisi");
    expect(screen.getByLabelText("Koltuk sayısı")).toHaveValue(12);
    expect(screen.getByLabelText("Plaka")).toHaveValue("34 ABC 12");
    expect(screen.getByLabelText("Kalkış saati")).toHaveValue("2026-09-20T06:40");
    expect(screen.getByText(/3 koltuk seçilmiş/)).toBeInTheDocument();
    // Kayıtlı adres formla değil satırla gösteriliyor; değiştirmek ayrı bir adım.
    expect(screen.getByText(/Rıhtım Caddesi No: 1/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Adres ara")).toBeNull();
    expect(screen.getByRole("button", { name: "Adresi değiştir" })).toBeInTheDocument();
    expect(screen.getByText(/Son kayıt/)).toHaveTextContent("14 Eyl 2026");
  });

  it("değişmeden kaydedince gövde kimlikleri taşır ve adres alanı göndermez; kayıt notu çizilir", async () => {
    const { user, action } = renderEditor();

    await user.click(screen.getByRole("button", { name: "Ulaşım planını kaydet" }));

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const draft = submittedDraft(action);
    expect(draft.shuttles[0]).toMatchObject({ id: shuttleId, direction: "OUTBOUND", capacity: "12" });
    expect(draft.shuttles[0].stops[0]).toMatchObject({ id: stopId, editingAddress: false });
    const formData = (action as ReturnType<typeof vi.fn>).mock.calls[0][1] as FormData;
    expect([...formData.keys()].filter((key) => key.startsWith("transportAddress."))).toEqual([]);
    expect(await screen.findByRole("status")).toHaveTextContent("Ulaşım planı kaydedildi.");
  });

  it("yeni servis adsız gönderilemez; hata alanın altına yazılır ve sunucuya çıkılmaz", async () => {
    const { user, action } = renderEditor();

    await user.click(screen.getByRole("button", { name: "Bir servis daha ekle" }));
    await user.click(screen.getByRole("button", { name: "Ulaşım planını kaydet" }));

    await waitFor(() => expect(action).not.toHaveBeenCalled());
    expect(await screen.findByText("Servisin adını yazmalısın.")).toBeInTheDocument();
    expect(await screen.findByText("Koltuk sayısı 1 ile 100 arasında olmalı.")).toBeInTheDocument();
    expect(await screen.findByText("Durağın adresini onaylaman gerekiyor.")).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent("Bazı alanlar eksik ya da hatalı");
  });

  it("koltuk sayısı seçilmiş koltukların altına inince gönderimden önce durur", async () => {
    const { user, action } = renderEditor();

    await user.clear(screen.getByLabelText("Koltuk sayısı"));
    await user.type(screen.getByLabelText("Koltuk sayısı"), "2");
    await user.click(screen.getByRole("button", { name: "Ulaşım planını kaydet" }));

    await waitFor(() => expect(action).not.toHaveBeenCalled());
    expect(await screen.findByText("Bu serviste 3 koltuk seçilmiş; sayı bunun altına inemez.")).toBeInTheDocument();
  });

  it("koltuk seçilmiş servisi kaldırmak önce uyarır, ikinci onayda listeden düşer", async () => {
    const { user, action } = renderEditor();

    await user.click(screen.getByRole("button", { name: "Servisi kaldır" }));
    expect(action).not.toHaveBeenCalled();
    const warning = screen.getByRole("alert");
    expect(warning).toHaveTextContent("Bu serviste 3 koltuk seçilmiş");
    expect(screen.getByLabelText("Servis adı")).toBeInTheDocument();

    await user.click(within(warning).getByRole("button", { name: "Vazgeç" }));
    expect(screen.getByLabelText("Servis adı")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Servisi kaldır" }));
    await user.click(screen.getByRole("button", { name: "Yine de kaldır" }));
    expect(screen.queryByLabelText("Servis adı")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Ulaşım planını kaydet" }));
    await waitFor(() => expect(action).toHaveBeenCalled());
    expect(submittedDraft(action).shuttles).toEqual([]);
  });

  it("yöntem servis olmaktan çıkınca var olan servis silinmez, uyarı yazılır ve gönderim durur", async () => {
    const { user, action } = renderEditor();

    await user.selectOptions(screen.getByLabelText("İşe gidiş"), "SELF");

    expect(screen.getByLabelText("Servis adı")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Bu yönün yöntemi artık servis değil");
    await user.click(screen.getByRole("button", { name: "Ulaşım planını kaydet" }));
    await waitFor(() => expect(action).not.toHaveBeenCalled());
  });

  it("yol parası seçilince tutar ister; seçilmeyince alan çizilmez", async () => {
    const { user, action } = renderEditor(null);

    expect(screen.queryByLabelText("Yol parası (₺)")).toBeNull();
    await user.selectOptions(screen.getByLabelText("İşten dönüş"), "CASH_ALLOWANCE");
    await user.click(screen.getByRole("button", { name: "Ulaşım planını kaydet" }));

    await waitFor(() => expect(action).not.toHaveBeenCalled());
    expect(await screen.findByText("Yol parası tutarını yazmalısın.")).toBeInTheDocument();
  });

  it("kayıttan sonra form sunucunun planından yeniden kurulur: yeni servis ve durak kimliğini alır", async () => {
    const { user, action } = renderEditor(plan, savingAction());

    await user.click(screen.getByRole("button", { name: "Bir servis daha ekle" }));
    const [, added] = screen.getAllByTestId("transport-shuttle");
    await user.type(within(added).getByLabelText("Servis adı"), "Avrupa yakası");
    await user.type(within(added).getByLabelText("Koltuk sayısı"), "8");
    await user.type(within(added).getByLabelText("Kalkış saati"), "2026-09-20T07:00");
    await fillStopAddress(user, added);

    await user.click(screen.getByRole("button", { name: "Ulaşım planını kaydet" }));

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const formData = (action as ReturnType<typeof vi.fn>).mock.calls[0][1] as FormData;
    const draft = submittedDraft(action);
    expect(draft.shuttles[1]).toMatchObject({ id: null, name: "Avrupa yakası", capacity: "8" });
    // Yeni durağın adresi kendi gizli alanında, taslağın anahtarıyla.
    const addressField = `transportAddress.${draft.shuttles[1].stops[0].key}`;
    expect(JSON.parse(String(formData.get(addressField)))).toMatchObject({
      components: { neighborhood: "Caferağa", thoroughfare: "Moda Caddesi" },
      position: { latitude: 40.98, longitude: 29.03, source: "USER_CONFIRMED_PIN" },
    });

    // İkinci kayıt yerinde güncelleme olsun diye form sunucunun kimlikleriyle kuruldu.
    expect(await screen.findByRole("status")).toHaveTextContent("Ulaşım planı kaydedildi.");
    await user.click(screen.getByRole("button", { name: "Ulaşım planını kaydet" }));
    await waitFor(() => expect(action).toHaveBeenCalled());
    expect(submittedDraft(action).shuttles[1].id).toBe("cccccccc-cccc-4ccc-8ccc-000000000101");
  });

  it("409 kapasite reddinde cümle üst banda, güncel doluluk taslağa birleşir ve hata ilgili servisin altına düşer", async () => {
    // Başka bir işçi bu arada koltuk aldı: kullanıcının yazdığı 2 kalır,
    // sunucunun 4'ü gelir ve kural yeniden okunur — yazdıkları silinmez.
    const action = vi.fn(async (): Promise<TransportPlanFormState> => ({
      status: "error",
      errorCode: "TRANSPORT_SHUTTLE_CAPACITY_BELOW_SEATS",
      httpStatus: 409,
      plan: { ...plan, shuttles: [{ ...plan.shuttles[0], seatsTaken: 4 }] },
    }));
    const { user } = renderEditor(plan, action);

    await user.type(screen.getByLabelText("Şoför adı"), " Bey");
    await user.click(screen.getByRole("button", { name: "Ulaşım planını kaydet" }));

    expect(await screen.findByTestId("transport-plan-error")).toHaveTextContent(
      "seçilmiş koltuk sayısının altına indirilemez",
    );
    expect(screen.getByLabelText("Şoför adı")).toHaveValue("Mehmet Şoför Bey");
    expect(await screen.findByText(/4 koltuk seçilmiş/)).toBeInTheDocument();
    // 12 ≥ 4: alan hatası yok; sayı 2'ye çekilince istemci kapısı yakalar.
    expect(screen.queryByText(/sayı bunun altına inemez/)).toBeNull();
  });

  it("404'te (servis başka cihazdan kaldırılmış) kendi cümlesini yazar, taslağı silmez, kimliği düşürüp adres ister", async () => {
    const action = vi.fn(async (): Promise<TransportPlanFormState> => ({
      status: "error",
      errorCode: "TRANSPORT_SHUTTLE_NOT_FOUND",
      httpStatus: 404,
      plan: { ...plan, shuttles: [] },
    }));
    const { user } = renderEditor(plan, action);

    await user.clear(screen.getByLabelText("Servis adı"));
    await user.type(screen.getByLabelText("Servis adı"), "Düzenlenmiş ad");
    await user.click(screen.getByRole("button", { name: "Ulaşım planını kaydet" }));

    expect(await screen.findByTestId("transport-plan-error")).toHaveTextContent(
      "Servis ya da durak bu arada kaldırılmış; plan güncellendi, kontrol edip yeniden kaydet.",
    );
    expect(screen.getByLabelText("Servis adı")).toHaveValue("Düzenlenmiş ad");
    expect(screen.queryByText(/koltuk seçilmiş/)).toBeNull();
    // Kimliksiz durak yeniden adres ister: adres formu açılır; eksik adres
    // gönderimde istemci kapısına takılır.
    expect(screen.getByLabelText("Adres ara")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ulaşım planını kaydet" }));
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Durağın adresini onaylaman gerekiyor.")).toBeInTheDocument();
  });

  it("sunucunun alan hatalarını ilgili alana düşürür", async () => {
    const action = vi.fn(async (): Promise<TransportPlanFormState> => ({
      status: "error",
      errorCode: "VALIDATION_FAILED",
      httpStatus: 400,
      fieldErrors: { "shuttles[0].plate": "Plaka en fazla 20 karakter.", allowanceAmountConsistent: "Tutar zorunlu." },
    }));
    const { user } = renderEditor(plan, action);

    await user.click(screen.getByRole("button", { name: "Ulaşım planını kaydet" }));

    expect(await screen.findByText("Plaka en fazla 20 karakter.")).toBeInTheDocument();
    expect(await screen.findByText("Tutar zorunlu.")).toBeInTheDocument();
  });

  it("sihirbaz planı yazamadıysa notu çizer ve sihirbazın bıraktığı taslağı forma alır", async () => {
    storeTransportDraftForHandoff({
      ...emptyTransportPlanDraft,
      outboundMethod: "SHUTTLE",
      returnMethod: "CASH_ALLOWANCE",
      allowanceAmount: "80",
      shuttles: [
        {
          key: "new-shuttle-1",
          id: null,
          direction: "OUTBOUND",
          name: "Sihirbazdan gelen",
          plate: "",
          capacity: "6",
          driverName: "",
          driverPhone: "",
          seatsTaken: 0,
          stops: [{ key: "new-stop-1", id: null, label: "Taksim", scheduledAt: "2026-09-20T07:00", savedAddress: null, editingAddress: true, seatsTaken: 0 }],
        },
      ],
    });

    render(
      <TransportPlanEditor plan={null} action={vi.fn()} addressGateway={silentGateway()} publishFailed />,
    );

    expect(screen.getByTestId("transport-publish-notice")).toHaveTextContent("ulaşım planı kaydedilemedi");
    expect(await screen.findByLabelText("Servis adı")).toHaveValue("Sihirbazdan gelen");
    expect(screen.getByLabelText("Yol parası (₺)")).toHaveValue(80);
    expect(screen.getByLabelText("Kalkış saati")).toHaveValue("2026-09-20T07:00");
    // Adres taşınmadı: durak adres bekliyor.
    expect(screen.getByLabelText("Adres ara")).toBeInTheDocument();
    // Tek seferlik: ikinci okuma boş.
    expect(window.sessionStorage.getItem("koala.ilan.ulasim.v1")).toBeNull();
  });

  it("not olmadan taşınan taslağa dokunmaz", () => {
    storeTransportDraftForHandoff({ ...emptyTransportPlanDraft, notes: "kalsın" });
    renderEditor(null);

    expect(screen.getByLabelText("Ulaşım notu")).toHaveValue("");
    expect(window.sessionStorage.getItem("koala.ilan.ulasim.v1")).not.toBeNull();
    window.sessionStorage.clear();
  });
});
