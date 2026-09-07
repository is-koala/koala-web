import { describe, expect, it } from "vitest";

import {
  applicantPage,
  applicantPageSize,
  applicantsInFilter,
  type JobApplicant,
} from "./employer-review";

describe("işveren başvuru listesinin istemci tarafı dilimlemesi", () => {
  it("sayfa boyutundan fazlasını hiç taşımaz", () => {
    // `GET /jobs/{jobId}/applications` sayfalı değil: 500 başvuru tek yanıtta
    // geliyor. Ekranın kilitlenmemesinin tek koşulu, kart üretiminin sayfa
    // boyutuyla sınırlı kalması.
    const page = applicantPage(applicants(500), 0);

    expect(page.items).toHaveLength(applicantPageSize);
    expect(page.totalElements).toBe(500);
    expect(page.totalPages).toBe(Math.ceil(500 / applicantPageSize));
    expect(page.items[0].id).toBe("applicant-0");
  });

  it("son sayfada yalnız kalan kayıtları taşır", () => {
    const page = applicantPage(applicants(45), 2);

    expect(page.items).toHaveLength(5);
    expect(page.items[0].id).toBe("applicant-40");
    expect(page.last).toBe(true);
    expect(page.first).toBe(false);
  });

  it("aralık dışındaki sayfa numarasını son sayfaya sabitler", () => {
    // Numara adres çubuğundan değil ekranın yerel durumundan geliyor, ama
    // liste bir prop: sunucu tazelemesinden sonra kısalan listede elde kalan
    // numara kullanıcıyı boş bir ekrana düşürürdü.
    const page = applicantPage(applicants(45), 99);

    expect(page.page).toBe(2);
    expect(page.items).toHaveLength(5);
  });

  it("boş listede ilk ve son sayfayı birlikte bildirir", () => {
    const page = applicantPage([], 3);

    expect(page).toMatchObject({
      page: 0,
      totalPages: 0,
      totalElements: 0,
      first: true,
      last: true,
    });
    expect(page.items).toEqual([]);
  });

  it("durum süzgeci yalnız o durumdaki başvuruları bırakır", () => {
    const list = [
      applicant("a", "APPLIED"),
      applicant("b", "ACCEPTED"),
      applicant("c", "REJECTED"),
      applicant("d", "APPLIED"),
    ];

    expect(applicantsInFilter(list, "APPLIED").map((item) => item.id)).toEqual(["a", "d"]);
    expect(applicantsInFilter(list, "ALL")).toEqual(list);
  });
});

function applicants(count: number): readonly JobApplicant[] {
  return Array.from({ length: count }, (_, index) => applicant(`applicant-${index}`, "APPLIED"));
}

function applicant(id: string, status: JobApplicant["status"]): JobApplicant {
  return {
    id,
    status,
    appliedAt: "2026-09-01T09:00:00Z",
    notes: null,
    cvUrl: null,
    occupation: null,
    applicant: {
      id: `${id}-user`,
      fullName: "Aday",
      profilePictureUrl: null,
    },
  };
}
