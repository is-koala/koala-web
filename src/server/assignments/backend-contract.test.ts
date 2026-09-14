import { describe, expect, it } from "vitest";

import {
  projectReviewState,
  projectWorkerAssignment,
  type AssignmentDto,
} from "./backend-contract";

function assignmentDto(
  overrides: Partial<AssignmentDto> = {},
): AssignmentDto {
  return {
    id: "assignment-1",
    job: {
      id: "job-1",
      title: "Etkinlik görevlisi",
      position: "  Karşılama  ",
      category: { name: " Etkinlik " },
      companyName: " Koala Etkinlik ",
      cityName: " İstanbul ",
      districtName: " Kadıköy ",
      startDateTime: "2026-09-12T09:00:00",
      endDateTime: "2026-09-12T18:00:00",
    },
    status: "CONFIRMED",
    paymentStatus: "HELD_IN_ESCROW",
    workerPayout: 1200,
    pricing: { workerPayout: "1250.00", currency: "TRY" },
    ...overrides,
  };
}

describe("çalışan ataması backend sözleşmesi", () => {
  it("liste ve ayrıntı için ortak özet projeksiyonunu kurar", () => {
    expect(projectWorkerAssignment(assignmentDto())).toEqual({
      id: "assignment-1",
      jobId: "job-1",
      title: "Etkinlik görevlisi",
      position: "Karşılama",
      categoryName: "Etkinlik",
      companyName: "Koala Etkinlik",
      cityName: "İstanbul",
      districtName: "Kadıköy",
      startsAt: "2026-09-12T09:00:00",
      endsAt: "2026-09-12T18:00:00",
      status: "CONFIRMED",
      paymentStatus: "HELD_IN_ESCROW",
      workerPayout: "1250.00",
      currency: "TRY",
      employerType: "UNKNOWN",
      assignedAt: null,
    });
  });

  it("işveren tipini ve teklif anını taşır; tanınmayan tip rozet uydurmaz", () => {
    const result = projectWorkerAssignment(assignmentDto({
      job: { ...assignmentDto().job, employerType: "INDIVIDUAL" },
      assignmentDateTime: "2026-09-06T10:00:00Z",
    }));

    expect(result.employerType).toBe("INDIVIDUAL");
    expect(result.assignedAt).toBe("2026-09-06T10:00:00Z");
    expect(projectWorkerAssignment(assignmentDto({
      job: { ...assignmentDto().job, employerType: "GOVERNMENT" },
    })).employerType).toBe("UNKNOWN");
  });

  it("işçi görünümünde pricing null ise kazancı workerPayout'tan, para birimini yedekten okur (backend 0.9.25)", () => {
    // Backend #294: işçiye `pricing` ve `totalCharged` null gelir; tek fiyat
    // alanı `workerPayout` ve o bir sayı. Para birimi satırda yok, `TRY`
    // yedeği (`PricingManager.CURRENCY`) kazancı birimsiz bırakmaz.
    const result = projectWorkerAssignment(assignmentDto({
      workerPayout: 1250,
      pricing: null,
      ...({ totalCharged: null } as Partial<AssignmentDto>),
    }));

    expect(result.workerPayout).toBe("1250");
    expect(result.currency).toBe("TRY");
  });

  it("kazanç yoksa para birimi de uydurulmaz", () => {
    const result = projectWorkerAssignment(assignmentDto({ workerPayout: null, pricing: null }));

    expect(result.workerPayout).toBe("");
    expect(result.currency).toBe("");
  });

  it("eski sunucu işçiye fiyat dökümünü gönderse bile hizmet bedeli ve işveren toplamı sınırı geçmez", () => {
    // 0.9.25 öncesi backend işçi satırına da tam `PricingBreakdownDto` ve
    // `totalCharged` yazıyordu. Projeksiyon o alanları hiç okumaz; çalışan
    // yüzeyi hangi sunucuyla konuşursa konuşsun komisyon satırı çizemez.
    const legacy = assignmentDto({
      pricing: {
        workerPayout: "1250.00",
        currency: "TRY",
        ...({ serviceFeeRate: "0.20", serviceFeeAmount: "250.00", employerTotal: "1500.00" } as object),
      },
      ...({ totalCharged: "1500.00" } as Partial<AssignmentDto>),
    });

    const serialized = JSON.stringify(projectWorkerAssignment(legacy));

    expect(serialized).toContain("1250.00");
    expect(serialized).not.toMatch(/serviceFee|employerTotal|totalCharged|commission|1500\.00|(?<!\d)250\.00|0\.20/);
  });

  it("değerlendirme durumunu satırdan okur; eski sunucuda ikisi de null kalır", () => {
    expect(projectReviewState({
      myReview: { id: "r-1", rating: 4, comment: "  Dakikti ", createdAt: "2026-09-14T10:00:00Z" },
      counterpartyReviewed: true,
    })).toEqual({
      myReview: { rating: 4, comment: "Dakikti", createdAt: "2026-09-14T10:00:00Z" },
      counterpartyReviewed: true,
    });
    expect(projectReviewState({ myReview: null, counterpartyReviewed: false })).toEqual({
      myReview: null,
      counterpartyReviewed: false,
    });
    // Alan hiç yok (0.9.25 öncesi): form kapanmaz, rozet çizilmez.
    expect(projectReviewState({})).toEqual({ myReview: null, counterpartyReviewed: null });
    // Puansız nesne değerlendirme değildir; kimlik sınırı geçmez.
    const projected = projectReviewState({ myReview: { id: "r-2", comment: "x" } });
    expect(projected.myReview).toBeNull();
    expect(JSON.stringify(projectReviewState({
      myReview: { id: "r-1", rating: 5, comment: null, createdAt: null },
    }))).not.toContain("r-1");
  });

  it("bilinmeyen durumları güvenli değere indirir", () => {
    const result = projectWorkerAssignment(
      assignmentDto({ status: "PAUSED", paymentStatus: "CHARGEBACK" }),
    );

    expect(result.status).toBe("UNKNOWN");
    expect(result.paymentStatus).toBe("UNKNOWN");
  });
});
