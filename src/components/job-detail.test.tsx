import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { jobDetailFixture } from "../../tests/support/job-detail";

import { JobDetailView } from "./job-detail";

const job = jobDetailFixture();

describe("ilan ayrıntısı", () => {
  it("sunucudan gelen ilanı, konumu ve fiyat anlık görüntüsünü gösterir", () => {
    render(<JobDetailView job={job} applyAction={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Etkinlik görevlisi" })).toBeVisible();
    expect(screen.getByText("12 Eylül 2026, 09:00–18:00")).toBeVisible();
    expect(screen.getByText("günlük 1.250,00 ₺")).toBeVisible();
    expect(screen.getByText("Kadıköy, İstanbul")).toBeVisible();
    expect(screen.getByText("Yaklaşık konum")).toBeVisible();
    expect(screen.getByText("Sigorta gerekiyor")).toBeVisible();
    expect(screen.getByText("Deneyim şartı yok")).toBeVisible();
    expect(screen.getByText("Yaş aralığı: 18–45")).toBeVisible();
    expect(screen.getByText("Kıyafet: Siyah kıyafet")).toBeVisible();
    expect(screen.getByText("Bilet kontrolü ve yönlendirme")).toBeVisible();
  });

  it("işverenin toplamı ile çalışanın kazancını ayrı satırlarda gösterir", () => {
    /*
     * ADR-0002: %7,5 hizmet bedeli çalışan ödemesinin **üstüne** ekleniyor.
     * Üç satırın da ayrı ayrı ölçülmesi bir ayrıntı değil — ikisi tek bir
     * "ücret" satırında birleştirilse ekran, iş arayana cebine girmeyecek bir
     * tutarı kazanç diye gösterirdi.
     */
    render(<JobDetailView job={job} applyAction={vi.fn()} />);
    const breakdown = screen.getByLabelText("Ücret dökümü");

    expect(breakdown).toHaveTextContent("Çalışan ücreti");
    expect(breakdown).toHaveTextContent("1.250,00 ₺");
    expect(breakdown).toHaveTextContent("Koala hizmet bedeli");
    expect(breakdown).toHaveTextContent("93,75 ₺");
    expect(breakdown).toHaveTextContent("İşveren toplamı");
    expect(breakdown).toHaveTextContent("1.343,75 ₺");
  });

  it("fiyat anlık görüntüsü olmayan ilanda döküm bölümünü hiç açmaz", () => {
    render(<JobDetailView job={jobDetailFixture({ pricing: null })} applyAction={vi.fn()} />);

    expect(screen.queryByLabelText("Ücret dökümü")).toBeNull();
    expect(screen.getByText("Kazanç bilgisi paylaşılmadı")).toBeVisible();
  });

  it("açık pozisyon sayısını dolan kontenjanı düşerek gösterir", () => {
    render(<JobDetailView job={job} applyAction={vi.fn()} />);

    expect(screen.getByText("3 / 4 kişi")).toBeVisible();
  });

  it("sınırsız kişilik ilanda açık pozisyon satırını hiç çizmez", () => {
    render(<JobDetailView job={jobDetailFixture({ headcount: null })} applyAction={vi.fn()} />);

    expect(screen.queryByText("Açık pozisyon")).toBeNull();
  });

  it("şirket ilanında logo ve şirket adını çizer", () => {
    render(
      <JobDetailView
        job={jobDetailFixture({
          companyName: "Koala Etkinlik",
          companyLogoUrl: "https://cdn.example.com/logo.png",
        })}
        applyAction={vi.fn()}
      />,
    );

    expect(screen.getByText("Koala Etkinlik")).toBeVisible();
    expect(screen.getByText("Şirket")).toBeVisible();
  });

  it("galeri görsellerini altyazılarıyla çizer", () => {
    render(
      <JobDetailView
        job={jobDetailFixture({
          images: [{ url: "https://cdn.example.com/1.jpg", caption: "Sahne alanı", cover: true }],
        })}
        applyAction={vi.fn()}
      />,
    );

    expect(screen.getByAltText("Sahne alanı")).toBeVisible();
  });

  it("kapatılmış ilanda başvuru formunu hiç çizmez", () => {
    render(<JobDetailView job={jobDetailFixture({ status: "CLOSED" })} applyAction={vi.fn()} />);

    expect(screen.queryByRole("button", { name: "Başvuruyu gönder" })).toBeNull();
    expect(screen.getByText("Bu ilan kapatıldı ve yeni başvuru almıyor.")).toBeVisible();
  });

  it("başvuruya kapalı ilandan benzer ilan listesine gerçek bağlantı verir", () => {
    render(<JobDetailView job={jobDetailFixture({ status: "CLOSED" })} applyAction={vi.fn()} />);

    expect(screen.getByRole("link", { name: "Benzer ilanları gör" })).toHaveAttribute(
      "href",
      "/is-ilanlari",
    );
  });

  it("iptal edilmiş ilanda başvuru formunu hiç çizmez", () => {
    render(<JobDetailView job={jobDetailFixture({ status: "CANCELLED" })} applyAction={vi.fn()} />);

    expect(screen.queryByRole("button", { name: "Başvuruyu gönder" })).toBeNull();
    expect(screen.getByText("Bu ilan iptal edildi ve yeni başvuru almıyor.")).toBeVisible();
  });

  it("durumu OPEN kalsa bile başvuru kabul etmeyen ilanda formu hiç çizmez", () => {
    render(
      <JobDetailView
        job={jobDetailFixture({ status: "OPEN", acceptingApplications: false })}
        applyAction={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "Başvuruyu gönder" })).toBeNull();
    expect(screen.getByText("Bu ilanın süresi doldu ve yeni başvuru almıyor.")).toBeVisible();
  });

  it("yayındaki ilanda başvuru formunu çizer", () => {
    render(<JobDetailView job={job} applyAction={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Başvuruyu gönder" })).toBeVisible();
  });

  it("backend konum vermediyse gizli adres üretmez", () => {
    render(
      <JobDetailView
        job={jobDetailFixture({ cityName: null, districtName: null })}
        applyAction={vi.fn()}
      />,
    );

    expect(screen.getByText("Konum bilgisi paylaşılmadı")).toBeVisible();
    expect(screen.queryByText("Kadıköy, İstanbul")).toBeNull();
  });
});
