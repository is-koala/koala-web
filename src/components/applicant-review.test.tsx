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

function renderReview(overrides: Partial<Parameters<typeof ApplicantReview>[0]> = {}) {
  const idle = async (state: unknown, formData: FormData) => {
    void state;
    void formData;
    return { status: "idle" } as const;
  };
  const dossierAction = vi.fn(idle);
  const talentPoolAction = vi.fn(idle);
  const conversationAction = vi.fn(idle);

  render(
    <ApplicantReview
      jobId={jobId}
      applicants={[applicant("a", "APPLIED")]}
      inTalentPool={[]}
      dossierAction={dossierAction}
      talentPoolAction={talentPoolAction}
      conversationAction={conversationAction}
      {...overrides}
    />,
  );

  return { dossierAction, talentPoolAction, conversationAction };
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
