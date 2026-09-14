import { render, screen, within } from "@testing-library/react";
import Link from "next/link";
import { describe, expect, it } from "vitest";

import { EmptyStateCard } from "./empty-state";
import { FactList, ListRow, ListRows } from "./list-row";
import { PageHeader } from "./page-header";
import { StatCard } from "./stat-card";
import {
  StatusBadge,
  applicationStatusTone,
  assignmentStatusTone,
  jobStatusTone,
  paymentStatusTone,
  payoutStatusTone,
} from "./status-badge";
import { LinkTabs } from "./tabs";

describe("tasarım sistemi bileşen seti", () => {
  it("durum tonları tasarım sisteminin anlamlarını izler", () => {
    // Ödeme Bekleniyor turuncu, tamamlanan yeşil, başvuru mor (readme.md).
    expect(paymentStatusTone("PENDING_COLLECTION")).toBe("warning");
    expect(assignmentStatusTone("COMPLETED")).toBe("success");
    expect(applicationStatusTone("APPLIED")).toBe("pending");
    expect(jobStatusTone("OPEN")).toBe("success");
    expect(jobStatusTone("CANCELLED")).toBe("danger");
    expect(payoutStatusTone("FAILED")).toBe("danger");
    // Tanınmayan durum nötr kalır; bir renk uydurulmaz.
    expect(jobStatusTone("UNKNOWN")).toBe("neutral");
    expect(assignmentStatusTone("UNKNOWN")).toBe("neutral");
  });

  it("rozet tonunu sınıf ve veri özniteliğiyle taşır", () => {
    render(<StatusBadge tone="warning">Ödeme bekleniyor</StatusBadge>);
    const badge = screen.getByText("Ödeme bekleniyor");
    expect(badge).toHaveClass("ui-badge", "ui-badge-warning");
    expect(badge).toHaveAttribute("data-tone", "warning");
  });

  it("sayfa başlığı üst etiketi, başlığı, girişi ve eylemleri çizer", () => {
    render(
      <PageHeader
        eyebrow="İşveren"
        title="İlanlarım"
        titleId="baslik"
        lede="Açtığın ilanlar."
        actions={<Link href="/isveren/ilan/yeni">Yeni ilan</Link>}
      />,
    );
    expect(screen.getByRole("heading", { level: 1, name: "İlanlarım" })).toHaveAttribute("id", "baslik");
    expect(screen.getByText("İşveren")).toHaveClass("eyebrow");
    expect(screen.getByText("Açtığın ilanlar.")).toHaveClass("lede");
    expect(screen.getByRole("link", { name: "Yeni ilan" })).toBeVisible();
  });

  it("bağlantı sekmeleri seçili olanı aria-current ile işaretler", () => {
    render(
      <LinkTabs
        label="Sıralama"
        items={[
          { href: "/a", label: "Önce en yeni", current: true, count: 3 },
          { href: "/b", label: "Başlığa göre", current: false },
        ]}
      />,
    );
    const nav = screen.getByRole("navigation", { name: "Sıralama" });
    expect(within(nav).getByRole("link", { name: "Önce en yeni3" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Başlığa göre" })).not.toHaveAttribute("aria-current");
  });

  it("boş durum maskotu dekor olarak taşır ve durum rolüyle okunur", () => {
    render(
      <EmptyStateCard title="Henüz ilan yok" message="İlan açtığında burada görünecek." mascot="employer">
        <Link href="/isveren/ilan/yeni">İlan aç</Link>
      </EmptyStateCard>,
    );
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Henüz ilan yok");
    expect(status.querySelector("img")).toHaveAttribute("alt", "");
    expect(within(status).getByRole("link", { name: "İlan aç" })).toBeVisible();
  });

  it("maskotsuz boş durum görsel çizmez", () => {
    render(<EmptyStateCard title="Eşleşen adres bulunamadı" />);
    expect(screen.getByRole("status").querySelector("img")).toBeNull();
  });

  it("özet kartı bağlantı verilince tümüyle tıklanabilir olur ve boş değeri tire ile yazar", () => {
    const { rerender } = render(
      <StatCard label="Açık ilan" value={2} icon="briefcase" href="/isveren/ilanlar" hint="ilk sayfa" />,
    );
    const link = screen.getByRole("link", { name: /Açık ilan/ });
    expect(link).toHaveAttribute("href", "/isveren/ilanlar");
    expect(link).toHaveTextContent("2");
    expect(link).toHaveTextContent("ilk sayfa");

    rerender(<StatCard label="Bekleyen ödeme" value={null} icon="wallet" />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("—")).toBeVisible();
  });

  it("liste satırı ve etiket/değer çiftleri boş çiftleri atlar", () => {
    render(
      <ListRows aria-label="Adaylar">
        <ListRow title="Elif Yıldız" meta="Barista" trailing={<span>Karar bekliyor</span>}>
          <FactList facts={[{ term: "Konum", detail: "Kadıköy" }, null, false]} />
        </ListRow>
      </ListRows>,
    );
    const list = screen.getByRole("list", { name: "Adaylar" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(1);
    expect(within(list).getByRole("term")).toHaveTextContent("Konum");
    expect(within(list).getByRole("definition")).toHaveTextContent("Kadıköy");
  });
});
