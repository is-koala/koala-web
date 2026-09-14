import { describe, expect, it } from "vitest";

import type { JobApplicant } from "@/applications/employer-review";
import type { EmployerJob, EmployerJobPage } from "@/jobs/employer-jobs";
import type { EmployerAssignment, EmployerAssignmentPage } from "@/payments/contract";

import {
  employerSummary,
  jobsWorthReadingApplicants,
  recentApplications,
} from "./employer-dashboard";

function job(overrides: Partial<EmployerJob>): EmployerJob {
  return {
    id: "job",
    title: "İlan",
    position: null,
    companyName: null,
    employerType: "INDIVIDUAL",
    status: "OPEN",
    salaryType: "DAILY",
    workerPayout: null,
    currency: null,
    startsAt: "2026-09-20T09:00:00",
    endsAt: "2026-09-20T17:00:00",
    cityName: null,
    districtName: null,
    insuranceRequired: false,
    applicationCount: 0,
    hiredCount: 0,
    headcount: null,
    ...overrides,
  } as EmployerJob;
}

function page<T>(content: readonly T[], extra: Partial<EmployerJobPage> = {}) {
  return {
    content,
    page: 0,
    size: 20,
    totalElements: content.length,
    totalPages: 1,
    first: true,
    last: true,
    ...extra,
  } as unknown as EmployerJobPage & EmployerAssignmentPage;
}

function assignment(overrides: Partial<EmployerAssignment>): EmployerAssignment {
  return {
    id: "a",
    jobId: "job",
    title: "İlan",
    position: null,
    employerType: "INDIVIDUAL",
    workerId: "w",
    workerName: "Ayşe",
    cityName: null,
    districtName: null,
    startsAt: "2026-09-20T09:00:00",
    endsAt: "2026-09-20T17:00:00",
    status: "CONFIRMED",
    paymentStatus: "PENDING_COLLECTION",
    pricing: null,
    assignedAt: null,
    completedAt: null,
    workHours: 8,
    messaging: null,
    myReview: null,
    counterpartyReviewed: null,
    ...overrides,
  } as EmployerAssignment;
}

function applicant(id: string, appliedAt: string): JobApplicant {
  return {
    id,
    status: "APPLIED",
    appliedAt,
    answeredAt: null,
    rejectionReason: null,
    assignmentId: null,
    notes: null,
    cvUrl: null,
    occupation: null,
    applicant: { id: `user-${id}`, fullName: `Aday ${id}`, profilePictureUrl: null },
  };
}

describe("işveren özeti", () => {
  it("açık ilanları, işe alınmamış başvuruları, aktif atamaları ve ödenebilir atamaları sayar", () => {
    const summary = employerSummary({
      jobs: page([
        job({ id: "1", status: "OPEN", applicationCount: 5, hiredCount: 2 }),
        job({ id: "2", status: "OPEN", applicationCount: 1, hiredCount: 3 }),
        job({ id: "3", status: "CLOSED", applicationCount: 9, hiredCount: 0 }),
      ]),
      assignments: page([
        assignment({ id: "a", status: "PENDING_CONFIRMATION" }),
        assignment({ id: "b", status: "CONFIRMED", paymentStatus: "PENDING_COLLECTION" }),
        assignment({ id: "c", status: "CONFIRMED", paymentStatus: "FAILED" }),
        assignment({ id: "d", status: "IN_PROGRESS", paymentStatus: "HELD_IN_ESCROW" }),
        assignment({ id: "e", status: "COMPLETED", paymentStatus: "RELEASED_TO_WORKER" }),
        assignment({ id: "f", status: "CANCELLED", paymentStatus: "PENDING_COLLECTION" }),
      ]),
    });

    expect(summary).toEqual({
      openJobs: 2,
      // 5-2 = 3; ikinci ilanda işe alınan başvuruyu aşıyor, negatif sayılmaz.
      openApplications: 3,
      // a, b, c, d: onay bekleyen, iki onaylı, bir süren.
      activeAssignments: 4,
      // Yalnız `canStartPayment`: onaylanmış + tahsil bekleyen ya da başarısız.
      pendingPayments: 2,
      partial: { jobs: false, assignments: false },
    });
  });

  it("tek sayfaya sığmayan listeyi eksik diye işaretler", () => {
    const summary = employerSummary({
      jobs: page([job({})], { last: false, totalPages: 3 }),
      assignments: page([], { last: false, totalPages: 2 }),
    });
    expect(summary.partial).toEqual({ jobs: true, assignments: true });
  });
});

describe("son başvurular", () => {
  it("yalnız başvurusu olan açık ilanları, en çok üç tane okur", () => {
    const jobs = [
      job({ id: "1", applicationCount: 2 }),
      job({ id: "2", applicationCount: 0 }),
      job({ id: "3", status: "CLOSED", applicationCount: 4 }),
      job({ id: "4", applicationCount: 1 }),
      job({ id: "5", applicationCount: 1 }),
      job({ id: "6", applicationCount: 1 }),
    ];
    expect(jobsWorthReadingApplicants(jobs).map((j) => j.id)).toEqual(["1", "4", "5"]);
  });

  it("ilanlar arası başvuruları tarihe göre birleştirir ve sınırlar", () => {
    const recent = recentApplications(
      [
        {
          job: job({ id: "1" }),
          applicants: [applicant("a", "2026-09-10T10:00:00Z"), applicant("b", "2026-09-12T10:00:00Z")],
        },
        {
          job: job({ id: "2" }),
          applicants: [applicant("c", "2026-09-11T10:00:00Z"), applicant("d", "bozuk-tarih")],
        },
      ],
      3,
    );

    expect(recent.map((entry) => `${entry.application.id}@${entry.job.id}`)).toEqual([
      "b@1",
      "c@2",
      "a@1",
    ]);
  });
});
