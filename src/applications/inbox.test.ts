import { describe, expect, it } from "vitest";

import {
  inboxHref,
  inboxJobChoices,
  inboxPageSize,
  inboxReviewHref,
  parseInboxQuery,
} from "./inbox";

const jobId = "9c1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f60";
const companyId = "5d3c1b0a-7f60-4c2f-8a9e-9c1f0d244f6c";
const applicationId = "3b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f6e";
const foreignCompanyId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("işveren başvuru gelen kutusu sorgusu", () => {
  it("durum, ilan, şirket ve sayfayı adres çubuğundan okur", () => {
    expect(
      parseInboxQuery({
        status: "APPLIED",
        jobId,
        companyId,
        page: "2",
      }),
    ).toEqual({
      status: "APPLIED",
      jobId,
      companyId,
      page: 2,
    });
  });

  it("bilinmeyen süzgeçleri ve bozuk kimlikleri göndermeden düşürür", () => {
    expect(
      parseInboxQuery({
        status: ["APPLIED", "REJECTED"],
        jobId: "../hesap",
        companyId: "not-a-uuid",
        page: "-1",
      }),
    ).toEqual({
      status: "ALL",
      jobId: null,
      companyId: null,
      page: 0,
    });
  });

  it("kapsam dışı görünen şirket kimliğini yine de taşır; boş sayfa kararı backend'de", () => {
    // İstemci yetkili şirket listesine bakıp yabancı kimliği düşürseydi,
    // yer imi ya da paylaşılmış bir adres bütün gelen kutusunu açardı.
    expect(parseInboxQuery({ companyId: foreignCompanyId }).companyId).toBe(foreignCompanyId);
  });

  it("süzgeçleri ve sayfayı paylaşılabilir adreste birlikte korur", () => {
    expect(
      inboxHref({ status: "REJECTED", jobId, companyId, page: 2 }),
    ).toBe(
      `/isveren/basvurular?status=REJECTED&jobId=${jobId}&companyId=${companyId}&page=2`,
    );
  });

  it("varsayılan süzgeçleri adrese yazmaz; durum değişince sayfa başa döner", () => {
    expect(inboxHref({ status: "ALL", jobId: null, companyId: null, page: 0 })).toBe(
      "/isveren/basvurular",
    );
    expect(
      inboxHref({ status: "ACCEPTED", jobId: null, companyId, page: 0 }),
    ).toBe(`/isveren/basvurular?status=ACCEPTED&companyId=${companyId}`);
  });

  it("inceleme ekranına ilan ve başvuru çapasıyla bağlanır", () => {
    expect(inboxReviewHref({ jobId, applicationId })).toBe(
      `/isveren/ilan/${jobId}/basvurular#applicant-${applicationId}`,
    );
  });

  it("ilan süzgecini sayfadaki başlıklardan kurar; seçili ama görünmeyen ilanı kaybetmez", () => {
    const missingJobId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    expect(
      inboxJobChoices(
        [
          { jobId, postingTitle: "Hafta sonu garson" },
          { jobId, postingTitle: "Hafta sonu garson" },
        ],
        missingJobId,
      ),
    ).toEqual([
      { id: jobId, title: "Hafta sonu garson" },
      { id: missingJobId, title: "Seçili ilan" },
    ]);
  });

  it("sayfa boyutu backend varsayılanıyla aynıdır", () => {
    expect(inboxPageSize).toBe(20);
  });
});
