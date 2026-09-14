import { describe, expect, it } from "vitest";

import {
  acceptanceHeadcount,
  applicantMessaging,
  applicantPage,
  applicantPageSize,
  applicantsInFilter,
  applicationDecisionGate,
  isApplicationDecision,
  openAcceptanceHeadcount,
  type ApplicationDecisionOutcome,
  type JobApplicant,
} from "./employer-review";

/** Kontenjanı işe alınmışlarla dolmuş ilan; kapı testlerinin sabit girdisi. */
const fullHeadcount = acceptanceHeadcount({
  headcount: 1,
  hiredCount: 1,
  applicants: [],
  decidedNow: new Map(),
});

const acceptedNow: ApplicationDecisionOutcome = { decision: "ACCEPTED", assignmentId: null, messaging: null };

describe("işveren başvuru listesinin istemci tarafı dilimlemesi", () => {
  it("sayfa boyutundan fazlasını hiç taşımaz", () => {
    // `GET /jobs/{jobId}/applications` sayfalı değil: 500 başvuru tek yanıtta
    // geliyor. Ekranın kilitlenmemesinin tek koşulu, kart üretiminin sayfa
    // boyutuyla sınırlı kalması.
    const page = applicantPage(applicants(500), 0);

    expect(page.items).toHaveLength(applicantPageSize);
    expect(page.totalElements).toBe(500);
    expect(page.totalPages).toBe(Math.ceil(500 / applicantPageSize));
    expect(page.items[0].id).toBe("applicant-0");
  });

  it("son sayfada yalnız kalan kayıtları taşır", () => {
    const page = applicantPage(applicants(45), 2);

    expect(page.items).toHaveLength(5);
    expect(page.items[0].id).toBe("applicant-40");
    expect(page.last).toBe(true);
    expect(page.first).toBe(false);
  });

  it("aralık dışındaki sayfa numarasını son sayfaya sabitler", () => {
    // Numara adres çubuğundan değil ekranın yerel durumundan geliyor, ama
    // liste bir prop: sunucu tazelemesinden sonra kısalan listede elde kalan
    // numara kullanıcıyı boş bir ekrana düşürürdü.
    const page = applicantPage(applicants(45), 99);

    expect(page.page).toBe(2);
    expect(page.items).toHaveLength(5);
  });

  it("boş listede ilk ve son sayfayı birlikte bildirir", () => {
    const page = applicantPage([], 3);

    expect(page).toMatchObject({
      page: 0,
      totalPages: 0,
      totalElements: 0,
      first: true,
      last: true,
    });
    expect(page.items).toEqual([]);
  });

  it("durum süzgeci yalnız o durumdaki başvuruları bırakır", () => {
    const list = [
      applicant("a", "APPLIED"),
      applicant("b", "ACCEPTED"),
      applicant("c", "REJECTED"),
      applicant("d", "APPLIED"),
    ];

    expect(applicantsInFilter(list, "APPLIED").map((item) => item.id)).toEqual(["a", "d"]);
    expect(applicantsInFilter(list, "ALL")).toEqual(list);
  });
});

describe("başvuru karar kapısı", () => {
  it("bekleyen başvuruda ve boş kontenjanda iki eylemi de açar", () => {
    const gate = applicationDecisionGate({
      status: "APPLIED",
      headcount: openAcceptanceHeadcount,
      decidedNow: null,
    });

    expect(gate).toEqual({
      canAccept: true,
      canReject: true,
      closedReason: null,
      acceptClosedReason: null,
    });
  });

  it("kontenjan dolduğunda yalnız kabulü kapatır ve nedenini yazar", () => {
    // Sunucu dolu ilanda kabulü `JOB_APPLICATION_JOB_HEADCOUNT_FULL` (409) ile
    // reddediyor ama **reddi** kabul etmeye devam ediyor
    // (`assertOpeningAvailable` yalnız `accepted` dalında çağrılıyor). İki
    // eylemi birlikte kapatmak, işvereni yapabildiği bir işten alıkoyardı.
    const gate = applicationDecisionGate({
      status: "APPLIED",
      headcount: fullHeadcount,
      decidedNow: null,
    });

    expect(gate.canAccept).toBe(false);
    expect(gate.canReject).toBe(true);
    expect(gate.closedReason).toBeNull();
    expect(gate.acceptClosedReason).toMatch(/kontenjanı doldu/);
  });

  it("cevaplanmış başvuruda ikinci kararı kapatır", () => {
    // `JOB_APPLICATION_ALREADY_RESPONDED`: sunucu ikinci kararı 409 ile
    // reddediyor ve ekran bunu önden göstermezse kullanıcı geri alınamaz
    // sandığı bir düğmeye basar.
    for (const status of ["ACCEPTED", "REJECTED"] as const) {
      const gate = applicationDecisionGate({
        status,
        headcount: openAcceptanceHeadcount,
        decidedNow: null,
      });

      expect(gate.canAccept).toBe(false);
      expect(gate.canReject).toBe(false);
      expect(gate.closedReason).toMatch(/geri alınamıyor/);
    }
  });

  it("geri çekilmiş başvuruyu cevaplanmış başvurudan ayrı bir metinle kapatır", () => {
    // İki hâl de kapalı ama sebepleri ayrı: birinde kararı işveren verdi,
    // ötekinde aday çekildi. Tek metin, işverene kendi vermediği bir kararı
    // verdiğini söylerdi.
    const withdrawn = applicationDecisionGate({
      status: "WITHDRAWN",
      headcount: openAcceptanceHeadcount,
      decidedNow: null,
    });
    const answered = applicationDecisionGate({
      status: "ACCEPTED",
      headcount: openAcceptanceHeadcount,
      decidedNow: null,
    });

    expect(withdrawn.canAccept).toBe(false);
    expect(withdrawn.canReject).toBe(false);
    expect(withdrawn.closedReason).toMatch(/geri çekti/);
    expect(withdrawn.closedReason).not.toEqual(answered.closedReason);
  });

  it("okunamayan durumda karar vermez", () => {
    // `UNKNOWN` backend'in tanımadığımız bir değer göndermesi. Açık bırakmak,
    // ne olduğu bilinmeyen bir kayda geri alınamaz bir karar vermek olurdu.
    const gate = applicationDecisionGate({
      status: "UNKNOWN",
      headcount: openAcceptanceHeadcount,
      decidedNow: null,
    });

    expect(gate.canAccept).toBe(false);
    expect(gate.canReject).toBe(false);
    expect(gate.closedReason).toMatch(/durumu okunamadı/);
  });

  it("bu oturumda verilmiş karar, sunucu listesi hâlâ APPLIED derken de kapatır", () => {
    // Liste sunucudan bir kez iniyor: karar verildikten sonra tazeleme
    // dönene kadar aynı kayıt hâlâ `APPLIED` görünüyor. Kapı yalnız `status`e
    // baksaydı kart o aralıkta ikinci bir karara açık kalırdı.
    const gate = applicationDecisionGate({
      status: "APPLIED",
      headcount: openAcceptanceHeadcount,
      decidedNow: acceptedNow,
    });

    expect(gate.canAccept).toBe(false);
    expect(gate.canReject).toBe(false);
    expect(gate.closedReason).toMatch(/geri alınamıyor/);
  });

  it("sunucunun cevabı okunamadığında kararı ayrı bir metinle kapatır", () => {
    // 2xx döndü ama `status` okunamadı: kabul mü red mi işlendiği belli değil.
    // "Karar verildi, geri alınamıyor" demek işverene bilmediğimiz bir şeyi
    // söylemek olurdu; ikinci bir karar göndermek de geri alınamaz.
    const unreadable = applicationDecisionGate({
      status: "APPLIED",
      headcount: openAcceptanceHeadcount,
      decidedNow: { decision: "UNKNOWN", assignmentId: null, messaging: null },
    });
    const answered = applicationDecisionGate({
      status: "APPLIED",
      headcount: openAcceptanceHeadcount,
      decidedNow: acceptedNow,
    });

    expect(unreadable.canAccept).toBe(false);
    expect(unreadable.canReject).toBe(false);
    expect(unreadable.closedReason).toMatch(/ikinci bir karar göndermek geri alınamaz/);
    expect(unreadable.closedReason).not.toEqual(answered.closedReason);
  });

  it("gövdeye yalnız sunucunun tanıdığı iki karar adını geçirir", () => {
    // `respondToApplication` başka bir `ApplicationStatus` değerini
    // `JOB_APPLICATION_INVALID_STATUS_TRANSITION` ile reddediyor.
    expect(isApplicationDecision("ACCEPTED")).toBe(true);
    expect(isApplicationDecision("REJECTED")).toBe(true);
    expect(isApplicationDecision("WITHDRAWN")).toBe(false);
    expect(isApplicationDecision("APPLIED")).toBe(false);
    expect(isApplicationDecision("accepted")).toBe(false);
  });
});

describe("kabul kapısının kontenjan sayacı", () => {
  it("tek yeri bekleyen bir teklifte olan ilanda kabulü kapatır", () => {
    // Sunucudaki iki küme ayrışıyor: `hiredCount` yalnız {CONFIRMED,
    // IN_PROGRESS, COMPLETED} sayıyor (`JobManager.java:280`), kabul kapısı
    // `PENDING_CONFIRMATION`ı da yer kaplıyor sayıyor
    // (`JobAssignmentManager.java:71`). `hiredCount` okunduğunda tek kişilik
    // ilanın tek yeri bekleyen bir teklifteyken "yer var" görünüyor ve
    // kullanıcı geri alınamaz sandığı düğmeden 409 yiyor — #80 bunu reddediyor.
    const gate = acceptanceHeadcount({
      headcount: 1,
      hiredCount: 0,
      applicants: [applicant("a", "ACCEPTED"), applicant("b", "APPLIED")],
      decidedNow: new Map(),
    });

    expect(gate.full).toBe(true);
    expect(gate.reason).toMatch(/kontenjanını doldurdu/);
  });

  it("bu oturumda verilen kabul de yeri tüketir", () => {
    // En olası senaryo: ilk adayı kabul et, hemen ikinciye bak. Sunucu listesi
    // tazelenene kadar ilk kart hâlâ `APPLIED` görünüyor.
    const gate = acceptanceHeadcount({
      headcount: 1,
      hiredCount: 0,
      applicants: [applicant("a", "APPLIED"), applicant("b", "APPLIED")],
      decidedNow: new Map([["a", acceptedNow]]),
    });

    expect(gate.full).toBe(true);
  });

  it("bu oturumdaki reddi yer tüketen saymaz", () => {
    // Red bir atama kurmuyor: `respondToApplication` yalnız kabul dalında
    // `new JobAssignment()` yazıyor.
    const gate = acceptanceHeadcount({
      headcount: 1,
      hiredCount: 0,
      applicants: [applicant("a", "APPLIED"), applicant("b", "APPLIED")],
      decidedNow: new Map([["a", { decision: "REJECTED" as const, assignmentId: null, messaging: null }]]),
    });

    expect(gate.full).toBe(false);
    expect(gate.reason).toBeNull();
  });

  it("yer kalan ilanda kapıyı açık bırakır", () => {
    const gate = acceptanceHeadcount({
      headcount: 3,
      hiredCount: 1,
      applicants: [applicant("a", "ACCEPTED"), applicant("b", "APPLIED")],
      decidedNow: new Map(),
    });

    expect(gate).toEqual(openAcceptanceHeadcount);
  });

  it("kontenjanı bildirilmemiş ilanda hiç kapatmaz", () => {
    // `headcount: null` sınırsız demek: `assertOpeningAvailable` alanı null
    // görünce hiç saymadan geçiyor, yani kapatılacak bir kapı yok.
    const gate = acceptanceHeadcount({
      headcount: null,
      hiredCount: 9,
      applicants: [applicant("a", "ACCEPTED"), applicant("b", "ACCEPTED")],
      decidedNow: new Map(),
    });

    expect(gate).toEqual(openAcceptanceHeadcount);
  });

  it("işe alınmışla dolan kontenjanı bekleyen tekliften ayrı bir metinle söyler", () => {
    // İki hâlin çaresi ayrı: işe alınmışla dolan kontenjanda yol kurulmuş bir
    // atamayı iptal etmek, bekleyen teklifte ise adayın cevabını beklemek.
    // Tek metin, olmayan bir atamayı iptal etmeye yollardı.
    const hired = acceptanceHeadcount({
      headcount: 1,
      hiredCount: 1,
      applicants: [applicant("a", "ACCEPTED")],
      decidedNow: new Map(),
    });
    const pending = acceptanceHeadcount({
      headcount: 1,
      hiredCount: 0,
      applicants: [applicant("a", "ACCEPTED")],
      decidedNow: new Map(),
    });

    expect(hired.reason).toMatch(/kontenjanı doldu/);
    expect(pending.reason).toMatch(/geri çevirirse yer yeniden açılır/);
    expect(hired.reason).not.toEqual(pending.reason);
  });

  it("liste bayatsa bile sunucunun işe alınmış sayısının altına düşmez", () => {
    // Üç sayının sırası kesin: `hiredCount ≤ yer tüketen ≤ kabul edilmiş
    // başvuru`. Yalnız listeye bakmak, liste eksik indiğinde kapıyı açardı.
    const gate = acceptanceHeadcount({
      headcount: 2,
      hiredCount: 2,
      applicants: [],
      decidedNow: new Map(),
    });

    expect(gate.full).toBe(true);
  });
});

function applicants(count: number): readonly JobApplicant[] {
  return Array.from({ length: count }, (_, index) => applicant(`applicant-${index}`, "APPLIED"));
}

function applicant(id: string, status: JobApplicant["status"]): JobApplicant {
  return {
    id,
    status,
    appliedAt: "2026-09-01T09:00:00Z",
    answeredAt: null,
    rejectionReason: null,
    assignmentId: null,
    notes: null,
    cvUrl: null,
    occupation: null,
    applicant: {
      id: `${id}-user`,
      fullName: "Aday",
      profilePictureUrl: null,
    },
  };
}

describe("aday kartının mesaj kapısı", () => {
  const workerId = "3b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f6e";
  const assignmentId = "6d2c0e58-2f0a-4b1e-9c3d-7a8b9c0d1e2f";
  const listed = {
    workerId,
    assignmentId,
    messaging: { available: true, reason: "AVAILABLE" as const },
  };

  it("atama listesindeki kararı taşır", () => {
    expect(applicantMessaging({ decidedNow: null, assignment: listed })).toEqual({
      assignmentId,
      messaging: { available: true, reason: "AVAILABLE" },
    });
  });

  it("ataması olmayan adayda karar üretmez", () => {
    // Karar bekleyen ya da reddedilen adayın ataması yok; açılacak sohbet de
    // yok. Backend `POST /jobs/{jobId}/conversation`'ı 403 ile kapatıyor.
    expect(applicantMessaging({ decidedNow: null, assignment: null })).toBeNull();
  });

  it("bu oturumdaki kabulün kararı listedekinden öncedir", () => {
    // Liste sayfa açılırken okundu, kabul ondan sonra kuruldu: yeni atama
    // ödemeye kapalı ve kart ödeme yolunu göstermeli.
    const freshId = "7e3d1f69-3a1b-4c2f-8d4e-8b9c0d1e2f3a";
    expect(applicantMessaging({
      decidedNow: {
        decision: "ACCEPTED",
        assignmentId: freshId,
        messaging: { available: false, reason: "PAYMENT_REQUIRED" },
      },
      assignment: listed,
    })).toEqual({
      assignmentId: freshId,
      messaging: { available: false, reason: "PAYMENT_REQUIRED" },
    });
  });

  it("kararı okunamayan kabulde listeye düşmez", () => {
    // Sunucu atama kimliğini ya da kapıyı yazmadıysa "açık" varsaymak
    // kullanıcıyı 403'e yollardı; "kapalı" varsaymak yanlış sebep söylerdi.
    expect(applicantMessaging({
      decidedNow: { decision: "ACCEPTED", assignmentId: null, messaging: null },
      assignment: listed,
    })).toBeNull();
    expect(applicantMessaging({
      decidedNow: { decision: "UNKNOWN", assignmentId: null, messaging: null },
      assignment: listed,
    })).toEqual({ assignmentId, messaging: { available: true, reason: "AVAILABLE" } });
  });

  it("listedeki kayıt karar taşımıyorsa düğme çizilmez", () => {
    expect(applicantMessaging({
      decidedNow: null,
      assignment: { workerId, assignmentId, messaging: null },
    })).toBeNull();
  });
});
