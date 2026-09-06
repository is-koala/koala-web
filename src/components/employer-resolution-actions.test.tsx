import { fireEvent, render, screen } from "@testing-library/react";
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
});
