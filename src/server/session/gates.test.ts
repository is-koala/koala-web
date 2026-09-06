import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  cookieStore,
  envelope,
  jsonResponse,
  requestHeaders as testRequestHeaders,
} from "../../../tests/support/session-cookies";

import type { Viewer } from "./viewer";
import {
  corporateJobGate,
  corporatePaymentGate,
  enterSection,
  gateVerdictRequirements,
  gateRequirements,
  viewerGates,
} from "./gates";

vi.mock("next/headers", async () => {
  const support = await import("../../../tests/support/session-cookies");
  return {
    cookies: () => Promise.resolve(support.cookieStore),
    headers: () => Promise.resolve(support.requestHeaders),
  };
});
vi.mock("next/navigation", async () => ({
  redirect: (await import("../../../tests/support/navigation")).throwingRedirect(),
}));

/** Kapıların baktığı alanlar dışında her şeyi sabit tutan kullanıcı. */
function viewerWith(overrides: Partial<Viewer> = {}): Viewer {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    firstName: "Ayşe",
    lastName: "Yıldız",
    displayName: "Ayşe Yıldız",
    email: "ayse@example.test",
    phoneNumber: "+905551112233",
    emailVerified: true,
    phoneVerified: true,
    profilePictureUrl: null,
    jobTitle: null,
    about: null,
    qualifications: null,
    interests: null,
    experiences: [],
    educations: [],
    isEmployer: true,
    identityVerified: true,
    hasIdentityNumber: true,
    hasAddress: true,
    companies: [],
    ...overrides,
  };
}

describe("kimlik kapısı", () => {
  it("doğrulanmamış kimlik bireysel ilan açmayı kapatır", () => {
    // `JobManager.java:110-114` gövdeye hiç bakmadan reddediyor; kullanıcı bunu
    // formu doldurduktan sonra öğrenirse akış çöker.
    const gates = viewerGates(viewerWith({ identityVerified: false }));

    expect(gates.individualJob).toEqual({
      open: false,
      blockedBy: ["identityVerification"],
    });
  });

  it("doğrulanmış kimlikte bireysel ilan kapısı açık", () => {
    expect(viewerGates(viewerWith()).individualJob).toEqual({ open: true });
  });
});

describe("işveren rolü kapısı", () => {
  it("işveren olmayan hesapta bireysel ilan açma kapalı", () => {
    // `isEmployer` yalnız kayıt anında yazılıyor ve geri alınacak bir uç yok:
    // "iş arıyorum" diyerek kaydolan kullanıcı bugün bireysel ilan hiç açamaz.
    const gates = viewerGates(viewerWith({ isEmployer: false }));

    expect(gates.individualJob).toEqual({ open: false, blockedBy: ["employerRole"] });
  });

  it("iki koşul da eksikse ikisini birden yazar", () => {
    // Tek neden gösterip kullanıcıyı ikinci bir redde sürmek, kapıyı hiç
    // koymamakla aynı sonucu verir.
    const gates = viewerGates(viewerWith({ isEmployer: false, identityVerified: false }));

    expect(gates.individualJob).toEqual({
      open: false,
      blockedBy: ["employerRole", "identityVerification"],
    });
  });
});

describe("bireysel işverenin ödeme oturumu kapısı", () => {
  it("kimlik doğrulanmış ama TC yoksa yine kapalı", () => {
    // `JobAssignmentManager.java:212` iki koşul arıyor: `identityVerified`
    // **ve** `tcIdentityNumber != null`. Yalnız ilkine bakan bir kapı
    // kullanıcıyı ödeme ekranında beklenmedik bir 400'e sokar.
    const gates = viewerGates(viewerWith({ hasIdentityNumber: false }));

    expect(gates.individualPayment).toEqual({ open: false, blockedBy: ["identityNumber"] });
  });

  it("fatura adresi yoksa ödeme oturumu kapalı", () => {
    // `JobAssignmentManager.java:337-350` bireysel işverenin kendi adresini
    // okuyor; yoksa ödeme oturumu hiç kurulmuyor.
    const gates = viewerGates(viewerWith({ hasAddress: false }));

    expect(gates.individualPayment).toEqual({
      open: false,
      blockedBy: ["individualBillingAddress"],
    });
  });

  it("üç koşul da tamamsa açık", () => {
    expect(viewerGates(viewerWith()).individualPayment).toEqual({ open: true });
  });
});

describe("şirket oluşturma kapısı", () => {
  it("yalnız kimlik doğrulaması ister", () => {
    // `CompanyManager.java:103-105` tek koşul arıyor; işveren olmak gerekmiyor.
    expect(viewerGates(viewerWith({ isEmployer: false })).companyCreation).toEqual({ open: true });
    expect(viewerGates(viewerWith({ identityVerified: false })).companyCreation).toEqual({
      open: false,
      blockedBy: ["identityVerification"],
    });
  });
});

const twoCompanies = [
  { companyId: "c1", companyName: "Koala A.Ş.", role: "ADMIN", approved: true },
  { companyId: "c2", companyName: "Koala Lojistik", role: "STAFF", approved: false },
] as const;

describe("şirket ilanı kapısı", () => {
  it("kararı ilanın açılacağı şirkete göre verir", () => {
    // "Kullanıcının şirketi" diye tek bir nesne varsayan bir kapı, iki
    // şirketli bir yetkilide yanlış cevap verir.
    const gates = viewerGates(viewerWith({ companies: twoCompanies }));

    expect(corporateJobGate(gates, "c1")).toEqual({ open: true });
    expect(corporateJobGate(gates, "c2")).toEqual({ open: false, blockedBy: ["companyApproval"] });
  });

  it("üyeliği olmayan şirket için yetkili değil der", () => {
    // `JobManager.java:214-219` yetkililiği şirketin kişi listesinden okuyor;
    // listede olmayan kullanıcı 400 alır.
    const gates = viewerGates(viewerWith({ companies: twoCompanies }));

    expect(corporateJobGate(gates, "c3")).toEqual({ open: false, blockedBy: ["companyContact"] });
  });

  it("şirket ilanı kimlik doğrulaması istemez", () => {
    // `JobManager.createCorporateJob` (`:180-219`) yalnız yetkililik bakıyor.
    // Bireysel yolun kimlik koşulunu buraya kopyalamak, doğrulanmamış ama
    // yetkili bir kullanıcıyı yapabildiği bir işten alıkoyardı.
    const gates = viewerGates(viewerWith({ identityVerified: false, companies: twoCompanies }));

    expect(corporateJobGate(gates, "c1")).toEqual({ open: true });
  });

  it("her üyeliği kendi kararıyla birlikte taşır", () => {
    const gates = viewerGates(viewerWith({ companies: twoCompanies }));

    expect(gates.companies).toEqual([
      {
        companyId: "c1",
        companyName: "Koala A.Ş.",
        role: "ADMIN",
        approved: true,
        corporateJob: { open: true },
      },
      {
        companyId: "c2",
        companyName: "Koala Lojistik",
        role: "STAFF",
        approved: false,
        corporateJob: { open: false, blockedBy: ["companyApproval"] },
      },
    ]);
  });
});

describe("bildirilmiş kapıların çözümü", () => {
  it("karşılanmamış kapıyı kipine göre ayırır", () => {
    // Advisory olan şerit olur ve kabuk kullanılabilir kalır; blocking olan
    // eylemi kapatır. İkisi tek listede dönseydi çağıran hangisinin ekranı
    // kilitlediğini bilemezdi.
    const gates = viewerGates(viewerWith({ identityVerified: false, hasIdentityNumber: false }));

    expect(gateRequirements(gates, ["identityVerification", "identityNumber"])).toEqual({
      advisories: ["identityVerification"],
      blocked: ["identityNumber"],
    });
  });

  it("bildirilmemiş bir kapı karşılanmasa da sessiz kalır", () => {
    // Bölüm istemediği bir kapının nedenini göstermemeli: `/isveren/mesajlar`
    // fatura adresi yüzünden uyarı verirse uyarı anlamını yitirir.
    const gates = viewerGates(viewerWith({ hasAddress: false }));

    expect(gateRequirements(gates, [])).toEqual({ advisories: [], blocked: [] });
  });

  it("koşulları tamam olan kullanıcıda hiçbir kapı kalmaz", () => {
    const gates = viewerGates(viewerWith());

    expect(gateRequirements(gates, ["identityVerification", "employerRole"])).toEqual({
      advisories: [],
      blocked: [],
    });
  });

  it("şirkete bağlı kapılar kullanıcı düzeyinde karşılanmamış sayılmaz", () => {
    // `companyApproval` ve `companyContact` bir şirket kimliği olmadan
    // cevaplanamaz; kabuk düzeyinde "eksik" saymak onaysız şirketi olmayan
    // kullanıcıya da şerit gösterirdi.
    const gates = viewerGates(
      viewerWith({
        companies: [{ companyId: "c2", companyName: "Koala Lojistik", role: "STAFF", approved: false }],
      }),
    );

    expect(gateRequirements(gates, ["companyApproval", "companyContact"])).toEqual({
      advisories: [],
      blocked: [],
    });
  });
});

describe("bölümün kapısı", () => {
  beforeEach(() => {
    vi.stubEnv("API_URL", "https://api.example.test");
    vi.stubEnv("APP_VERSION", "1.4.0");
    testRequestHeaders.delete("x-koala-path");
    cookieStore.values.clear();
    cookieStore.values.set("koala_did", "b7b1f0d24c2f4f6c8a9e5d3c1b0a7f6e");
    cookieStore.values.set("koala_at", "access-placeholder");
    cookieStore.values.set("koala_rt", "refresh-placeholder");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  function userMe(overrides: Record<string, unknown> = {}) {
    return {
      id: "6f1a0e2c-0000-4000-8000-000000000001",
      firstName: "Ayşe",
      lastName: "Yıldız",
      email: "ayse@example.test",
      isEmployer: true,
      identityVerified: true,
      maskedTcIdentityNumber: "123*****01",
      address: { id: "a1" },
      experiences: [],
      educations: [],
      companies: [],
      ...overrides,
    };
  }

  it("finansal durum görünümünü kimlik eksiği olsa da açık tutar", async () => {
    // Kabuk profili zaten okuyor; kapı okuyucusu ikinci bir tura çıkarsa her
    // sayfa render'ı iki kez backend'e gider.
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(200, envelope(userMe({ maskedTcIdentityNumber: null }))),
      );
    vi.stubGlobal("fetch", fetchMock);

    const entry = await enterSection("employer", "/isveren/odemeler");

    expect(entry.blocked).toEqual([]);
    expect(entry.advisories).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("kayıtta olmayan adres için kapı bildirmez", async () => {
    // Bildirilmemiş bir adres 404'tür; kapı katmanı oraya kendi kararını
    // uydurmamalı.
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, envelope(userMe()))));

    const entry = await enterSection("employer", "/isveren/bilinmeyen");

    expect(entry.blocked).toEqual([]);
    expect(entry.advisories).toEqual([]);
  });

  it("profil okunamadığında kapı kararı üretmez", async () => {
    // Çözülemeyen profilde "kimliğin doğrulanmamış" demek uydurma olur:
    // bilinmeyen bir durumu eksiklik gibi göstermek kullanıcıyı yanıltır.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(503, {
          success: false,
          httpStatus: "SERVICE_UNAVAILABLE",
          errorCode: "EXTERNAL_SERVICE",
        }),
      ),
    );

    const entry = await enterSection("employer", "/isveren/odemeler");

    expect(entry.gates).toBeNull();
    expect(entry.blocked).toEqual([]);
    expect(entry.failure).toEqual({ status: 503, errorCode: "EXTERNAL_SERVICE" });
  });
});

describe("şirket ilanının ödeme kapısı", () => {
  it("ödeme kapılarını sözlükteki kiplerini bozmadan ayırır", () => {
    expect(gateVerdictRequirements({
      open: false,
      blockedBy: ["companyContact", "companyBillingAddress"],
    })).toEqual({
      advisories: ["companyBillingAddress"],
      blocked: ["companyContact"],
    });
  });

  it("şirketin adresini sorar, kullanıcınınkini değil", () => {
    // `JobAssignmentManager.java:316-326` şirket ilanında **şirketin** adresini
    // okuyor. Kendi adresi dolu bir yetkili, şirketin adresi boşsa yine 400 alır.
    const gates = viewerGates(viewerWith({ hasAddress: true, companies: twoCompanies }));

    expect(corporatePaymentGate(gates, "c1", false)).toEqual({
      open: false,
      blockedBy: ["companyBillingAddress"],
    });
    expect(corporatePaymentGate(gates, "c1", true)).toEqual({ open: true });
  });

  it("adres tamam olsa da yetkili olmayan kapıyı geçemez", () => {
    const gates = viewerGates(viewerWith({ companies: twoCompanies }));

    expect(corporatePaymentGate(gates, "c3", true)).toEqual({
      open: false,
      blockedBy: ["companyContact"],
    });
  });

  it("şirket adresi kullanıcının kendi fatura adresi kapısını devralmaz", () => {
    // Kendi adresi olmayan bir yetkili şirket ilanının ödemesini yine
    // başlatabilir: o yolda kendi adresine hiç bakılmıyor.
    const gates = viewerGates(viewerWith({ hasAddress: false, companies: twoCompanies }));

    expect(corporatePaymentGate(gates, "c1", true)).toEqual({ open: true });
  });
});

describe("onaysız şirketin ödeme yolu", () => {
  it("onay eksiği ödemeyi kapatmaz", () => {
    // Onay kuralı ilan **açmanın** önünde ve yalnız istemcide yaşıyor.
    // Aynı kuralı ödemeye de uygulamak, backend onaysız şirkete ilan
    // açtırdığı için işçisi kabul edilmiş bir işvereni parasını ödeyemez
    // hâlde bırakırdı — kapının amacı bunun tersi.
    const gates = viewerGates(viewerWith({ companies: twoCompanies }));

    expect(corporateJobGate(gates, "c2")).toEqual({
      open: false,
      blockedBy: ["companyApproval"],
    });
    expect(corporatePaymentGate(gates, "c2", true)).toEqual({ open: true });
  });
});
