import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type {
  ApplicationMutationAction,
  WorkerApplication,
  WorkerApplicationPage,
} from "@/applications/contract";

import { ApplicationList } from "./application-list";

const application: WorkerApplication = {
  id: "3b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f6e",
  jobId: "9c1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f60",
  title: "Etkinlik görevlisi",
  position: "Karşılama",
  companyName: "Koala Etkinlik",
  cityName: "İstanbul",
  districtName: "Kadıköy",
  startsAt: "2026-09-12T09:00:00",
  coverImageUrl: "https://cdn.example.test/jobs/cover.webp",
  status: "APPLIED",
  notes: "Hafta sonu uygunum.",
  rejectionReason: null,
  appliedAt: "2026-09-06T10:00:00Z",
  answeredAt: null,
  assignmentId: null,
};

function pageOf(...content: WorkerApplication[]): WorkerApplicationPage {
  return {
    content,
    page: 0,
    size: 20,
    totalElements: content.length,
    totalPages: content.length ? 1 : 0,
    first: true,
    last: true,
  };
}

const idleAction: ApplicationMutationAction = async () => ({ status: "idle" });

describe("başvurularım listesi", () => {
  it("durum, ilan özeti, kapak, tarih ve notu gösterir", () => {
    render(
      <ApplicationList initialPage={pageOf(application)} filter="ALL" action={idleAction} />,
    );

    const card = screen.getByRole("article", { name: "Etkinlik görevlisi" });
    expect(within(card).getByText("Başvuru gönderildi")).toBeVisible();
    expect(within(card).getByRole("img", { name: "Etkinlik görevlisi kapak görseli" })).toBeVisible();
    expect(within(card).getByText("Kadıköy, İstanbul")).toBeVisible();
    expect(within(card).getByText("12 Eylül 2026")).toBeVisible();
    // Tarih metni `@/lib/dates` ile paylaşılıyor: üç ekranın da aynı anı aynı
    // yazması, biçimin tek yerden geldiğinin ekrandaki kanıtı.
    expect(within(card).getByText("6 Eyl 2026 13:00")).toBeVisible();
    expect(within(card).getByText("Hafta sonu uygunum.")).toBeVisible();
  });

  it("yalnız APPLIED başvuruda geri çekme onayı açar ve sonra sunucu sonucunu çizer", async () => {
    const user = userEvent.setup();
    const action = vi.fn<ApplicationMutationAction>(async () => ({
      status: "done",
      applications: pageOf({ ...application, status: "WITHDRAWN" }),
    }));
    render(<ApplicationList initialPage={pageOf(application)} filter="APPLIED" action={action} />);

    await user.click(screen.getByRole("button", { name: "Başvuruyu geri çek" }));
    const dialog = screen.getByRole("dialog", { name: "Başvuruyu geri çek" });
    expect(dialog).toHaveTextContent("Etkinlik görevlisi");
    expect(action).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "Geri çekmeyi onayla" }));

    expect(await screen.findByText("Geri çekildi")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Başvuruyu geri çek" })).toBeNull();
    const submitted = action.mock.calls[0][1];
    expect(submitted.get("filter")).toBe("APPLIED");
    expect(submitted.get("page")).toBe("0");
  });

  it("filtre değişince önceki mutation state'ini bırakıp yeni server sayfasını gösterir", async () => {
    const user = userEvent.setup();
    const action = vi.fn<ApplicationMutationAction>(async () => ({
      status: "done",
      applications: pageOf({ ...application, status: "WITHDRAWN" }),
    }));
    const { rerender } = render(
      <ApplicationList initialPage={pageOf(application)} filter="APPLIED" action={action} />,
    );

    await user.click(screen.getByRole("button", { name: "Başvuruyu geri çek" }));
    await user.click(screen.getByRole("button", { name: "Geri çekmeyi onayla" }));
    expect(await screen.findByText("Geri çekildi")).toBeVisible();

    rerender(
      <ApplicationList
        initialPage={pageOf({
          ...application,
          title: "Yeni sunucu sonucu",
          status: "REJECTED",
          rejectionReason: "Kontenjan doldu.",
        })}
        filter="REJECTED"
        action={action}
      />,
    );

    expect(screen.getByText("Yeni sunucu sonucu")).toBeVisible();
    expect(screen.getByText("Reddedildi")).toBeVisible();
    expect(screen.queryByText("Geri çekildi")).toBeNull();
  });

  it("reddedilen başvurunun gerekçesini gösterir ve geri çekme sunmaz", () => {
    render(
      <ApplicationList
        initialPage={pageOf({
          ...application,
          status: "REJECTED",
          rejectionReason: "Kontenjan doldu.",
        })}
        filter="REJECTED"
        action={idleAction}
      />,
    );

    expect(screen.getByText("Kontenjan doldu.")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Başvuruyu geri çek" })).toBeNull();
  });

  it("kabul edilen başvurunun atamasını görünür ve erişilebilir kılar", () => {
    render(
      <ApplicationList
        initialPage={pageOf({
          ...application,
          status: "ACCEPTED",
          assignmentId: "4b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f6e",
        })}
        filter="ACCEPTED"
        action={idleAction}
      />,
    );

    expect(screen.getByText(/4b1f0d24/)).toBeVisible();
    expect(screen.getByRole("link", { name: "Atamayı gör" })).toHaveAttribute("href", "/panel/islerim");
  });

  it("filtreleri ve sayfalamayı URL'de birlikte korur", () => {
    render(
      <ApplicationList
        initialPage={{ ...pageOf(application), page: 1, totalPages: 3, first: false, last: false }}
        filter="REJECTED"
        action={idleAction}
      />,
    );

    expect(screen.getByRole("link", { name: "Sonraki sayfa" })).toHaveAttribute(
      "href",
      "/panel/basvurularim?status=REJECTED&page=2",
    );
    expect(screen.getByRole("link", { name: "Önceki sayfa" })).toHaveAttribute(
      "href",
      "/panel/basvurularim?status=REJECTED&page=0",
    );
    expect(screen.getByRole("link", { name: "Kabul edilenler" })).toHaveAttribute(
      "href",
      "/panel/basvurularim?status=ACCEPTED&page=0",
    );
  });

  it("gerçek boşluk ile filtre sonucundaki boşluğu ayırır", () => {
    const { rerender } = render(
      <ApplicationList initialPage={pageOf()} filter="ALL" action={idleAction} />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Henüz başvuru yok");

    rerender(<ApplicationList initialPage={pageOf()} filter="REJECTED" action={idleAction} />);
    expect(screen.getByRole("status")).toHaveTextContent("Bu filtrede başvuru yok");
  });

  it("görsel alanına güvenilmeyen bir URL yazmaz", () => {
    render(
      <ApplicationList
        initialPage={pageOf({ ...application, coverImageUrl: "javascript:alert(1)" })}
        filter="ALL"
        action={idleAction}
      />,
    );

    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("İlan görseli yok")).toBeVisible();
  });
});
