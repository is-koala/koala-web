import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  applicantPageSize,
  type ApplicantDossier,
  type JobApplicant,
} from "@/applications/employer-review";
import { ApplicantReview } from "./applicant-review";

const jobId = "11111111-1111-4111-8111-111111111111";

/** Hiçbir şey yapmayan action; eylemin çağrıldığını ölçmek yeterli olduğunda. */
const idleAction = async (state: unknown, formData: FormData) => {
  void state;
  void formData;
  return { status: "idle" } as const;
};

function renderReview(overrides: Partial<Parameters<typeof ApplicantReview>[0]> = {}) {
  const idle = idleAction;
  const dossierAction = vi.fn(idle);
  const talentPoolAction = vi.fn(idle);
  const conversationAction = vi.fn(idle);
  const decisionAction = vi.fn(idle);

  render(
    <ApplicantReview
      jobId={jobId}
      applicants={[applicant("a", "APPLIED")]}
      inTalentPool={[]}
      assignments={[]}
      headcount={null}
      hiredCount={0}
      dossierAction={dossierAction}
      talentPoolAction={talentPoolAction}
      conversationAction={conversationAction}
      decisionAction={decisionAction}
      {...overrides}
    />,
  );

  return { dossierAction, talentPoolAction, conversationAction, decisionAction };
}

describe("işveren aday inceleme listesi", () => {
  it("beş yüz başvuruda yalnız bir sayfalık kart çizer", () => {
    // Uç sayfalı değil: 500 kayıt tek yanıtta geliyor. Hepsini bir anda karta
    // dönüştürmek tarayıcıyı kilitlerdi.
    renderReview({ applicants: manyApplicants(500) });

    expect(screen.getAllByRole("article")).toHaveLength(applicantPageSize);
    expect(screen.getByText("Sayfa 1 / 25")).toBeInTheDocument();
  });

  it("sonraki sayfaya sunucuya gitmeden geçer", async () => {
    const user = userEvent.setup();
    const { dossierAction } = renderReview({ applicants: manyApplicants(500) });

    await user.click(screen.getByRole("button", { name: "Sonraki sayfa" }));

    expect(screen.getByText("Sayfa 2 / 25")).toBeInTheDocument();
    expect(screen.getByText("Aday 20")).toBeInTheDocument();
    expect(dossierAction).not.toHaveBeenCalled();
  });

  it("durum süzgeci listeyi daraltır ve ilk sayfaya döner", async () => {
    const user = userEvent.setup();
    renderReview({
      applicants: [
        ...manyApplicants(40),
        applicant("kabul", "ACCEPTED"),
      ],
    });

    await user.click(screen.getByRole("button", { name: "Sonraki sayfa" }));
    expect(screen.getByText("Sayfa 2 / 3")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Bekleyenler" }));

    expect(screen.getByText("Sayfa 1 / 2")).toBeInTheDocument();
    expect(screen.getByText("Aday 0")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Önceki sayfa" })).toBeNull();
  });

  it("adayın mesleğini ilanın başlığı gibi değil kendi etiketiyle yazar", () => {
    // `JobApplicantDto.jobTitle` adayın mesleği (`JobApplicationMapper.java:26`).
    renderReview({
      applicants: [{ ...applicant("a", "APPLIED"), occupation: "Barista" }],
    });

    const card = screen.getByRole("article");
    expect(within(card).getByText("Mesleği")).toBeInTheDocument();
    expect(within(card).getByText("Barista")).toBeInTheDocument();
  });

  it("cevaplanmış başvuruda kararı yazar", () => {
    renderReview({ applicants: [applicant("a", "ACCEPTED")] });

    expect(screen.getByText("Kabul edildi")).toBeInTheDocument();
  });

  it("havuzdaki adayda çıkarma, dışındakinde ekleme işlemini gönderir", async () => {
    const user = userEvent.setup();
    const { talentPoolAction } = renderReview({
      applicants: [applicant("a", "APPLIED"), applicant("b", "APPLIED")],
      inTalentPool: ["a-user"],
    });

    const [first, second] = screen.getAllByRole("article");
    expect(within(first).getByRole("button", { name: "Havuzdan çıkar" })).toBeInTheDocument();

    await user.click(within(second).getByRole("button", { name: "Yetenek havuzuna ekle" }));

    expect(talentPoolAction).toHaveBeenCalledTimes(1);
    const formData = talentPoolAction.mock.calls[0][1];
    expect(formData.get("operation")).toBe("add");
    expect(formData.get("workerId")).toBe("b-user");
  });

  it("özgeçmişi yalnız bağlantı geldiğinde açar", () => {
    renderReview({
      applicants: [
        { ...applicant("a", "APPLIED"), cvUrl: "https://cdn.example.test/cv.pdf" },
        applicant("b", "APPLIED"),
      ],
    });

    const [first, second] = screen.getAllByRole("article");
    expect(within(first).getByRole("link", { name: "Özgeçmişi aç" })).toHaveAttribute(
      "href",
      "https://cdn.example.test/cv.pdf",
    );
    expect(within(second).queryByRole("link", { name: "Özgeçmişi aç" })).toBeNull();
  });

  it("başvuru tarihini sunucunun TZ'sinden bağımsız İstanbul saatiyle yazar", () => {
    // Bileşen `"use client"` taşıyor ama ilk HTML'i Next.js sunucuda çiziyor
    // ve üretimde sunucu kapsayıcıda `TZ=UTC` ile koşuyor. Sabit olmasaydı
    // ilk boya ile hidrasyon sonrası iki ayrı saat yazardı.
    //
    // Seçilen an gece yarısını geçiriyor: yanlış dilimde yalnız saat değil
    // **gün** de kayıyor (UTC'de 1 Eylül 22:00, İstanbul'da 2 Eylül 01:00).
    // Testin ev dilimi zaten Europe/Istanbul olduğu için düşman dilim
    // olmadan bu iddia hiçbir şey bağlamazdı.
    const previous = process.env.TZ;
    process.env.TZ = "UTC";
    try {
      // Denemenin gerçekten uygulandığının kanıtı.
      expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe("UTC");
      renderReview({
        applicants: [{ ...applicant("a", "APPLIED"), appliedAt: "2026-09-01T22:00:00Z" }],
      });

      expect(screen.getByRole("article")).toHaveTextContent("2 Eyl 2026 01:00");
    } finally {
      if (previous === undefined) delete process.env.TZ;
      else process.env.TZ = previous;
    }
  });

  it("özgeçmiş bağlantısında http olmayan şemayı hiç çizmez", () => {
    // `cvUrl` backend'den gelen bir metin. Doğrudan `href`'e yazılsaydı
    // `javascript:` şeması tıklamayla çalışan bir XSS yüzeyi açardı;
    // `target="_blank"` ve `rel="noreferrer noopener"` bunu kapatmıyor,
    // onlar açılan sayfanın erişimini kısıtlıyor, adresin şemasını değil.
    renderReview({
      applicants: [
        { ...applicant("kotu", "APPLIED"), cvUrl: "javascript:alert(document.cookie)" },
        { ...applicant("veri", "APPLIED"), cvUrl: "data:text/html,<script>alert(1)</script>" },
        { ...applicant("bozuk", "APPLIED"), cvUrl: "cv.pdf" },
        { ...applicant("iyi", "APPLIED"), cvUrl: "https://cdn.example.test/cv.pdf" },
      ],
    });

    const links = screen.getAllByRole("link", { name: "Özgeçmişi aç" });
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "https://cdn.example.test/cv.pdf");
  });

  it("aday panelinde rozetleri seviyeleriyle yazar", async () => {
    // #36 aday panelinden rozetleri de istiyor; rozetler `PublicProfileDto`
    // içinde değil, kendi ucunda (`GET /users/{id}/badges`).
    const user = userEvent.setup();
    renderReview({ dossierAction: vi.fn(dossierActionFor(dossier())) });

    await user.click(screen.getByRole("button", { name: "Adayı incele" }));

    const badges = await screen.findByRole("list", { name: "Rozetler" });
    expect(within(badges).getByText("Gezgin")).toBeVisible();
    expect(within(badges).getByText("Altın")).toBeVisible();
    // `BadgeTier.NONE` seviyesiz bir rozet ailesi; uydurulmuş bir seviye
    // yazmak yanlış olurdu.
    expect(within(badges).getByText("Kimlik doğrulandı")).toBeVisible();
    expect(within(badges).getAllByRole("listitem")).toHaveLength(2);
  });

  it("karşılaştırma şeridi özet inmeden üç hücreyi 'İncele' ile, indikten sonra puan, rozet ve konumla doldurur", async () => {
    // Kartlar yan yana okunuyor (#156): hücreler her kartta aynı ve özet
    // yokken gizlenmiyor, aksi hâlde kartlar farklı boyda kalırdı.
    const user = userEvent.setup();
    renderReview({ dossierAction: vi.fn(dossierActionFor(dossier())) });

    const strip = screen.getByLabelText("Karşılaştırma");
    expect(within(strip).getAllByText("İncele")).toHaveLength(3);

    await user.click(screen.getByRole("button", { name: "Adayı incele" }));

    expect(await within(strip).findByText("4.75 · 12 değerlendirme")).toBeVisible();
    expect(within(strip).getByText("2 rozet · 1 altın")).toBeVisible();
    expect(within(strip).getByText("Kadıköy, İstanbul")).toBeVisible();
  });

  it("rozeti olmayan adayda listeyi sessizce yutmaz", async () => {
    const user = userEvent.setup();
    renderReview({ dossierAction: vi.fn(dossierActionFor(dossier({ badges: [] }))) });

    await user.click(screen.getByRole("button", { name: "Adayı incele" }));

    expect(await screen.findByText("Bu aday henüz rozet kazanmamış.")).toBeVisible();
    expect(screen.queryByRole("list", { name: "Rozetler" })).toBeNull();
  });

  it("hiç değerlendirilmemiş adayda düşmez, durumu yazar", async () => {
    // #36 kabul kriteri: "Puan özeti hiç yazılmamış bir adayda ekran düşmez,
    // 'henüz değerlendirilmemiş' der." `GET /users/{id}/rating-summary`
    // böyle bir adayda `data: null` döndürüyor (`ReviewsController.java:95`).
    const user = userEvent.setup();
    renderReview({
      dossierAction: vi.fn(dossierActionFor(dossier({ ratingSummary: null, reviews: [] }))),
    });

    await user.click(screen.getByRole("button", { name: "Adayı incele" }));

    const panel = await screen.findByRole("region", { name: "Aday ayrıntısı" });
    expect(within(panel).getByText("Henüz değerlendirilmemiş")).toBeVisible();
    expect(within(panel).getByText("Bu adaya henüz değerlendirme yazılmamış.")).toBeVisible();
  });

  it("puanı olan adayda özeti ve son değerlendirmeleri yazar", async () => {
    const user = userEvent.setup();
    renderReview({ dossierAction: vi.fn(dossierActionFor(dossier())) });

    await user.click(screen.getByRole("button", { name: "Adayı incele" }));

    const panel = await screen.findByRole("region", { name: "Aday ayrıntısı" });
    expect(within(panel).getByText("4.75 / 5 · 12 değerlendirme")).toBeVisible();
    const reviews = within(panel).getByRole("list", { name: "Son değerlendirmeler" });
    expect(within(reviews).getByText("Mehmet Demir")).toBeVisible();
    expect(within(reviews).getByText("Zamanında geldi.")).toBeVisible();
    // Yazarı olmayan değerlendirme backend'de zaten anonim geliyor.
    expect(within(reviews).getByText("Anonim")).toBeVisible();
  });

  it("hiç başvuru yokken boş durumu gösterir", () => {
    renderReview({ applicants: [] });

    expect(screen.getByRole("status")).toHaveTextContent("Henüz başvuru yok");
    expect(screen.queryAllByRole("article")).toHaveLength(0);
  });
});

/** Kart "Adayı incele" dediğinde panelin dolduğu durumu üreten action. */
function dossierActionFor(value: ApplicantDossier) {
  return async (state: unknown, formData: FormData) => {
    void state;
    return {
      status: "done" as const,
      userId: String(formData.get("userId")),
      dossier: value,
    };
  };
}

function dossier(overrides: Partial<ApplicantDossier> = {}): ApplicantDossier {
  return {
    profile: {
      id: "a-user",
      fullName: "Aday a",
      profilePictureUrl: null,
      occupation: "Barista",
      about: "Beş yıl deneyim.",
      cityName: "İstanbul",
      districtName: "Kadıköy",
      cvUrl: null,
    },
    ratingSummary: { reviewCount: 12, averageRating: "4.75" },
    reviews: [
      {
        id: "review-1",
        authorName: "Mehmet Demir",
        rating: 5,
        comment: "Zamanında geldi.",
        createdAt: "2026-08-01T10:00:00Z",
      },
      {
        id: "review-2",
        authorName: null,
        rating: 4,
        comment: null,
        createdAt: "2026-07-01T10:00:00Z",
      },
    ],
    badges: [
      { code: "GEZGIN", name: "Gezgin", tier: "GOLD" },
      { code: "KIMLIK", name: "Kimlik doğrulandı", tier: "NONE" },
    ],
    ...overrides,
  };
}

describe("başvuru kabul/red karar akışı", () => {
  it("kabul diyaloğu ADR-0003 adres ifşasını, kontenjanı ve geri alınamazlığı yazar", async () => {
    // Kabul edildiği an atama kuruluyor ve tam iş adresi çalışana açılıyor
    // (`ApplicationDecisionIT.bothAcceptedWorkersSeeTheFullAddress...`:
    // `addressPrecision` `APPROXIMATE`'ten `EXACT`'e geçiyor). İşveren bunu
    // karar anında okumazsa geri alınamaz bir ifşayı sonradan öğrenir.
    const user = userEvent.setup();
    renderReview();

    await user.click(screen.getByRole("button", { name: "Kabul et" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Tam iş adresi açılır")).toBeInTheDocument();
    expect(within(dialog).getByText(/sokak, bina ve\s+kapı numarasıyla tam adresi/)).toBeInTheDocument();
    expect(within(dialog).getByText(/kontenjanından bir yer tükenir/)).toBeInTheDocument();
    expect(within(dialog).getByText("Karar geri alınamaz")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Kabulü onayla" })).toBeInTheDocument();
  });

  it("kabul onayı ACCEPTED gövdesini gönderir ve gerekçe taşımaz", async () => {
    const user = userEvent.setup();
    const { decisionAction } = renderReview();

    await user.click(screen.getByRole("button", { name: "Kabul et" }));
    await user.click(screen.getByRole("button", { name: "Kabulü onayla" }));

    expect(decisionAction).toHaveBeenCalledTimes(1);
    const form = decisionAction.mock.calls[0][1] as FormData;
    expect(form.get("decision")).toBe("ACCEPTED");
    expect(form.get("applicationId")).toBe("a");
    expect(form.get("jobId")).toBe(jobId);
    expect(form.get("rejectionReason")).toBeNull();
  });

  it("kabul onaylandığında onay düğmesi ekrandan kalkar", async () => {
    // Diyalog açık kalsaydı, aynı düğme ikinci kez basılabilir ve sunucudan
    // 409 dönerdi.
    const user = userEvent.setup();
    const decisionAction = vi.fn(async () => ({
      status: "done" as const,
      applicationId: "a",
      outcome: { decision: "ACCEPTED" as const, assignmentId: null, messaging: null },
    }));
    renderReview({ decisionAction });

    await user.click(screen.getByRole("button", { name: "Kabul et" }));
    await user.click(screen.getByRole("button", { name: "Kabulü onayla" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("button", { name: "Kabulü onayla" })).toBeNull();
    // Pozitif iddia negatifle **aynı düğümü** ölçüyor: karar bölümü çizilmiş
    // ve kararı yazmış. `getByRole("article")` komşu düğüm — kartın kendisi —
    // ve karar bölümü hiç çizilmese de yeşil kalırdı.
    const decision = screen.getByRole("region", { name: "Başvuru kararı" });
    expect(await within(decision).findByRole("status")).toHaveTextContent(
      "Başvuru kabul edildi",
    );
  });

  it("red formu gerekçeyi zorunlu tutar ve REJECTED gövdesi gönderir", async () => {
    const user = userEvent.setup();
    const { decisionAction } = renderReview();

    const card = screen.getByRole("article");
    const reason = within(card).getByLabelText("Red gerekçesi");
    expect(reason).toBeRequired();

    await user.type(reason, "Tarih uymuyor.");
    await user.click(within(card).getByRole("button", { name: "Reddi gönder" }));

    expect(decisionAction).toHaveBeenCalledTimes(1);
    const form = decisionAction.mock.calls[0][1] as FormData;
    expect(form.get("decision")).toBe("REJECTED");
    expect(form.get("rejectionReason")).toBe("Tarih uymuyor.");
  });

  it("cevap beklenirken ikinci tıklama sunucuya ikinci kararı göndermez", async () => {
    // Çift tıklama: kabul ve red geri döndürülemez, ve sunucu ikinciyi 409 ile
    // reddediyor. Düğme bekleme boyunca kapalı olmazsa kullanıcı hatayı
    // kararını verdikten sonra görür.
    const user = userEvent.setup();
    let release = () => {};
    const decisionAction = vi.fn(
      () =>
        new Promise<{ status: "idle" }>((resolve) => {
          release = () => resolve({ status: "idle" });
        }),
    );
    renderReview({ decisionAction });

    const card = screen.getByRole("article");
    await user.type(within(card).getByLabelText("Red gerekçesi"), "Tarih uymuyor.");
    const send = within(card).getByRole("button", { name: "Reddi gönder" });
    await user.click(send);

    try {
      expect(decisionAction).toHaveBeenCalledTimes(1);
      expect(send).toBeDisabled();
      expect(send).not.toHaveAttribute("data-disabled-kind");
      await user.click(send);
      expect(decisionAction).toHaveBeenCalledTimes(1);
    } finally {
      // Bir iddia düşse de eylem serbest bırakılmalı: askıda kalan söz,
      // dosyadaki sonraki testlere çözülmemiş bir React geçişi olarak
      // taşınıp onları da düşürüyor ve kusurun yerini okunmaz hâle getiriyor.
      release();
    }
  });

  it("karar verilmiş kartta ikinci karar kilitli, nedeni yazılı durur", async () => {
    // `JOB_APPLICATION_ALREADY_RESPONDED`: sunucu ikinci kararı 409 ile
    // reddediyor. Kartın kapanması bunu önden gösteriyor.
    for (const status of ["ACCEPTED", "REJECTED"] as const) {
      const { unmount } = render(
        <ApplicantReview
          jobId={jobId}
          applicants={[applicant("a", status)]}
          inTalentPool={[]}
          assignments={[]}
          headcount={null}
          hiredCount={0}
          dossierAction={vi.fn(idleAction)}
          talentPoolAction={vi.fn(idleAction)}
          conversationAction={vi.fn(idleAction)}
          decisionAction={vi.fn(idleAction)}
        />,
      );

      const decision = screen.getByRole("region", { name: "Başvuru kararı" });
      // Pozitif iddia aynı düğümü ölçüyor: bölüm çizilmiş ve gerekçe onun
      // içinde. Yalnız "düğme kapalı" deseydi, hiç çizilmeyen bir kart da geçerdi.
      expect(within(decision).getByText(/Karar geri alınamıyor/)).toBeInTheDocument();
      // Kapalı eylem **gizlenmiyor, kilitleniyor** — kabuk kapılarının
      // `blocking` kipi ve `WorkSecondaryActions.blockedReason` ile aynı kalıp.
      expect(within(decision).getByRole("button", { name: "Kabul et" }))
        .toHaveAttribute("data-disabled-kind", "permanent");
      expect(within(decision).getByRole("button", { name: "Reddi gönder" }))
        .toHaveAttribute("data-disabled-kind", "permanent");
      expect(within(decision).getByRole("button", { name: "Kabul et" })).toBeDisabled();
      expect(within(decision).getByRole("button", { name: "Reddi gönder" })).toBeDisabled();
      expect(within(decision).getByLabelText("Red gerekçesi")).toBeDisabled();

      unmount();
    }
  });

  it("geri çekilmiş başvuruda iki eylemi de kilitler ve sebebini ayrı yazar", () => {
    renderReview({ applicants: [applicant("a", "WITHDRAWN")] });

    const decision = screen.getByRole("region", { name: "Başvuru kararı" });
    expect(within(decision).getByText(/Aday başvurusunu geri çekti/)).toBeInTheDocument();
    expect(within(decision).getByRole("button", { name: "Kabul et" })).toBeDisabled();
    expect(within(decision).getByRole("button", { name: "Reddi gönder" })).toBeDisabled();
  });

  it("kontenjan dolu ilanda kabul kapalı ve sebebi yazılı, red açık kalır", () => {
    // Sunucu dolu ilanda kabulü 409 ile reddediyor ama reddi kabul etmeye
    // devam ediyor. Düğmeyi sebepsiz gizlemek kullanıcıyı aramaya bırakırdı.
    renderReview({ headcount: 1, hiredCount: 1 });

    const decision = screen.getByRole("region", { name: "Başvuru kararı" });
    expect(within(decision).getByRole("button", { name: "Kabul et" }))
      .toHaveAttribute("data-disabled-kind", "permanent");
    expect(within(decision).getByRole("button", { name: "Kabul et" })).toBeDisabled();
    expect(within(decision).getByText(/kontenjanı doldu/)).toBeInTheDocument();
    expect(within(decision).getByRole("button", { name: "Reddi gönder" })).toBeEnabled();
  });

  it("tek yeri bekleyen bir teklifte olan ilanda kabulü açık bırakmaz", () => {
    // `hiredCount` yalnız {CONFIRMED, IN_PROGRESS, COMPLETED} sayıyor; kabul
    // kapısı `PENDING_CONFIRMATION` teklifleri de yer kaplıyor sayıyor. Kapı
    // `hiredCount`a baksaydı bu ekran "yer var" der, kullanıcı geri alınamaz
    // sandığı düğmeye basar ve 409 yerdi — #80 tam olarak bunu reddediyor.
    renderReview({
      applicants: [applicant("a", "APPLIED"), applicant("b", "ACCEPTED")],
      headcount: 1,
      hiredCount: 0,
    });

    const open = within(screen.getAllByRole("article")[0]).getByRole("region", {
      name: "Başvuru kararı",
    });
    expect(within(open).getByRole("button", { name: "Kabul et" })).toBeDisabled();
    expect(within(open).getByText(/kontenjanını doldurdu/)).toBeInTheDocument();
    expect(within(open).getByRole("button", { name: "Reddi gönder" })).toBeEnabled();
  });

  it("ilk adayı kabul etmek ikinci kartın kabulünü de kapatır", async () => {
    // En olası senaryo: ilk adayı kabul et, hemen ikinciye bak. Sunucu listesi
    // tazelenene kadar ilk kart hâlâ `APPLIED` görünüyor; sayaç bu oturumun
    // kararlarını saymasaydı ikinci kart açık kalır ve 409'a yollardı.
    const user = userEvent.setup();
    const decisionAction = vi.fn(async (_state: unknown, formData: FormData) => ({
      status: "done" as const,
      applicationId: String(formData.get("applicationId")),
      outcome: { decision: "ACCEPTED" as const, assignmentId: null, messaging: null },
    }));
    renderReview({
      applicants: [applicant("a", "APPLIED"), applicant("b", "APPLIED")],
      headcount: 1,
      hiredCount: 0,
      decisionAction,
    });

    const second = within(screen.getAllByRole("article")[1]).getByRole("region", {
      name: "Başvuru kararı",
    });
    expect(within(second).getByRole("button", { name: "Kabul et" })).toBeEnabled();

    await user.click(
      within(screen.getAllByRole("article")[0]).getByRole("button", { name: "Kabul et" }),
    );
    await user.click(screen.getByRole("button", { name: "Kabulü onayla" }));

    await within(screen.getAllByRole("article")[0]).findByRole("status");
    expect(within(second).getByRole("button", { name: "Kabul et" })).toBeDisabled();
    expect(within(second).getByText(/kontenjanını doldurdu/)).toBeInTheDocument();
  });

  it("diyalog açıkken kontenjan dolarsa onay düğmesi de kapanır", async () => {
    // Kapı yalnız diyalog **açılırken** okunsaydı, açık bir diyalogda kapanan
    // kontenjan görülmezdi: liste diyalog açıkken tazelenebiliyor
    // (`revalidatePath`, ya da aynı şirketten başka bir yetkilinin kararı).
    const user = userEvent.setup();
    const common = {
      jobId,
      inTalentPool: [],
      assignments: [],
      headcount: 1,
      hiredCount: 0,
      dossierAction: vi.fn(idleAction),
      talentPoolAction: vi.fn(idleAction),
      conversationAction: vi.fn(idleAction),
      decisionAction: vi.fn(idleAction),
    };
    const { rerender } = render(
      <ApplicantReview {...common} applicants={[applicant("a", "APPLIED")]} />,
    );

    await user.click(screen.getByRole("button", { name: "Kabul et" }));
    expect(screen.getByRole("button", { name: "Kabulü onayla" })).toBeEnabled();

    rerender(
      <ApplicantReview
        {...common}
        applicants={[applicant("a", "APPLIED"), applicant("b", "ACCEPTED")]}
      />,
    );

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Kabulü onayla" })).toBeDisabled();
    expect(within(dialog).getByText(/kontenjanını doldurdu/)).toBeInTheDocument();
  });

  it("kabulden sonra kart kilitlenir ve atama görünümüne yol açılır", async () => {
    // Liste sunucudan bir kez indi: tazeleme dönene kadar kayıt hâlâ `APPLIED`
    // görünüyor. Kilit yalnız sunucu durumuna baksaydı kart o aralıkta ikinci
    // bir karara açık kalırdı. Atama kimliği de yalnız bu yanıtta var
    // (`JobApplicantDto` onu taşımıyor).
    const user = userEvent.setup();
    const assignmentId = "9f2c1a44-1b2c-4d3e-8f01-2a3b4c5d6e7f";
    const decisionAction = vi.fn(async () => ({
      status: "done" as const,
      applicationId: "a",
      outcome: { decision: "ACCEPTED" as const, assignmentId, messaging: null },
    }));
    renderReview({ decisionAction });

    await user.click(screen.getByRole("button", { name: "Kabul et" }));
    await user.click(screen.getByRole("button", { name: "Kabulü onayla" }));

    const decision = screen.getByRole("region", { name: "Başvuru kararı" });
    expect(await within(decision).findByRole("status")).toHaveTextContent(
      "tam iş adresi ona açıldı",
    );
    expect(within(decision).getByRole("link", { name: "Atamayı aç" })).toHaveAttribute(
      "href",
      `/isveren/atama/${assignmentId}`,
    );
    expect(within(decision).getByRole("button", { name: "Kabul et" })).toBeDisabled();
    expect(within(decision).getByLabelText("Red gerekçesi")).toBeDisabled();
  });

  it("atama kimliği gelmediğinde atama listesine düşer", async () => {
    const user = userEvent.setup();
    const decisionAction = vi.fn(async () => ({
      status: "done" as const,
      applicationId: "a",
      outcome: { decision: "ACCEPTED" as const, assignmentId: null, messaging: null },
    }));
    renderReview({ decisionAction });

    await user.click(screen.getByRole("button", { name: "Kabul et" }));
    await user.click(screen.getByRole("button", { name: "Kabulü onayla" }));

    expect(await screen.findByRole("link", { name: "Atamayı aç" })).toHaveAttribute(
      "href",
      "/isveren/atamalar",
    );
  });

  it("daha önce kabul edilmiş kartta da atama yolu ekranda kalır", async () => {
    // Karar sonrası geçiş yolu #80'in maddesi. Bağlantı yalnız aynı oturumda
    // çizilseydi, sayfa bir kez yenilendiğinde ekrandan tümüyle silinirdi:
    // atama kimliği yalnız kabul yanıtında var (`JobApplicantDto` onu
    // taşımıyor), o yüzden yenilenmiş kartta yedek atama listesi.
    renderReview({ applicants: [applicant("a", "ACCEPTED")] });

    const decision = screen.getByRole("region", { name: "Başvuru kararı" });
    expect(within(decision).getByRole("link", { name: "Atamayı aç" })).toHaveAttribute(
      "href",
      "/isveren/atamalar",
    );
  });

  it("atama listesi kimliği biliyorsa daha önce kabul edilmiş kart doğrudan atamaya gider", () => {
    // Mesaj kapısı için okunan atama listesi (#157) kimliği de biliyor;
    // atama listesine düşmek artık yalnız eşleşme olmadığında.
    const assignmentId = "6d2c0e58-2f0a-4b1e-9c3d-7a8b9c0d1e2f";
    renderReview({
      applicants: [applicant("a", "ACCEPTED")],
      assignments: [{ workerId: "a-user", assignmentId, messaging: null }],
    });

    expect(screen.getByRole("link", { name: "Atamayı aç" })).toHaveAttribute(
      "href",
      `/isveren/atama/${assignmentId}`,
    );
  });

  it("daha önce reddedilmiş kartta atama yolu çizmez", async () => {
    renderReview({ applicants: [applicant("a", "REJECTED")] });

    const decision = screen.getByRole("region", { name: "Başvuru kararı" });
    expect(within(decision).queryByRole("link", { name: "Atamayı aç" })).toBeNull();
  });

  it("sunucunun cevabı okunamadığında adres ifşasını iddia etmez", async () => {
    // Tanınmayan bir durumu kabule düşürmek, ADR-0003 uyarınca geri alınamaz
    // olan bir ifşanın **olduğunu iddia etmek** olurdu. Ekran adres gizliliği
    // hakkında yanlış konuşamaz: ne "adres açıldı" der, ne atama yolu çizer.
    const user = userEvent.setup();
    const decisionAction = vi.fn(async () => ({
      status: "done" as const,
      applicationId: "a",
      outcome: { decision: "UNKNOWN" as const, assignmentId: null, messaging: null },
    }));
    renderReview({ decisionAction });

    await user.click(screen.getByRole("button", { name: "Kabul et" }));
    await user.click(screen.getByRole("button", { name: "Kabulü onayla" }));

    const decision = screen.getByRole("region", { name: "Başvuru kararı" });
    expect(await within(decision).findByRole("status")).toHaveTextContent(/cevabı okunamadı/);
    expect(within(decision).queryByText(/tam iş adresi ona açıldı/)).toBeNull();
    expect(within(decision).queryByRole("link", { name: "Atamayı aç" })).toBeNull();
    // Kart yine de kilitli: 2xx döndü, ikinci bir karar geri alınamaz bir
    // sonuç doğurabilir.
    expect(within(decision).getByRole("button", { name: "Kabul et" })).toBeDisabled();
    expect(within(decision).getByText(/önce sayfayı yenile/)).toBeInTheDocument();
  });

  it("redden sonra atama bağlantısı çizilmez", async () => {
    const user = userEvent.setup();
    const decisionAction = vi.fn(async () => ({
      status: "done" as const,
      applicationId: "a",
      outcome: { decision: "REJECTED" as const, assignmentId: null, messaging: null },
    }));
    renderReview({ decisionAction });

    const card = screen.getByRole("article");
    await user.type(within(card).getByLabelText("Red gerekçesi"), "Tarih uymuyor.");
    await user.click(within(card).getByRole("button", { name: "Reddi gönder" }));

    const decision = screen.getByRole("region", { name: "Başvuru kararı" });
    expect(await within(decision).findByRole("status")).toHaveTextContent(
      "Başvuru reddedildi",
    );
    expect(within(decision).queryByRole("link", { name: "Atamayı aç" })).toBeNull();
  });

  it("ikinci karta karar vermek ilk kartın kilidini açmaz", async () => {
    // `useActionState` tek durum taşıyor: kararlar birikmezse ilk kartın
    // cevabı ikincisininkiyle ezilir ve o kart yeniden karara açılırdı.
    const user = userEvent.setup();
    const decisionAction = vi.fn(async (_state: unknown, formData: FormData) => ({
      status: "done" as const,
      applicationId: String(formData.get("applicationId")),
      outcome: { decision: "REJECTED" as const, assignmentId: null, messaging: null },
    }));
    renderReview({
      applicants: [applicant("a", "APPLIED"), applicant("b", "APPLIED")],
      decisionAction,
    });

    const [first, second] = screen.getAllByRole("article");
    await user.type(within(first).getByLabelText("Red gerekçesi"), "Tarih uymuyor.");
    await user.click(within(first).getByRole("button", { name: "Reddi gönder" }));
    await within(first).findByRole("status");
    await user.type(within(second).getByLabelText("Red gerekçesi"), "Uzaklık.");
    await user.click(within(second).getByRole("button", { name: "Reddi gönder" }));
    await within(second).findByRole("status");

    for (const card of screen.getAllByRole("article")) {
      expect(within(card).getByText(/Karar geri alınamıyor/)).toBeInTheDocument();
      expect(within(card).getByLabelText("Red gerekçesi")).toBeDisabled();
    }
  });

  it("kontenjan reddini mesaj metniyle değil errorCode ile seçer", async () => {
    // `AGENTS.md`: dallanma `errorCode` ile yapılır. Backend'in ham metni
    // ("Bu ilanın kontenjanı dolu.") burada hiç okunmuyor.
    const user = userEvent.setup();
    const decisionAction = vi.fn(async () => ({
      status: "error" as const,
      applicationId: "a",
      errorCode: "JOB_APPLICATION_JOB_HEADCOUNT_FULL",
      httpStatus: 409,
    }));
    renderReview({ decisionAction });

    await user.click(screen.getByRole("button", { name: "Kabul et" }));
    await user.click(screen.getByRole("button", { name: "Kabulü onayla" }));

    const card = screen.getByRole("article");
    expect(await within(card).findByRole("alert")).toHaveTextContent(
      "İlanın kontenjanı doldu; bu adayı kabul edemezsin.",
    );
  });

  it("yetkisiz kullanıcının 404'ünde başvurunun varlığını ele vermez", async () => {
    // Backend yetkisiz çağırana da, olmayan bir kayda da aynı kodu veriyor
    // (`ApplicationDecisionIT.anOutsiderCannotTellAnAnsweredApplicationFrom...`).
    // Ekran metni ikisini ayırsaydı, sunucunun kapattığı sızıntıyı istemci açardı.
    const user = userEvent.setup();
    const decisionAction = vi.fn(async () => ({
      status: "error" as const,
      applicationId: "a",
      errorCode: "JOB_APPLICATION_NOT_FOUND",
      httpStatus: 404,
    }));
    renderReview({ decisionAction });

    await user.click(screen.getByRole("button", { name: "Kabul et" }));
    await user.click(screen.getByRole("button", { name: "Kabulü onayla" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Bu başvuru bulunamadı ya da cevaplama yetkin yok.",
    );
  });

  it("kimliği listede olmayan karar reddini sessizce yutmaz", async () => {
    // Biçimi bozuk bir gövde `applicationId: ""` ile dönüyor ve hiçbir kartla
    // eşleşmiyor; uyarı kartın içine çizilseydi hiç görünmezdi.
    const user = userEvent.setup();
    const decisionAction = vi.fn(async () => ({
      status: "error" as const,
      applicationId: "",
      errorCode: "VALIDATION_FAILED",
      httpStatus: 400,
    }));
    renderReview({ decisionAction });

    await user.click(screen.getByRole("button", { name: "Kabul et" }));
    await user.click(screen.getByRole("button", { name: "Kabulü onayla" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Bu karar gönderilemedi; sayfayı yenileyip yeniden dene.",
    );
  });
});

function manyApplicants(count: number): readonly JobApplicant[] {
  return Array.from({ length: count }, (_, index) => ({
    ...applicant(String(index), "APPLIED"),
    applicant: {
      id: `${index}-user`,
      fullName: `Aday ${index}`,
      profilePictureUrl: null,
    },
  }));
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
      fullName: `Aday ${id}`,
      profilePictureUrl: null,
    },
  };
}

describe("aday kartının mesaj düğmesi (#157)", () => {
  const assignmentId = "6d2c0e58-2f0a-4b1e-9c3d-7a8b9c0d1e2f";

  it("karar bekleyen adayda mesaj düğmesi hiç yok", () => {
    // Atama yok, kapı da yok: backend ödeme öncesi konuşmayı 403 ile
    // kapatıyor ve düğme kullanıcıyı o redde yollardı.
    renderReview({ applicants: [applicant("a", "APPLIED")] });

    expect(screen.queryByRole("button", { name: "Mesaj gönder" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Ödemeyi tamamla" })).toBeNull();
  });

  it("ödemesi emanete düşmüş atamada mesaj düğmesini çizer ve eylemi ilan + işçiyle gönderir", async () => {
    const user = userEvent.setup();
    const { conversationAction } = renderReview({
      applicants: [applicant("a", "ACCEPTED")],
      assignments: [{
        workerId: "a-user",
        assignmentId,
        messaging: { available: true, reason: "AVAILABLE" },
      }],
    });

    await user.click(screen.getByRole("button", { name: "Mesaj gönder" }));

    expect(conversationAction).toHaveBeenCalledTimes(1);
    const formData = conversationAction.mock.calls[0][1];
    expect(formData.get("jobId")).toBe(jobId);
    expect(formData.get("workerId")).toBe("a-user");
  });

  it("ödeme bekleyen atamada düğme yerine açıklama ve ödeme yolu var", () => {
    renderReview({
      applicants: [applicant("a", "ACCEPTED")],
      assignments: [{
        workerId: "a-user",
        assignmentId,
        messaging: { available: false, reason: "PAYMENT_REQUIRED" },
      }],
    });

    expect(screen.queryByRole("button", { name: "Mesaj gönder" })).toBeNull();
    expect(screen.getByText(/işveren ödemeyi tamamladığında açılır/)).toBeVisible();
    expect(screen.getByRole("link", { name: "Ödemeyi tamamla" })).toHaveAttribute(
      "href",
      `/isveren/atama/${assignmentId}/odeme`,
    );
  });

  it("kapanmış sohbette yalnız kapandığını söyler", () => {
    renderReview({
      applicants: [applicant("a", "ACCEPTED")],
      assignments: [{
        workerId: "a-user",
        assignmentId,
        messaging: { available: false, reason: "CLOSED" },
      }],
    });

    expect(screen.queryByRole("button", { name: "Mesaj gönder" })).toBeNull();
    expect(screen.getByText(/^Sohbet kapandı\./)).toBeVisible();
    expect(screen.queryByRole("link", { name: "Ödemeyi tamamla" })).toBeNull();
  });

  it("kabulün hemen ardından, liste tazelenmeden ödeme yolunu gösterir", async () => {
    // Kabul yanıtı (`ShortJobAssignmentDto`) kapıyı ödemeye kapalı yazıyor;
    // kart bunu sunucu listesini beklemeden okur.
    const user = userEvent.setup();
    const decisionAction = vi.fn(async () => ({
      status: "done" as const,
      applicationId: "a",
      outcome: {
        decision: "ACCEPTED" as const,
        assignmentId,
        messaging: { available: false as const, reason: "PAYMENT_REQUIRED" as const },
      },
    }));
    renderReview({ decisionAction });
    expect(screen.queryByRole("link", { name: "Ödemeyi tamamla" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Kabul et" }));
    await user.click(screen.getByRole("button", { name: "Kabulü onayla" }));

    expect(await screen.findByRole("link", { name: "Ödemeyi tamamla" })).toHaveAttribute(
      "href",
      `/isveren/atama/${assignmentId}/odeme`,
    );
    expect(screen.queryByRole("button", { name: "Mesaj gönder" })).toBeNull();
  });

  it("konuşma açma reddini kataloğ metniyle gösterir", async () => {
    // Kapı bayatlamış: düğme çizildikten sonra ödeme iade edilmiş ya da
    // pencere kapanmış. Metin `src/lib/errors.ts` ile aynı.
    const user = userEvent.setup();
    const conversationAction = vi.fn(async () => ({
      status: "error" as const,
      errorCode: "MESSAGING_PAYMENT_REQUIRED",
      httpStatus: 403,
    }));
    renderReview({
      applicants: [applicant("a", "ACCEPTED")],
      assignments: [{
        workerId: "a-user",
        assignmentId,
        messaging: { available: true, reason: "AVAILABLE" },
      }],
      conversationAction,
    });

    await user.click(screen.getByRole("button", { name: "Mesaj gönder" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Mesajlaşma, işveren ödemeyi tamamladığında açılır.",
    );
  });
});

describe("aday kartının başvuru satırından gelen alanları (#166)", () => {
  const workerId = "6d2c0e58-2f0a-4b1e-9c3d-7a8b9c0d1e2f";
  const assignmentId = "7e3d1f69-3a1b-4c2f-8d4e-8b9c0d1e2f3a";

  it("yanıt zamanını ve red gerekçesini yalnız geldiklerinde yazar", () => {
    // `answeredDateTime` ve `rejectionReason` #282 ile geliyor; alan yoksa
    // satır yok — boş bir "Red tarihi" hücresi uydurulmuyor.
    const { unmount } = render(
      <ApplicantReview
        jobId={jobId}
        applicants={[{
          ...applicant("a", "REJECTED"),
          answeredAt: "2026-09-02T10:00:00Z",
          rejectionReason: "Deneyim şartı karşılanmıyor.",
        }]}
        inTalentPool={[]}
        assignments={[]}
        headcount={null}
        hiredCount={0}
        dossierAction={idleAction}
        talentPoolAction={idleAction}
        conversationAction={idleAction}
        decisionAction={idleAction}
      />,
    );

    expect(screen.getByText("Red tarihi")).toBeVisible();
    expect(screen.getByText("2 Eyl 2026 13:00")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Red gerekçesi" })).toBeVisible();
    expect(screen.getByText("Deneyim şartı karşılanmıyor.")).toBeVisible();
    unmount();

    renderReview({ applicants: [applicant("a", "REJECTED")] });
    expect(screen.queryByText("Red tarihi")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Red gerekçesi" })).toBeNull();
  });

  it("kabul edilmiş kartta atama bağlantısını başvuru satırındaki kimlikten kurar", () => {
    // Satır `assignmentId` taşıyorsa (#282) atama listesi taranmadan da
    // doğrudan atamaya gidiliyor.
    renderReview({ applicants: [{ ...applicant("a", "ACCEPTED"), assignmentId, answeredAt: "2026-09-02T10:00:00Z" }] });

    expect(screen.getByRole("link", { name: "Atamayı aç" })).toHaveAttribute(
      "href",
      `/isveren/atama/${assignmentId}`,
    );
    expect(screen.getByText("Yanıt tarihi")).toBeVisible();
  });

  it("adayın adını aday dosyası sayfasına bağlar; kimlik UUID değilse düz yazar", () => {
    renderReview({
      applicants: [
        {
          ...applicant("a", "APPLIED"),
          applicant: { id: workerId, fullName: "Ayşe Yılmaz", profilePictureUrl: null },
        },
        applicant("b", "APPLIED"),
      ],
    });

    expect(screen.getByRole("link", { name: "Ayşe Yılmaz" })).toHaveAttribute(
      "href",
      `/isveren/aday/${workerId}`,
    );
    expect(screen.queryByRole("link", { name: "Aday b" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Aday b" })).toBeVisible();
  });
});
