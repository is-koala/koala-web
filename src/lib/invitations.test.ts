import { describe, expect, it } from "vitest";

import {
  invitationDecision,
  invitationStatusLabel,
  pendingInvitationStatus,
  type CompanyContactInvitation,
} from "./invitations";

const viewerId = "11111111-1111-4111-8111-111111111111";

const invitation: CompanyContactInvitation = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  company: { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", name: "Koala Temizlik", logoUrl: null },
  invitedBy: {
    id: "22222222-2222-4222-8222-222222222222",
    firstName: "Yusuf",
    lastName: "Açmacı",
    username: "yusuf",
    profilePictureUrl: null,
  },
  invitedUser: {
    id: viewerId,
    firstName: "Emre",
    lastName: "Durusoy",
    username: "emre",
    profilePictureUrl: null,
  },
  role: "STAFF",
  status: pendingInvitationStatus,
  invitedAt: "2026-08-01T09:00:00Z",
  answeredAt: null,
};

describe("davet kararı", () => {
  it("davet edilen kişi bekleyen daveti cevaplayabilir", () => {
    expect(invitationDecision(invitation, viewerId)).toEqual({ kind: "answerable" });
  });

  it("başkasına ait davette aksiyon çizdirmez", () => {
    /*
     * `getInvitationById` sahiplik denetimi **yapmıyor**
     * (`CompanyContactInvitationManager.java:149-155`): kimliği bilen her
     * oturumlu kullanıcı daveti okuyabiliyor. Sayfa okuduğu daveti kendi
     * kullanıcısına ait varsayarsa, kullanıcı "Kabul et"e basıp 403 yer.
     */
    expect(invitationDecision(invitation, "99999999-9999-4999-8999-999999999999")).toEqual({
      kind: "notYours",
    });
  });

  it("cevaplanmış davette aksiyon yerine durumu gösterir", () => {
    // Davet bir kez cevaplanıyor; ikinci cevap 409 döner. Formu çizip
    // kullanıcıyı o 409'a sürmek, kapıyı hiç koymamakla aynı sonucu verirdi.
    expect(invitationDecision({ ...invitation, status: "ACCEPTED" }, viewerId)).toEqual({
      kind: "answered",
      status: "ACCEPTED",
    });
    expect(invitationDecision({ ...invitation, status: "REJECTED" }, viewerId)).toEqual({
      kind: "answered",
      status: "REJECTED",
    });
  });

  it("başkasına ait cevaplanmış davette sahiplik gerekçesini öne alır", () => {
    // İki gerekçe de aksiyonu kapatıyor ama kullanıcıya bu hesapla hiçbir şey
    // yapamayacağını söylemek daha doğru bir bilgi: davet o hesaba gelmedi.
    expect(invitationDecision({ ...invitation, status: "ACCEPTED" }, "baska-kisi")).toEqual({
      kind: "notYours",
    });
  });

  it("tanımadığı durumu cevaplanmış sayar", () => {
    // Sözleşmeye eklenen yeni bir durumu "bekliyor" saymak, kullanıcıyı
    // sonucu belli bir isteğe gönderirdi.
    expect(invitationDecision({ ...invitation, status: "EXPIRED" }, viewerId)).toEqual({
      kind: "answered",
      status: "EXPIRED",
    });
  });
});

describe("davet durumu metni", () => {
  it("üç durumu da Türkçe karşılığıyla yazar", () => {
    expect(invitationStatusLabel("PENDING")).toBe("Cevap bekliyor");
    expect(invitationStatusLabel("ACCEPTED")).toBe("Kabul edildi");
    expect(invitationStatusLabel("REJECTED")).toBe("Reddedildi");
  });

  it("tanımadığı durumu ham hâliyle bırakır", () => {
    // Uydurulmuş bir etiket, sözleşmenin değiştiğini ekrandan gizlerdi.
    expect(invitationStatusLabel("EXPIRED")).toBe("EXPIRED");
  });
});
