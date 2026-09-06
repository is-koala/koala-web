import { describe, expect, it } from "vitest";

import type { AssignmentResolution } from "./resolution";
import { canCancelAssignment, canOpenAssignmentDispute } from "./resolution";

const activeDisputeResolution: AssignmentResolution = {
  cancellationPreview: {
    feeRate: "0.075",
    feeAmount: "75.00",
    refundAmount: "925.00",
    noticeMinutes: 60,
    cancellableNow: true,
  },
  cancellation: null,
  disputes: [{
    id: "dispute-1",
    status: "OPEN",
    reason: "Çalışma süresi yanlış",
    resolution: null,
    resolutionNote: null,
    createdAt: "2026-09-06T10:00:00Z",
    resolvedAt: null,
  }],
};

describe("atama sonuçlandırma kapıları", () => {
  it("açık uyuşmazlık varken backend önizlemesi izin verse de iptali kapatır", () => {
    expect(canCancelAssignment({
      assignmentStatus: "CONFIRMED",
      resolution: activeDisputeResolution,
    })).toBe(false);
  });

  it("sıfır iadeyle iptal edilmiş ve parası emanette kalan atamada uyuşmazlığı açar", () => {
    const cancelledResolution: AssignmentResolution = {
      cancellationPreview: null,
      cancellation: {
        id: "cancellation-1",
        cancelledByParty: "EMPLOYER",
        reason: "İş başladıktan sonra iptal edildi",
        feeRate: "1.00",
        feeAmount: "1000.00",
        refundAmount: "0.00",
        noticeMinutes: -30,
        cancelledAt: "2026-09-06T10:00:00Z",
        refundStatus: null,
        refundCompletedAt: null,
      },
      disputes: [],
    };

    expect(canOpenAssignmentDispute({
      assignmentStatus: "CANCELLED",
      paymentStatus: "HELD_IN_ESCROW",
      resolution: cancelledResolution,
    })).toBe(true);
  });
});
