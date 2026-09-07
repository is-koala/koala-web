import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { AssignmentResolution } from "@/assignments/resolution";

import { EmployerResolutionActions } from "./employer-resolution-actions";

const resolution: AssignmentResolution = {
  cancellationPreview: {
    feeRate: "0.075",
    feeAmount: "75.00",
    refundAmount: "925.00",
    noticeMinutes: 60,
    cancellableNow: true,
  },
  cancellation: null,
  disputes: [],
};

describe("işveren iptal ve uyuşmazlık işlemleri", () => {
  it("kesintiyi kesin tutarlarla ve iki dar komutla gösterir", () => {
    render(<EmployerResolutionActions
      assignmentStatus="CONFIRMED"
      paymentStatus="HELD_IN_ESCROW"
      resolution={resolution}
      currency="TRY"
      action={vi.fn()}
    />);

    fireEvent.click(screen.getByText("Atamayı iptal et", { selector: "summary" }));
    fireEvent.click(screen.getByText("Uyuşmazlık aç", { selector: "summary" }));
    expect(screen.getByText("75,00 ₺")).toBeVisible();
    expect(screen.getByText("925,00 ₺")).toBeVisible();
    expect(screen.getByRole("button", { name: "Atamayı iptal et" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Uyuşmazlık aç" })).toBeVisible();
  });

  it("önizlemenin dört alanını da yazar", () => {
    // Kabul kriteri dördünü birlikte istiyor: ücret oranı, ücret tutarı, iade
    // tutarı ve ihbar süresi. Oran ve süre eksik kalırsa kullanıcı kesintinin
    // neden o kadar olduğunu ve ne kadar beklerse değişeceğini okuyamaz.
    render(<EmployerResolutionActions
      assignmentStatus="CONFIRMED"
      paymentStatus="HELD_IN_ESCROW"
      resolution={resolution}
      currency="TRY"
      action={vi.fn()}
    />);

    fireEvent.click(screen.getByText("Atamayı iptal et", { selector: "summary" }));

    expect(screen.getByText("İptal kesintisi oranı")).toBeVisible();
    expect(screen.getByText("%7,5")).toBeVisible();
    expect(screen.getByText("Başlangıca kalan")).toBeVisible();
    expect(screen.getByText("1 sa")).toBeVisible();
  });

  it("iptal edilemeyen atamada iptal formunu hiç açmaz", () => {
    // `cancellableNow: false` sunucunun kesin cevabı; düğmeyi gösterip 409
    // yedirmek yerine form hiç çizilmiyor.
    render(<EmployerResolutionActions
      assignmentStatus="CONFIRMED"
      paymentStatus="HELD_IN_ESCROW"
      resolution={{
        ...resolution,
        cancellationPreview: { ...resolution.cancellationPreview!, cancellableNow: false },
      }}
      currency="TRY"
      action={vi.fn()}
    />);

    expect(screen.queryByRole("button", { name: "Atamayı iptal et" })).toBeNull();
  });

  it("açık uyuşmazlık varken iptal ve ikinci uyuşmazlık formlarını açmaz", () => {
    render(<EmployerResolutionActions
      assignmentStatus="CONFIRMED"
      paymentStatus="HELD_IN_ESCROW"
      resolution={{
        ...resolution,
        disputes: [{
          id: "dispute-1",
          status: "OPEN",
          reason: "Süre yanlış",
          resolution: null,
          resolutionNote: null,
          createdAt: "2026-09-06T10:00:00Z",
          resolvedAt: null,
        }],
      }}
      currency="TRY"
      action={vi.fn()}
    />);

    expect(screen.queryByRole("button", { name: "Atamayı iptal et" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Uyuşmazlık aç" })).toBeNull();
    expect(screen.getByText(/mevcut uyuşmazlık sonuçlanana kadar/i)).toBeVisible();
  });

  it("backend önizlemesi izin veriyorsa devam eden atamayı da iptal ettirir", () => {
    render(<EmployerResolutionActions
      assignmentStatus="IN_PROGRESS"
      paymentStatus="HELD_IN_ESCROW"
      resolution={resolution}
      currency="TRY"
      action={vi.fn()}
    />);

    fireEvent.click(screen.getByText("Atamayı iptal et", { selector: "summary" }));
    expect(screen.getByRole("button", { name: "Atamayı iptal et" })).toBeVisible();
  });

  it("yarışta açılan uyuşmazlığın parayı neden durdurduğunu açıklar", async () => {
    const user = userEvent.setup();
    const action = vi.fn(async () => ({
      status: "error" as const,
      errorCode: "DISPUTE_BLOCKS_RELEASE",
      httpStatus: 409,
    }));
    render(<EmployerResolutionActions
      assignmentStatus="CONFIRMED"
      paymentStatus="HELD_IN_ESCROW"
      resolution={resolution}
      currency="TRY"
      action={action}
    />);

    await user.click(screen.getByText("Atamayı iptal et", { selector: "summary" }));
    await user.type(screen.getByLabelText("İptal nedeni"), "Plan değişti");
    await user.click(screen.getByRole("button", { name: "Atamayı iptal et" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Açık uyuşmazlık sonuçlanana kadar atama iptal edilemez",
    );
  });
});
