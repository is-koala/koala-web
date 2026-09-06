import type { CompanyContactUser } from "./company-contacts";

/**
 * Şirket yetkilisi davetinin, davet **edilen** taraftaki kuralları.
 *
 * Sunucu katmanını içe aktarmaz: hem sunucuda çizilen sayfa hem
 * `"use client"` karar bileşeni aynı kuralı okuyor.
 */

/** `CompanyContactInvitationStatus.PENDING`. */
export const pendingInvitationStatus = "PENDING";

/** `OnlyCompanyDto`'nun davet ekranında okunan parçası. */
export type InvitationCompany = {
  readonly id: string;
  readonly name: string;
  readonly logoUrl: string | null;
};

/** `GetCompanyContactInvitationDto`. */
export type CompanyContactInvitation = {
  readonly id: string;
  readonly company: InvitationCompany;
  readonly invitedBy: CompanyContactUser;
  readonly invitedUser: CompanyContactUser;
  /** `CompanyContactRole`; kabul edildiğinde uygulanacak rol. */
  readonly role: string;
  readonly status: string;
  /** ISO 8601. Davetin son kullanma tarihi yok; aylar önceki bir davet hâlâ geçerli. */
  readonly invitedAt: string | null;
  readonly answeredAt: string | null;
};

/**
 * Ekranın bu davet karşısında ne çizeceği.
 *
 * Üç dal da aksiyonları kapatıyor ya da açıyor, ama gerekçeleri ayrı yerden
 * geliyor ve tek bir "gösterilsin mi" boolean'ı ikisini birleştirirdi:
 *
 * - `notYours`: `getInvitationById` sahiplik denetimi **yapmıyor**
 *   (`CompanyContactInvitationManager.java:149-155`), yani kimliği bilen her
 *   oturumlu kullanıcı daveti okuyabiliyor. Cevaplama ucu ise okumuyor:
 *   `answerToInvitation` başkasının davetine 403 döndürüyor (`:93-95`).
 *   Sayfa okuduğu daveti kendi kullanıcısına ait varsayarsa kullanıcı "Kabul
 *   et"e basıp o 403'ü yer.
 * - `answered`: davet bir kez cevaplanıyor ve ikinci cevap 409. Formu çizip
 *   kullanıcıyı o 409'a sürmek, kapıyı hiç koymamakla aynı sonucu verirdi.
 * - `answerable`: yalnız iki koşul da sağlandığında.
 */
export type InvitationDecision =
  | { kind: "answerable" }
  | { kind: "answered"; status: string }
  | { kind: "notYours" };

export function invitationDecision(
  invitation: CompanyContactInvitation,
  viewerId: string,
): InvitationDecision {
  // Sahiplik önce: iki gerekçe de aksiyonu kapatıyor ama davetin bu hesaba
  // hiç gelmediğini söylemek kullanıcıya daha doğru bir bilgi veriyor.
  if (invitation.invitedUser.id !== viewerId) return { kind: "notYours" };

  // Tanınmayan bir durum "bekliyor" sayılmıyor: sözleşmeye eklenen yeni bir
  // değer kullanıcıyı sonucu belli bir isteğe gönderirdi.
  if (invitation.status !== pendingInvitationStatus) {
    return { kind: "answered", status: invitation.status };
  }

  return { kind: "answerable" };
}

/**
 * Durumun ekrandaki metni. Tanınmayan değer olduğu gibi geçer: uydurulmuş
 * bir etiket, sözleşmenin değiştiğini ekrandan gizlerdi.
 */
export function invitationStatusLabel(status: string): string {
  if (status === pendingInvitationStatus) return "Cevap bekliyor";
  if (status === "ACCEPTED") return "Kabul edildi";
  if (status === "REJECTED") return "Reddedildi";
  return status;
}
