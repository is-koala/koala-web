import "server-only";

import type { CompanyContactUser } from "@/lib/company-contacts";
import type { CompanyContactInvitation, InvitationCompany } from "@/lib/invitations";
import { apiRequest } from "@/server/session/session";

/**
 * Yetkili davetinin, davet **edilen** taraftaki sunucu katmanı.
 *
 * Tarayıcı `api.iskoala.com` ile hiç konuşmuyor (ADR-0011); iki uç da
 * `apiRequest` üzerinden geçiyor, yani süresi dolmuş erişim tokenı sessizce
 * yenileniyor.
 */

type UserResponse = Partial<CompanyContactUser> | null | undefined;

type InvitationResponse = {
  id?: string | null;
  company?: Partial<InvitationCompany> | null;
  invitedBy?: UserResponse;
  invitedUser?: UserResponse;
  role?: string | null;
  status?: string | null;
  invitedAt?: string | null;
  answeredAt?: string | null;
};

/**
 * `GET /contact-invitations/{invitationId}`.
 *
 * Uç **sahiplik denetimi yapmıyor** (`CompanyContactInvitationManager.java:149-155`):
 * kimliği bilen her oturumlu kullanıcı şirket adını, davet edeni ve davet
 * edileni okuyabiliyor. Modül bunu düzeltmiyor — düzeltmesi de gerekmez;
 * kararı `invitationDecision` veriyor ve okunan daveti oturum sahibine ait
 * varsaymıyor.
 */
export async function getInvitation(invitationId: string): Promise<CompanyContactInvitation> {
  return toInvitation(await apiRequest<InvitationResponse | null>(invitationPath(invitationId)));
}

/**
 * `POST /contact-invitations/{invitationId}`.
 *
 * Kabul ve ret **aynı uç**: ret ayrı bir uç değil, aynı gövdenin `false`
 * hâli. `accepted` `@NotNull` olduğu için gövde her iki yolda da açıkça
 * yazılıyor; gövdesiz bir `POST` alan doğrulamasına takılır ve kullanıcıya
 * hiçbir şey anlatmayan bir 400 döner.
 */
export async function answerInvitation(
  invitationId: string,
  accepted: boolean,
): Promise<CompanyContactInvitation> {
  return toInvitation(
    await apiRequest<InvitationResponse | null>(invitationPath(invitationId), {
      method: "POST",
      body: { accepted },
    }),
  );
}

/** Kimlik adres çubuğundan geliyor; kaçırılmadan birleştirmek yolu değiştirebilir. */
function invitationPath(invitationId: string): string {
  return `/contact-invitations/${encodeURIComponent(invitationId)}`;
}

function toInvitation(response: InvitationResponse | null): CompanyContactInvitation {
  const source = response ?? {};

  return {
    id: source.id ?? "",
    company: {
      id: source.company?.id ?? "",
      name: source.company?.name ?? "",
      logoUrl: source.company?.logoUrl ?? null,
    },
    invitedBy: toUser(source.invitedBy),
    invitedUser: toUser(source.invitedUser),
    role: source.role ?? "",
    status: source.status ?? "",
    invitedAt: source.invitedAt ?? null,
    answeredAt: source.answeredAt ?? null,
  };
}

/**
 * `SafeUserDto` alanları boş gelebiliyor; ekran `undefined` üzerinde
 * patlamamalı. `id` özellikle önemli: sahiplik kararı ona bakıyor ve boş bir
 * kimlik hiçbir oturum sahibiyle eşleşmez, yani aksiyonlar kapalı kalır.
 */
function toUser(user: UserResponse): CompanyContactUser {
  return {
    id: user?.id ?? "",
    firstName: user?.firstName ?? "",
    lastName: user?.lastName ?? "",
    username: user?.username ?? "",
    profilePictureUrl: user?.profilePictureUrl ?? null,
  };
}
