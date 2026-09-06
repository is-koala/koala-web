import { describe, expect, it } from "vitest";

import {
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
    });
  });

  it("bilinmeyen durumları güvenli değere indirir", () => {
    const result = projectWorkerAssignment(
      assignmentDto({ status: "PAUSED", paymentStatus: "CHARGEBACK" }),
    );

    expect(result.status).toBe("UNKNOWN");
    expect(result.paymentStatus).toBe("UNKNOWN");
  });
});
