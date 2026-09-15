import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { WorkDetail, WorkDetailActionResult } from "@/assignments/work-detail";
import type { AssignmentTransport } from "@/transport/contract";

import { WorkTransport } from "./work-transport";

const outboundId = "cccccccc-cccc-4ccc-8ccc-000000000001";
const otherOutboundId = "cccccccc-cccc-4ccc-8ccc-000000000002";
const stopIds = ["cccccccc-cccc-4ccc-8ccc-000000000011", "cccccccc-cccc-4ccc-8ccc-000000000012"];

/** Sunucunun işçi görünümü: plaka/şoför yalnız koltuk seçilen serviste dolu. */
function transport(overrides: Partial<AssignmentTransport> = {}): AssignmentTransport {
  return {
    outboundMethod: "SHUTTLE",
    returnMethod: "CASH_ALLOWANCE",
    allowanceAmount: "150.00",
    allowanceNote: "İş bitince",
    notes: "Servis 5 dk bekler.",
    shuttles: [
      {
        id: outboundId,
        direction: "OUTBOUND",
        name: "Anadolu yakası servisi",
        plate: "34 ABC 12",
        capacity: 2,
        seatsTaken: 1,
        driverName: "Mehmet Şoför",
        driverPhone: "0500 000 00 00",
        stops: [
          {
            id: stopIds[0],
            label: "Kadıköy İskele",
            scheduledAt: "2026-09-20T03:40:00Z",
            seatsTaken: 1,
            address: { displayAddress: "Rıhtım Caddesi No: 1, Caferağa, Kadıköy/İstanbul", position: { latitude: 40.9925, longitude: 29.0245 } },
          },
          {
            id: stopIds[1],
            label: "Bostancı",
            scheduledAt: "2026-09-20T04:00:00Z",
            seatsTaken: 0,
            address: { displayAddress: "Bağdat Caddesi No: 500, Suadiye, Kadıköy/İstanbul", position: { latitude: 40.9612, longitude: 29.0866 } },
          },
        ],
      },
      {
        id: otherOutboundId,
        direction: "OUTBOUND",
        name: "Avrupa yakası servisi",
        plate: null,
        capacity: 3,
        seatsTaken: 3,
        driverName: null,
        driverPhone: null,
        stops: [
          {
            id: "cccccccc-cccc-4ccc-8ccc-000000000021",
            label: "Taksim",
            scheduledAt: "2026-09-20T03:30:00Z",
            seatsTaken: 3,
            address: { displayAddress: "Taksim Meydanı, Beyoğlu/İstanbul", position: null },
          },
        ],
      },
    ],
    seats: [{ direction: "OUTBOUND", shuttleId: outboundId, stopId: stopIds[0] }],
    ...overrides,
  };
}

function detailWith(value: AssignmentTransport | null, status: WorkDetail["assignment"]["status"] = "CONFIRMED"): WorkDetail {
  return {
    observedAt: 0,
    assignment: {
      id: "3b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f6e",
      jobId: "9c1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f60",
      title: "Etkinlik görevlisi",
      position: null,
      categoryName: null,
      companyName: null,
      cityName: null,
      districtName: null,
      startsAt: "2026-09-20T09:00:00",
      endsAt: "2026-09-20T18:00:00",
      status,
      paymentStatus: "HELD_IN_ESCROW",
      workerPayout: "1250.00",
      currency: "TRY",
      employerType: "COMPANY",
      assignedAt: "2026-09-06T10:00:00Z",
      completedAt: null,
      appliedAt: null,
      acceptedAt: null,
      confirmedAt: null,
      paymentSecuredAt: null,
      messaging: null,
      myReview: null,
      counterpartyReviewed: null,
    },
    employer: null,
    description: null,
    duties: null,
    dressCode: null,
    fullAddress: null,
    additionalDirections: null,
    headcount: null,
    hiredCount: 0,
    createdAt: null,
    sessions: [],
    resolution: { cancellationPreview: null, cancellation: null, disputes: [] },
    transport: value,
  };
}

describe("çalışanın ulaşım kartı", () => {
  it("plan yoksa (eski sunucu / plansız ilan) kart yok", () => {
    render(<WorkTransport detail={detailWith(null)} pending={false} onCommand={vi.fn()} />);

    expect(screen.queryByTestId("work-transport")).toBeNull();
  });

  it("yön başına yöntemi, yol parası satırını, notu ve seçili durağın adresiyle yol tarifini çizer", () => {
    render(<WorkTransport detail={detailWith(transport())} pending={false} onCommand={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Ulaşım" })).toBeInTheDocument();
    expect(screen.getByText("Servis 5 dk bekler.")).toBeInTheDocument();
    const returnBlock = screen.getByTestId("work-transport-RETURN");
    expect(returnBlock).toHaveTextContent("Yol parası: 150,00 ₺");
    expect(returnBlock).toHaveTextContent("İş bitince");

    // Plaka ve şoför yalnız sunucunun doldurduğu (koltuk seçilen) serviste.
    const [mine, other] = screen.getAllByTestId("work-transport-shuttle");
    expect(mine).toHaveAttribute("data-selected", "true");
    expect(mine).toHaveTextContent("34 ABC 12");
    expect(mine).toHaveTextContent("Mehmet Şoför");
    expect(within(mine).getByRole("link", { name: "0500 000 00 00" })).toHaveAttribute("href", "tel:05000000000");
    expect(other).not.toHaveAttribute("data-selected");
    expect(other).not.toHaveTextContent("Plaka");
    expect(other).toHaveTextContent("dolu");

    // Seçili durak: rozet, adres ve yalnız o durakta yol tarifi.
    expect(mine).toHaveTextContent("Seçtiğin durak");
    expect(mine).toHaveTextContent("Rıhtım Caddesi No: 1");
    const directions = screen.getByRole("link", { name: "Yol tarifi al" });
    expect(directions).toHaveAttribute(
      "href",
      "https://www.google.com/maps/dir/?api=1&destination=40.9925%2C29.0245&travelmode=transit",
    );
    expect(directions).toHaveAttribute("rel", "noopener noreferrer");
    expect(mine).toHaveTextContent("20 Eyl 06:40");
  });

  it("başka bir durak seçilince koltuk komutu gider (200) ve seçim sunucu değerine döner", async () => {
    const user = userEvent.setup();
    const onCommand = vi.fn(async (): Promise<WorkDetailActionResult> => ({ status: "done", detail: detailWith(transport()) }));
    render(<WorkTransport detail={detailWith(transport())} pending={false} onCommand={onCommand} />);

    const save = screen.getByRole("button", { name: "Koltuğu değiştir" });
    expect(save).toBeDisabled();
    await user.click(screen.getByRole("radio", { name: /Bostancı/ }));
    expect(save).toBeEnabled();
    await user.click(save);

    expect(onCommand).toHaveBeenCalledWith({ type: "seat", shuttleId: outboundId, stopId: stopIds[1] });
  });

  it("dolu servisin durakları seçilemez; koltuğu olmayan işçiye seç düğmesi", async () => {
    const user = userEvent.setup();
    const onCommand = vi.fn(async (): Promise<WorkDetailActionResult> => ({
      status: "error",
      errorCode: "TRANSPORT_SHUTTLE_FULL",
      httpStatus: 409,
    }));
    // Koltuk yokken sunucu plaka/şoförü hiçbir serviste vermiyor; kart uydurmaz.
    const view = transport({ seats: [] });
    const noSeat = { ...view, shuttles: view.shuttles.map((shuttle) => ({ ...shuttle, plate: null, driverName: null, driverPhone: null })) };
    render(<WorkTransport detail={detailWith(noSeat)} pending={false} onCommand={onCommand} />);

    expect(screen.getByText("Henüz durak seçmedin; bineceğin durağı seç.")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Taksim/ })).toBeDisabled();
    expect(screen.queryByText("Plaka")).toBeNull();
    expect(screen.queryByRole("link", { name: "Yol tarifi al" })).toBeNull();

    await user.click(screen.getByRole("radio", { name: /Kadıköy İskele/ }));
    await user.click(screen.getByRole("button", { name: "Koltuğu seç" }));
    expect(onCommand).toHaveBeenCalledWith({ type: "seat", shuttleId: outboundId, stopId: stopIds[0] });
  });

  it("onay bekleyen atamada kart okunur ama seçim kapalı ve nedeni yazılı", () => {
    // Backend `TransportManager.SEAT_STATUSES = {CONFIRMED, IN_PROGRESS}`;
    // PENDING_CONFIRMATION'da PUT 409 `TRANSPORT_ASSIGNMENT_NOT_ACTIVE` verir.
    const view = transport({ seats: [] });
    const noSeat = { ...view, shuttles: view.shuttles.map((shuttle) => ({ ...shuttle, plate: null, driverName: null, driverPhone: null })) };
    render(<WorkTransport detail={detailWith(noSeat, "PENDING_CONFIRMATION")} pending={false} onCommand={vi.fn()} />);

    expect(screen.getByRole("status")).toHaveTextContent("Koltuk seçimi işveren onayladıktan sonra açılır.");
    expect(screen.queryByRole("radio")).toBeNull();
    expect(screen.queryByRole("button", { name: /Koltuğu/ })).toBeNull();
    expect(screen.queryByText("Henüz durak seçmedin; bineceğin durağı seç.")).toBeNull();
    expect(screen.getByText(/Kadıköy İskele/)).toBeInTheDocument();
  });

  it("tamamlanmış atamada kart salt okunur: seçim denetimi yok, bilgi duruyor", () => {
    render(<WorkTransport detail={detailWith(transport(), "COMPLETED")} pending={false} onCommand={vi.fn()} />);

    expect(screen.queryByRole("radio")).toBeNull();
    expect(screen.queryByRole("button", { name: /Koltuğu/ })).toBeNull();
    expect(screen.getByText("Seçtiğin durak")).toBeInTheDocument();
  });

  it("servis yöntemi seçilmiş ama servis girilmemişse bunu söyler; kendi imkânı düz yazılır", () => {
    render(
      <WorkTransport
        detail={detailWith(transport({ outboundMethod: "SHUTTLE", returnMethod: "SELF", shuttles: [], seats: [] }))}
        pending={false}
        onCommand={vi.fn()}
      />,
    );

    expect(screen.getByTestId("work-transport-OUTBOUND")).toHaveTextContent("Servis bilgisi henüz girilmedi.");
    expect(screen.getByTestId("work-transport-RETURN")).toHaveTextContent("Kendi imkânıyla");
  });
});
