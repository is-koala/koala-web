import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type {
  AssignmentResponseAction,
  WorkerAssignment,
  WorkerAssignmentPage,
} from "@/assignments/contract";

import { AssignmentList } from "./assignment-list";

const baseAssignment: WorkerAssignment = {
  id: "3b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f6e",
  jobId: "9c1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f60",
  title: "Etkinlik görevlisi",
  position: "Karşılama",
  categoryName: "Etkinlik",
  companyName: "Koala Etkinlik",
  cityName: "İstanbul",
  districtName: "Kadıköy",
  startsAt: "2026-09-12T09:00:00",
  endsAt: "2026-09-12T18:00:00",
  status: "PENDING_CONFIRMATION",
  paymentStatus: "PENDING_COLLECTION",
  workerPayout: "1250.00",
  currency: "TRY",
};

function pageOf(...content: WorkerAssignment[]): WorkerAssignmentPage {
  return {
    content,
    page: 0,
    size: 20,
    totalElements: content.length,
    totalPages: content.length === 0 ? 0 : 1,
    first: true,
    last: true,
  };
}

const unusedAction: AssignmentResponseAction = async () => ({ status: "idle" });
const detailAction = vi.fn(async () => ({
  status: "done" as const,
  fullAddress: "Caferağa Mahallesi, Moda Caddesi No: 12/4, Kadıköy, İstanbul",
}));

describe("çalışan atama listesi", () => {
  it("onay bekleyen işi belirgin bir bölgede tarih, ücret ve kabul/ret ile gösterir", () => {
    render(<AssignmentList
      initialPage={pageOf(baseAssignment)}
      respondAction={unusedAction}
      acceptanceAction={detailAction}
    />);

    const pending = screen.getByRole("region", { name: "Onayını bekleyen işler" });
    expect(within(pending).getByText("Etkinlik görevlisi")).toBeVisible();
    expect(within(pending).getByText("12 Eylül 2026, 09:00–18:00")).toBeVisible();
    expect(within(pending).getByText("Kadıköy, İstanbul")).toBeVisible();
    expect(within(pending).getByText("₺1.250,00")).toBeVisible();
    expect(within(pending).getByRole("button", { name: "Kabul et" })).toBeVisible();
    expect(within(pending).getByRole("button", { name: "Reddet" })).toBeVisible();
    expect(screen.queryByText(/tam adres/i)).toBeNull();
  });

  it("kabul edilmiş işte ödeme ön koşulunu açıklar ve cevap düğmesi çizmez", () => {
    render(
      <AssignmentList
        initialPage={pageOf({ ...baseAssignment, status: "CONFIRMED" })}
        respondAction={unusedAction}
        acceptanceAction={detailAction}
      />,
    );

    expect(screen.getByText("Onaylandı")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Atamalar" })).toBeVisible();
    expect(screen.getByText("İşverenin ödemesi bekleniyor.")).toBeVisible();
    expect(screen.getByRole("link", { name: "İş ayrıntısını aç" })).toHaveAttribute(
      "href",
      `/panel/is/${baseAssignment.id}`,
    );
    expect(screen.queryByRole("button", { name: "Kabul et" })).toBeNull();
  });

  it("genel iade durumunu tamamlandı diye sunmaz", () => {
    render(
      <AssignmentList
        initialPage={pageOf({
          ...baseAssignment,
          status: "CANCELLED",
          paymentStatus: "REFUNDED",
        })}
        respondAction={unusedAction}
        acceptanceAction={detailAction}
      />,
    );

    expect(screen.getByText("İade sürecinde")).toBeVisible();
    expect(screen.queryByText("Ödeme iade edildi")).toBeNull();
  });

  it("reddedilmiş işi durumuyla listeler ve yeniden cevap sunmaz", () => {
    render(
      <AssignmentList
        initialPage={pageOf({ ...baseAssignment, status: "REJECTED" })}
        respondAction={unusedAction}
        acceptanceAction={detailAction}
      />,
    );

    expect(screen.getByText("Reddedildi")).toBeVisible();
    expect(screen.queryByRole("link", { name: "İş ayrıntısını aç" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Reddet" })).toBeNull();
  });

  it("action'ın yeniden okuduğu listeyi kabulden sonra ekrana geçirir", async () => {
    const user = userEvent.setup();
    const respondAction = vi.fn<AssignmentResponseAction>(async () => ({
      status: "done",
      assignments: pageOf({ ...baseAssignment, status: "CONFIRMED" }),
    }));
    render(<AssignmentList
      initialPage={pageOf(baseAssignment)}
      respondAction={respondAction}
      acceptanceAction={detailAction}
    />);

    await user.click(screen.getByRole("button", { name: "Kabul et" }));
    expect(await screen.findByRole("dialog", { name: "İşi kabul et" })).toHaveTextContent(
      "Caferağa Mahallesi, Moda Caddesi No: 12/4, Kadıköy, İstanbul",
    );
    expect(respondAction).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Kabulü onayla" }));

    expect(await screen.findByText("Onaylandı")).toBeVisible();
    expect(screen.getByText("İşverenin ödemesi bekleniyor.")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Kabul et" })).toBeNull();
  });

  it("mutation sonrası boş sayfayı boş durumla gösterir", async () => {
    const user = userEvent.setup();
    const respondAction = vi.fn<AssignmentResponseAction>(async () => ({
      status: "done",
      assignments: pageOf(),
    }));
    render(<AssignmentList
      initialPage={pageOf(baseAssignment)}
      respondAction={respondAction}
      acceptanceAction={detailAction}
    />);

    await user.click(screen.getByRole("button", { name: "Reddet" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Henüz atama yok");
  });

  it("sonraki sayfayı action üzerinden erişilebilir kılar", async () => {
    const user = userEvent.setup();
    const nextPage = {
      ...pageOf({ ...baseAssignment, id: "4b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f6e", title: "İkinci sayfa" }),
      page: 1,
      first: false,
    };
    const firstPage = { ...pageOf(baseAssignment), totalPages: 2, last: false };
    const respondAction = vi.fn<AssignmentResponseAction>(async () => ({
      status: "done",
      assignments: nextPage,
    }));
    render(<AssignmentList
      initialPage={firstPage}
      respondAction={respondAction}
      acceptanceAction={detailAction}
    />);

    await user.click(screen.getByRole("button", { name: "Sonraki sayfa" }));

    expect(await screen.findByText("İkinci sayfa")).toBeVisible();
    const submitted = respondAction.mock.calls[0][1];
    expect(submitted.get("decision")).toBe("page");
    expect(submitted.get("targetPage")).toBe("1");
  });
});
