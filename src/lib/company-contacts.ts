/**
 * Şirket yetkililerinin istemci tarafı kuralları.
 *
 * Sunucu katmanını içe aktarmaz: hem sayfa hem `"use client"` bileşenleri
 * aynı kuralı okuyor ve kural iki yerde ayrışırsa ekranda görünen yetki ile
 * eylemin gerçekten çalışıp çalışmadığı sessizce ayrışır.
 */

/** `CompanyContactRole` — backend'de yalnız iki değer var. */
export type CompanyContactRole = "ADMIN" | "STAFF";

/** Bir üyelik kaydının bu modülün okuduğu alanları. */
type Membership = {
  readonly companyId: string;
  readonly role: string;
};

/**
 * Kullanıcının bu şirketteki üyelik kaydı; yoksa `null`.
 *
 * Ad ve rol tek aramadan çıkıyor: ikisini ayrı ayrı aramak, adres
 * çubuğundaki kimliğin iki farklı kayda çözülebildiği bir yer açardı.
 */
export function companyMembership<T extends Membership>(
  memberships: readonly T[],
  companyId: string,
): T | null {
  return memberships.find((membership) => membership.companyId === companyId) ?? null;
}

/**
 * Kullanıcının bu şirketteki rolü; üyeliği yoksa `null`.
 *
 * Kaynak `GET /users/me` yanıtındaki üyelik listesi: kabuk onu zaten okudu ve
 * `React.cache()` ile paylaşıyor, yani rol için ikinci bir tur gerekmiyor.
 *
 * `null`, "üyesi değilsin" ile "böyle bir şirket yok"u **ayırmaz** ve bu
 * bilerek: backend'in dört davet ucu da iki durumu aynı 404 ve aynı
 * `errorCode` ile karşılıyor (is-koala/koala-backend#85). İstemci ikisini
 * ayırabilseydi, sözleşmenin kapattığı varlık bilgisi ekrandan sızardı.
 */
export function membershipRole(
  memberships: readonly Membership[],
  companyId: string,
): string | null {
  return companyMembership(memberships, companyId)?.role ?? null;
}

/**
 * Yetkili davet etme ve çıkarma yetkisi.
 *
 * Tanınan tek değere bağlı, "ADMIN değilse STAFF'tır" varsayımına değil:
 * sözleşmeden kaldırılmış `MANAGER` gibi bir değer ya da yanıttaki bir
 * sapma, yetkiyi sessizce açmamalı. Backend'de karşılığı
 * `CompanyManager.requireCompanyAdmin`.
 */
export function canManageContacts(role: string | null | undefined): boolean {
  return role === "ADMIN";
}

/** `SafeUserDto`. E-posta taşımıyor: onay metni adla kurulmak zorunda. */
export type CompanyContactUser = {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly username: string;
  readonly profilePictureUrl: string | null;
};

/** `CompanyContactDto`. `id` üyelik kaydının, `user.id` kişinin kimliği. */
export type CompanyContact = {
  readonly id: string;
  readonly user: CompanyContactUser;
  /** Bilinmeyen bir değer de metin olarak taşınır; karar `canManageContacts`'ta. */
  readonly role: string;
};

/**
 * Bu kişiyi çıkarmak şirketi yöneticisiz bırakır mı.
 *
 * Backend aynı kuralı 409 `COMPANY_LAST_ADMIN_CANNOT_BE_REMOVED` ile
 * uyguluyor (`CompanyManager.removeContact`). Kural burada da duruyor çünkü
 * liste zaten ekranda: kullanıcıyı onay diyaloğundan geçirip sonunda
 * reddettirmek, kapıyı hiç koymamakla aynı sonucu verirdi. 409 yine de
 * karşılanıyor — iki yönetici birbirini aynı anda çıkarabilir.
 *
 * Sorgu **kişinin** kimliğiyle yapılır (`user.id`), üyelik kaydınınkiyle
 * değil: yanlış alan hiçbir satırla eşleşmez ve kural sessizce kapanırdı.
 */
export function wouldRemoveLastAdmin(
  contacts: readonly CompanyContact[],
  userId: string,
): boolean {
  const target = contacts.find((contact) => contact.user.id === userId);
  if (target === undefined || !canManageContacts(target.role)) return false;
  return contacts.filter((contact) => canManageContacts(contact.role)).length <= 1;
}

/** `CompanyContactInvitationStatus`. */
export const pendingInvitationStatus = "PENDING";

/** `CompanyContactInvitationDto`. Şirket alanı yok: liste zaten şirkete bağlı. */
export type CompanyInvitation = {
  readonly id: string;
  readonly invitedBy: CompanyContactUser;
  readonly invitedUser: CompanyContactUser;
  readonly role: string;
  readonly status: string;
  readonly invitedAt: string | null;
  readonly answeredAt: string | null;
};

/**
 * Henüz cevaplanmamış davetler.
 *
 * Uç `findByCompanyId` ile şirketin **bütün** davetlerini döndürüyor
 * (`CompanyContactInvitationDao`), yani kabul edilmiş ve reddedilmiş kayıtlar
 * da geliyor. Süzgeç burada: cevaplanmış bir daveti "bekliyor" diye
 * göstermek, yöneticiye hiç karşılığı olmayan bir iş bırakırdı.
 */
export function pendingInvitations(
  invitations: readonly CompanyInvitation[],
): readonly CompanyInvitation[] {
  return invitations.filter((invitation) => invitation.status === pendingInvitationStatus);
}

/**
 * Rol rozetinin metni.
 *
 * Ham `ADMIN` / `STAFF` kullanıcıya neyi yapıp yapamayacağını söylemiyor;
 * ayrım — ayarlar, logo, galeri ve yetkili yönetimi yalnız yöneticide — tam
 * olarak burada okunuyor. Tanınmayan değer olduğu gibi geçer: uydurulmuş bir
 * etiket, sözleşmenin değiştiğini gizlerdi.
 */
export function contactRoleLabel(role: string): string {
  if (role === "ADMIN") return "Yönetici";
  if (role === "STAFF") return "İlan yetkilisi";
  return role;
}

/**
 * Bir kişinin ekranda görünen adı.
 *
 * `SafeUserDto` e-posta taşımıyor, yani çıkarma onayı adla kurulmak zorunda.
 * Adı boş bir kayıt onay cümlesini anlamsız bırakacağı için kullanıcı adına
 * düşülür.
 */
export function personName(user: CompanyContactUser): string {
  return `${user.firstName} ${user.lastName}`.trim() || user.username;
}
