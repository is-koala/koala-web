import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { PublicTransportSummary } from "@/transport/contract";

import { JobTransportSummary } from "./job-transport-summary";

const summary: PublicTransportSummary = {
  outboundMethod: "SHUTTLE",
  returnMethod: "CASH_ALLOWANCE",
  allowanceAmount: "150.00",
  shuttleCount: 1,
  shuttles: [
    {
      direction: "OUTBOUND",
      name: "Anadolu yakası servisi",
      stops: [
        { districtName: "Kadıköy", neighborhood: "Caferağa", scheduledAt: "2026-09-20T03:40:00Z" },
        { districtName: "Kadıköy", neighborhood: null, scheduledAt: "2026-09-20T04:00:00Z" },
      ],
    },
  ],
};

describe("herkese açık ulaşım özeti", () => {
  it("plan yoksa bölüm yok", () => {
    const { container } = render(<JobTransportSummary transport={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("yöntemleri, yol parasını, servisi ve durakları ilçe/semt + saat düzeyinde yazar", () => {
    render(<JobTransportSummary transport={summary} />);

    const section = screen.getByRole("region", { name: "Ulaşım" });
    expect(section).toHaveTextContent("GidişServis (1 servis)");
    expect(section).toHaveTextContent("DönüşYol parası: 150,00 ₺");
    expect(section).toHaveTextContent("Anadolu yakası servisi");
    expect(section).toHaveTextContent("Kadıköy · Caferağa · 20 Eyl 06:40");
    expect(section).toHaveTextContent("Kadıköy · 20 Eyl 07:00");
    expect(section).toHaveTextContent("yalnızca işe alınan çalışanla paylaşılır");
  });

  it("okunamayan yöntemde nötr etiket; servis sayısı yönün servislerinden", () => {
    render(
      <JobTransportSummary
        transport={{ ...summary, outboundMethod: "UNKNOWN", returnMethod: "SHUTTLE", allowanceAmount: null, shuttles: [] }}
      />,
    );

    const section = screen.getByRole("region", { name: "Ulaşım" });
    expect(section).toHaveTextContent("GidişBelirtilmedi");
    expect(section).toHaveTextContent("DönüşServis");
    expect(section).not.toHaveTextContent("0 servis");
  });

  it("tipte olmayan alanlar ekrana çıkamaz: plaka, şoför, tam adres taşıyan bir nesne verilse de yazılmaz", () => {
    // Modelin gizlilik sınırı `PublicTransportSummary` tipinde; bu test tel
    // biçiminden sızan fazladan alanların bileşende okunmadığını ölçüyor.
    const leaky = {
      ...summary,
      shuttles: [
        {
          ...summary.shuttles[0],
          plate: "34 ABC 12",
          driverName: "Mehmet",
          driverPhone: "0500",
          stops: [{ ...summary.shuttles[0].stops[0], address: { displayAddress: "Rıhtım Caddesi No: 1" } }],
        },
      ],
    } as unknown as PublicTransportSummary;
    const { container } = render(<JobTransportSummary transport={leaky} />);

    expect(container.textContent).not.toMatch(/34 ABC 12|Mehmet|0500|Rıhtım/);
  });
});
