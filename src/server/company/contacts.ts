import "server-only";

import type { CompanyContact, CompanyInvitation } from "@/lib/company-contacts";
import { apiRequest } from "@/server/session/session";

/**
 * Şirketin yetkili listesi ve davetleri.
 *
 * Yetkilendirme burada tekrarlanmıyor: dört ucun hepsi kendi kapısını
 * taşıyor ve geçemeyen çağrıya **404** dönüyor — üyesi olunmayan bir şirket
 * ile var olmayan bir şirket `errorCode` dahil ayırt edilemez
 * (is-koala/koala-backend#85). Modül bu ayrımı yapmaya çalışmaz; hatayı
 * olduğu gibi yukarı taşır ve metni `@/lib/errors` seçer.
 */

/**
 * `GET /companies/{companyId}/contacts` — şirketin **herhangi** bir yetkilisi
 * çağırabilir (`requireCompanyMember`), yani `STAFF` de listeyi görüyor.
 */
export async function getCompanyContacts(companyId: string): Promise<readonly CompanyContact[]> {
  return (await apiRequest<CompanyContact[] | null>(`${companyPath(companyId)}/contacts`)) ?? [];
}

/**
 * `GET /companies/{companyId}/contact-invitations` — yalnız şirketin `ADMIN`
 * yetkilisi. `STAFF` ve üye olmayan aynı 404'ü alır.
 *
 * Uç bütün davetleri döndürüyor (`findByCompanyId`); "bekleyen" süzgeci
 * `@/lib/company-contacts` içinde, çünkü ekranın kararı, taşımanın değil.
 */
export async function getCompanyInvitations(
  companyId: string,
): Promise<readonly CompanyInvitation[]> {
  const path = `${companyPath(companyId)}/contact-invitations`;
  return (await apiRequest<CompanyInvitation[] | null>(path)) ?? [];
}

/**
 * `DELETE /companies/{companyId}/contacts/{userId}` — yalnız `ADMIN`.
 *
 * İkinci parametre **kişinin** kimliği (`CompanyContactDto.user.id`), üyelik
 * kaydınınki değil; kayıt kimliğini göndermek her çıkarmayı 404'e düşürürdü.
 * Son yöneticinin çıkarılması 409 `COMPANY_LAST_ADMIN_CANNOT_BE_REMOVED`.
 */
export async function removeCompanyContact(companyId: string, userId: string): Promise<void> {
  await apiRequest(`${companyPath(companyId)}/contacts/${encodeURIComponent(userId)}`, {
    method: "DELETE",
  });
}

/** Kimlik adres çubuğundan geliyor; kaçırılmadan birleştirmek yolu değiştirebilir. */
function companyPath(companyId: string): string {
  return `/companies/${encodeURIComponent(companyId)}`;
}
