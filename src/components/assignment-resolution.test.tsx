import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { AssignmentResolution } from "@/assignments/resolution";

import { AssignmentResolutionPanel } from "./assignment-resolution";

const empty: AssignmentResolution = {
  cancellationPreview: null,
  cancellation: null,
  disputes: [],
};

describe("atama iptal, iade ve uyuşmazlık görünümü", () => {
  it("boş durumu açıkça gösterir", () => {
    render(<AssignmentResolutionPanel resolution={empty} currency="TRY" />);

    expect(screen.getByRole("heading", { name: "Henüz iptal veya uyuşmazlık kaydı yok" })).toBeVisible();
  });

  it("bekleyen iadeyi Türkçe yaşam döngüsüyle gösterir", () => {
    render(<AssignmentResolutionPanel currency="TRY" resolution={{
      ...empty,
      cancellation: {
        id: "cancellation-1",
        cancelledByParty: "EMPLOYER",
        reason: "Plan değişti",
        feeRate: "0.075",
        feeAmount: "75.00",
        refundAmount: "925.00",
        noticeMinutes: 60,
        cancelledAt: "2026-09-06T10:00:00Z",
        refundStatus: "PENDING",
        refundCompletedAt: null,
      },
    }} />);

    expect(screen.getByText("İade işleniyor")).toBeVisible();
    expect(screen.getByText("925,00 ₺")).toBeVisible();
    expect(screen.getByText("Plan değişti")).toBeVisible();
  });

  it("sıfır tutarlı iptali iade talebi gibi sunmaz", () => {
    render(<AssignmentResolutionPanel currency="TRY" resolution={{
      ...empty,
      cancellation: {
        id: "cancellation-2",
        cancelledByParty: "EMPLOYER",
        reason: "Ödeme alınmadı",
        feeRate: "0",
        feeAmount: "0.00",
        refundAmount: "0.00",
        noticeMinutes: 60,
        cancelledAt: "2026-09-06T10:00:00Z",
        refundStatus: null,
        refundCompletedAt: null,
      },
    }} />);

    expect(screen.getByText("İade gerekmiyor")).toBeVisible();
    expect(screen.queryByText("İade talebi alındı")).toBeNull();
  });

  it("açık uyuşmazlıkta emanetin donduğunu ve sonuçlanan kararı gösterir", () => {
    render(<AssignmentResolutionPanel currency="TRY" resolution={{
      ...empty,
      disputes: [
        {
          id: "open",
          status: "UNDER_REVIEW",
          reason: "Süre yanlış",
          resolution: null,
          resolutionNote: null,
          createdAt: "2026-09-06T10:00:00Z",
          resolvedAt: null,
        },
        {
          id: "resolved",
          status: "RESOLVED",
          reason: "Eksik ödeme",
          resolution: "REFUND_EMPLOYER",
          resolutionNote: "İşverene iade edildi.",
          createdAt: "2026-09-05T10:00:00Z",
          resolvedAt: "2026-09-06T12:00:00Z",
        },
      ],
    }} />);

    expect(screen.getByText(/emanetteki para donduruldu/i)).toBeVisible();
    expect(screen.getByText("İşverene iade")).toBeVisible();
    expect(screen.getByText("İşverene iade edildi.")).toBeVisible();
  });
});
