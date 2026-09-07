import { describe, expect, it } from "vitest";

import { jobHeadcount } from "./headcount";

describe("ilan kontenjanı", () => {
  it("işe alınan ve kalan sayıyı birlikte yazar", () => {
    const status = jobHeadcount({ headcount: 5, hiredCount: 2 });

    expect(status).toMatchObject({ headcount: 5, hiredCount: 2, remaining: 3, full: false });
    expect(status.summary).toContain("2");
    expect(status.summary).toContain("5");
  });

  it("kontenjan dolduğunda bunu ayrıca söyler", () => {
    const status = jobHeadcount({ headcount: 3, hiredCount: 3 });

    expect(status).toMatchObject({ remaining: 0, full: true });
  });

  it("backend'in saydığından fazlasını işe almışsa kalanı eksiye düşürmez", () => {
    expect(jobHeadcount({ headcount: 2, hiredCount: 4 })).toMatchObject({
      remaining: 0,
      full: true,
    });
  });

  it("kontenjan bildirilmemişse sınırsız sayar", () => {
    // `JobDetailDto.headcount` null olabiliyor ve bu "sınırsız" demek; sıfır
    // saymak ilanı kapalıymış gibi gösterirdi.
    const status = jobHeadcount({ headcount: null, hiredCount: 7 });

    expect(status).toMatchObject({ headcount: null, remaining: null, full: false });
    expect(status.caveat).toBeNull();
  });

  it("kalan kontenjanın kesin olmadığını yazılı taşır", () => {
    // `hiredCount` {CONFIRMED, IN_PROGRESS, COMPLETED} sayıyor
    // (`JobManager.java:278-280`), kabul kapısı ise `PENDING_CONFIRMATION`'ı da
    // sayıyor (`JobAssignmentManager.java:71-73`). Yani "1 kişilik yer kaldı"
    // yazan bir ilan, bekleyen bir teklif varken kabulü reddedebilir.
    const status = jobHeadcount({ headcount: 5, hiredCount: 2 });

    expect(status.caveat).toBeTruthy();
    expect(status.caveat).toContain("bekleyen");
  });

  it("kontenjan dolduğunda belirsizlik notunu tekrar etmez", () => {
    expect(jobHeadcount({ headcount: 3, hiredCount: 3 }).caveat).toBeNull();
  });
});
