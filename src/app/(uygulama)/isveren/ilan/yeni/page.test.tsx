import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/server/api/errors";

import { sessionExpiryRedirect } from "../../../../../../tests/support/control-flow";

import Page, { NewIndividualJobPanel } from "./page";

const currentGates = vi.hoisted(() => vi.fn());
const fetchJobCategories = vi.hoisted(() => vi.fn());
const fetchJobTemplates = vi.hoisted(() => vi.fn());
const shellGate = vi.hoisted(() => vi.fn());
const jobForm = vi.hoisted(() => vi.fn());

vi.mock("@/server/session/gates", () => ({ currentGates }));
vi.mock("@/server/jobs/jobs", () => ({ fetchJobCategories, fetchJobTemplates }));
vi.mock("@/app/(uygulama)/shell", () => ({ ShellGate: shellGate }));
vi.mock("@/components/job-form", () => ({ JobForm: jobForm }));

const category = {
  id: "9f0a1e58-6a3c-4a3f-9a10-6a1c2d3e4f01",
  name: "Garson",
  code: "WAITER",
  requiresInsurance: false,
};

/** Sayfanın forma verdiği prop'lar; bileşen taklit edildiği için ağaçtan okunur. */
async function formProps(): Promise<Record<string, unknown>> {
  const tree = (await NewIndividualJobPanel()) as {
    props: { children: readonly { type: unknown; props: Record<string, unknown> }[] };
  };
  const form = [tree.props.children].flat(3).find((node) => node?.type === jobForm);
  return form!.props;
}

describe("yeni bireysel ilan sayfası", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentGates.mockResolvedValue({
      viewer: { firstName: "Ayşe" },
      failure: null,
      gates: { individualJob: { open: true } },
    });
    fetchJobCategories.mockResolvedValue([category]);
    fetchJobTemplates.mockResolvedValue([]);
  });

  it("işveren rolü kapısını veri yüklemeden önce taşır", async () => {
    // Kapı sayfanın gövdesinde bir `if` olsaydı bu iki çağrı kullanıcının
    // göremeyeceği bir ekran için yapılırdı.
    const route = await Page();

    expect(route.type).toBe(shellGate);
    expect(route.props).toMatchObject({ shell: "employer", href: "/isveren/ilan/yeni" });
    expect(fetchJobCategories).not.toHaveBeenCalled();
    expect(fetchJobTemplates).not.toHaveBeenCalled();
  });

  it("kimlik kapısı kapalıysa yayımlamayı engelleyen kapıyı forma verir", async () => {
    currentGates.mockResolvedValue({
      viewer: { firstName: "Ayşe" },
      failure: null,
      gates: { individualJob: { open: false, blockedBy: ["identityVerification"] } },
    });

    expect(await formProps()).toMatchObject({ blocked: ["identityVerification"] });
  });

  it("kapı açıkken yayımlamayı hiçbir şey engellemez", async () => {
    expect(await formProps()).toMatchObject({ blocked: [] });
  });

  it("form verisi okunurken biten oturumun yönlendirmesini hata durumuna dönüştürmez", async () => {
    const interrupt = sessionExpiryRedirect("/giris?next=%2Fisveren%2Filan%2Fyeni");
    fetchJobTemplates.mockRejectedValue(interrupt);

    await expect(NewIndividualJobPanel()).rejects.toBe(interrupt);
  });

  it("kategori kataloğu okunamazsa formu hata durumuyla çizer", async () => {
    // Katalog düşünce form kaybolmuyor: kullanıcı nedenini okuyor.
    fetchJobCategories.mockRejectedValue(
      new ApiError({
        status: 503,
        errorCode: "EXTERNAL_SERVICE",
        errorCategory: "EXTERNAL_SERVICE",
        message: "ham mesaj",
      }),
    );

    expect(await formProps()).toMatchObject({
      categories: { status: "error", errorCode: "EXTERNAL_SERVICE", httpStatus: 503 },
    });
  });

  it("şablonun sayı alanlarını formun okuduğu metinlere çevirir", async () => {
    fetchJobTemplates.mockResolvedValue([
      {
        id: "7f0a1e58-6a3c-4a3f-9a10-6a1c2d3e4f11",
        templateName: "Etkinlik garsonu",
        category,
        title: "Garson",
        description: null,
        sector: null,
        position: null,
        duties: null,
        dressCode: null,
        type: "ONE_TIME",
        salaryType: "DAILY",
        salary: 1500,
        minAge: 18,
        maxAge: 45,
        experienceRequired: false,
      },
    ]);

    expect(await formProps()).toMatchObject({
      templates: {
        status: "ready",
        data: [
          {
            categoryId: category.id,
            salary: "1500",
            minAge: "18",
            maxAge: "45",
            experienceRequired: "false",
          },
        ],
      },
    });
  });
});

describe("yeni bireysel ilan sayfası — işveren kimliği", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentGates.mockResolvedValue({
      viewer: { firstName: "Ayşe" },
      failure: null,
      gates: { individualJob: { open: true } },
    });
    fetchJobCategories.mockResolvedValue([category]);
    fetchJobTemplates.mockResolvedValue([]);
  });

  it("formu bireysel kimlikle çizer", async () => {
    // Aynı bileşen şirket ilanını da çiziyor; kimlik prop'u karışırsa sigorta
    // anahtarı bireysel forma girer ve sunucu o alanı hiç kabul etmez.
    expect(await formProps()).toMatchObject({ owner: { kind: "individual" } });
  });
});
