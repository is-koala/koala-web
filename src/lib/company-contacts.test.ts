import { describe, expect, it } from "vitest";

import {
  canManageContacts,
  companyMembership,
  contactRoleLabel,
  membershipRole,
  pendingInvitations,
  personName,
  wouldRemoveLastAdmin,
  type CompanyContact,
  type CompanyInvitation,
} from "./company-contacts";

const companies = [
  { companyId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", companyName: "Koala Kafe", role: "ADMIN", approved: true },
  { companyId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", companyName: "Koala Lojistik", role: "STAFF", approved: false },
];

describe("şirket üyeliği", () => {
  it("kullanıcının o şirketteki rolünü kendi üyelik listesinden okur", () => {
    // Rol `GET /users/me` yanıtında zaten var; ikinci bir tur atmak kabuk
    // altındaki her sayfaya bir istek daha eklerdi.
    expect(membershipRole(companies, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")).toBe("ADMIN");
    expect(membershipRole(companies, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb")).toBe("STAFF");
  });

  it("üyesi olmadığı şirketi var olmayan şirketten ayırt etmez", () => {
    // Backend de ayırt etmiyor: `requireCompanyMember` saf bir `exists…`
    // sorgusu ve iki dal da aynı 404'ü aynı `errorCode` ile döndürüyor
    // (is-koala/koala-backend#85). İstemci burada "var ama senin değil"
    // diyebilseydi, sözleşmenin bilerek kapattığı bilgi ekrandan sızardı.
    expect(membershipRole(companies, "cccccccc-cccc-4ccc-8ccc-cccccccccccc")).toBeNull();
    expect(membershipRole([], "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")).toBeNull();
  });
});

describe("şirket üyelik kaydı", () => {
  it("üyeliğin adını ve rolünü tek aramada verir", () => {
    // Ekran şirketin adını da yazıyor. İkinci bir arama yazmak, adres
    // çubuğundaki kimliğin iki farklı kayda çözülebildiği bir yer açardı.
    expect(companyMembership(companies, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb")).toEqual({
      companyId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      companyName: "Koala Lojistik",
      role: "STAFF",
      approved: false,
    });
  });

  it("üyelik yoksa kaydı da rolü de aynı anda yok sayar", () => {
    expect(companyMembership(companies, "cccccccc-cccc-4ccc-8ccc-cccccccccccc")).toBeNull();
  });
});

describe("yetkili yönetimi rolü", () => {
  it("yalnız ADMIN yetkili davet edip çıkarabilir", () => {
    // `CompanyManager.requireCompanyAdmin` davet, çıkarma, logo ve galeri
    // uçlarının ilk satırı; STAFF bunların hiçbirine geçemiyor.
    expect(canManageContacts("ADMIN")).toBe(true);
    expect(canManageContacts("STAFF")).toBe(false);
  });

  it("üyeliği olmayan ve tanınmayan rolü yönetici saymaz", () => {
    // `MANAGER` sözleşmeden kaldırıldı; eski bir yanıt ya da yazım hatası
    // yetkiyi açmamalı. Karar tanınan tek değere bağlı, "ADMIN değilse
    // STAFF'tır" varsayımına değil.
    expect(canManageContacts(null)).toBe(false);
    expect(canManageContacts("MANAGER")).toBe(false);
    expect(canManageContacts("admin")).toBe(false);
  });
});

function contact(id: string, role: string): CompanyContact {
  return {
    id: `membership-${id}`,
    user: { id, firstName: "Ada", lastName: "Kaya", username: "ada", profilePictureUrl: null },
    role,
  };
}

const soleAdmin = contact("11111111-1111-4111-8111-111111111111", "ADMIN");
const otherAdmin = contact("22222222-2222-4222-8222-222222222222", "ADMIN");
const staff = contact("33333333-3333-4333-8333-333333333333", "STAFF");

describe("son yönetici kuralı", () => {
  it("tek yönetici kalmışsa onu çıkarmayı engeller", () => {
    // Backend aynı kuralı 409 `COMPANY_LAST_ADMIN_CANNOT_BE_REMOVED` ile
    // uyguluyor. Liste zaten ekranda olduğu için sonucu önceden okuyabiliyoruz;
    // kullanıcıyı onay diyaloğundan geçirip reddettirmek kapıyı hiç
    // koymamakla aynı sonucu verirdi.
    expect(wouldRemoveLastAdmin([soleAdmin, staff], soleAdmin.user.id)).toBe(true);
  });

  it("ikinci bir yönetici varsa yöneticinin çıkarılmasına izin verir", () => {
    expect(wouldRemoveLastAdmin([soleAdmin, otherAdmin], soleAdmin.user.id)).toBe(false);
  });

  it("yönetici olmayan yetkiliyi kural kapsamına almaz", () => {
    expect(wouldRemoveLastAdmin([soleAdmin, staff], staff.user.id)).toBe(false);
  });

  it("listede olmayan kullanıcıyı son yönetici saymaz", () => {
    // `CompanyContactDto.id` üyelik kaydının kimliği, `user.id` kişinin;
    // kural yanlış alanla sorgulanırsa hiçbir satırla eşleşmez ve sessizce
    // her çıkarmaya izin verirdi.
    expect(wouldRemoveLastAdmin([soleAdmin, staff], soleAdmin.id)).toBe(false);
  });
});

function invitation(id: string, status: string): CompanyInvitation {
  return {
    id,
    invitedBy: { id: "inviter", firstName: "Ada", lastName: "Kaya", username: "ada", profilePictureUrl: null },
    invitedUser: { id: "invitee", firstName: "Efe", lastName: "Demir", username: "efe", profilePictureUrl: null },
    role: "STAFF",
    status,
    invitedAt: "2026-09-01T09:00:00Z",
    answeredAt: null,
  };
}

describe("bekleyen davetler", () => {
  it("yalnız cevaplanmamış davetleri bekleyen sayar", () => {
    // Uç `findByCompanyId` ile **bütün** davetleri döndürüyor; cevaplanmış
    // olanları bekleyen gibi göstermek şirket yöneticisine hiç gitmeyecek
    // bir hatırlatma bırakırdı.
    const all = [invitation("a", "PENDING"), invitation("b", "ACCEPTED"), invitation("c", "REJECTED")];

    expect(pendingInvitations(all).map((item) => item.id)).toEqual(["a"]);
  });

  it("tanımadığı durumu bekleyen saymaz", () => {
    expect(pendingInvitations([invitation("d", "EXPIRED")])).toEqual([]);
  });
});

describe("ekrandaki adlandırma", () => {
  it("iki rolü kullanıcının yapabildiği işle ayırır", () => {
    // Ham `ADMIN` / `STAFF` rozeti kullanıcının neyi yapıp yapamayacağını
    // söylemiyor; ayrım tam olarak burada yaşıyor.
    expect(contactRoleLabel("ADMIN")).toBe("Yönetici");
    expect(contactRoleLabel("STAFF")).toBe("İlan yetkilisi");
  });

  it("tanımadığı rolü uydurmadan olduğu gibi gösterir", () => {
    expect(contactRoleLabel("MANAGER")).toBe("MANAGER");
  });

  it("adı boş olan kaydı kullanıcı adına düşürür", () => {
    // `SafeUserDto` e-posta taşımıyor: çıkarma onayı adla kurulmak zorunda ve
    // adsız bir satır "bu kişiyi çıkar" cümlesini anlamsız bırakırdı.
    expect(personName({ id: "1", firstName: "Efe", lastName: "Demir", username: "efe", profilePictureUrl: null })).toBe("Efe Demir");
    expect(personName({ id: "1", firstName: "", lastName: "", username: "efe", profilePictureUrl: null })).toBe("efe");
  });
});
