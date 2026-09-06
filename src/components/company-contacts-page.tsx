import Image from "next/image";

import { ContactRemoveForm } from "@/components/company/contact-remove-form";
import { EmptyState, ErrorState } from "@/components/states";
import {
  canManageContacts,
  contactRoleLabel,
  pendingInvitations,
  personName,
  wouldRemoveLastAdmin,
  type CompanyContact,
  type CompanyContactUser,
  type CompanyInvitation,
} from "@/lib/company-contacts";
import type { FormAction } from "@/lib/form-state";

/**
 * Şirket yetkilileri ekranı.
 *
 * Sunum bileşeni: oturumu, rolü, backend'i kendisi okumaz — ne verilirse onu
 * çizer. Rol kararı `canManageContacts`, metin `@/lib/errors`; bu ayrım
 * sayesinde ekran bir backend olmadan, kural da bir render olmadan test
 * edilebiliyor.
 */

export type CompanyContactsData<T> =
  | { status: "ready"; data: T }
  | { status: "error"; errorCode: string; httpStatus: number };

export type CompanyContactsPageProps = {
  companyName: string;
  /** Kullanıcının bu şirketteki rolü; `GET /users/me` üyelik listesinden. */
  viewerRole: string;
  contacts: CompanyContactsData<readonly CompanyContact[]>;
  /**
   * Davet listesi; `ADMIN` olmayan için `null`.
   *
   * `null` "istek başarısız" değil "hiç sorulmadı" demek: uç `STAFF`'a kesin
   * 404 döndürüyor ve o 404'ü hata kartı olarak çizmek, kullanıcının kendi
   * rolünden bilinen bir sonucu arıza gibi gösterirdi.
   */
  invitations: CompanyContactsData<readonly CompanyInvitation[]> | null;
  /** Kişinin kimliğine bağlanmış çıkarma action'ı. */
  removeAction: (userId: string) => FormAction;
};

export function CompanyContactsPageView({
  companyName,
  viewerRole,
  contacts,
  invitations,
  removeAction,
}: CompanyContactsPageProps) {
  const manages = canManageContacts(viewerRole);

  return (
    <div className="profile-page">
      <section className="app-panel profile-heading">
        <div>
          <p className="eyebrow">{companyName}</p>
          <h1>Şirket yetkilileri</h1>
          <p className="lede">
            Şirket adına ilan açabilen, başvuruları görebilen ve atama yapabilen kişiler burada
            listelenir.
          </p>
        </div>
      </section>

      <section className="app-panel" aria-labelledby="company-contacts-title">
        <div className="section-heading-row">
          <div>
            <p className="eyebrow">Yetkililer</p>
            <h2 id="company-contacts-title">Şirketin yetkili listesi</h2>
          </div>
        </div>

        {/*
         * Rozet iki rolü kullanıcının **yapabildiği işle** ayırıyor: yönetici
         * ayarları, logoyu, galeriyi ve yetkili listesini yönetiyor; ilan
         * yetkilisi yalnız ilan açıp yönetiyor.
         */}
        {manages ? null : (
          <p className="muted">
            Yetkili davet etmeyi ve çıkarmayı yalnız şirket yöneticileri yapabilir. Bekleyen
            davetleri de yalnız onlar görebilir.
          </p>
        )}

        <ContactList contacts={contacts} manages={manages} removeAction={removeAction} />
      </section>

      <InvitationsSection invitations={invitations} manages={manages} />
    </div>
  );
}

function ContactList({
  contacts,
  manages,
  removeAction,
}: {
  contacts: CompanyContactsData<readonly CompanyContact[]>;
  manages: boolean;
  removeAction: (userId: string) => FormAction;
}) {
  if (contacts.status === "error") {
    return <ErrorState errorCode={contacts.errorCode} status={contacts.httpStatus} />;
  }

  // Şirketin en az bir yetkilisi hep var (kurucusu), ama liste boş dönerse
  // ekran sessizce hiçbir şey çizmemeli.
  if (contacts.data.length === 0) return <EmptyState kind="companyContacts" />;

  return (
    <ul className="profile-record-list" aria-label="Şirket yetkilileri">
      {contacts.data.map((contact) => (
        <li key={contact.id} className="profile-record contact-record">
          <PersonSummary user={contact.user} note={contactRoleLabel(contact.role)} />
          {manages ? (
            <ContactAction contact={contact} contacts={contacts.data} removeAction={removeAction} />
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/**
 * Bir satırın çıkarma eylemi.
 *
 * Son yönetici için eylem devre dışı ve gerekçesi yanında: liste zaten
 * ekranda olduğu için sonucu önceden okuyabiliyoruz, ve kullanıcıyı onay
 * adımından geçirip backend'e reddettirmek kapıyı hiç koymamakla aynı sonucu
 * verirdi. 409 yine de karşılanıyor — iki yönetici birbirini aynı anda
 * çıkarmaya kalkabilir.
 */
function ContactAction({
  contact,
  contacts,
  removeAction,
}: {
  contact: CompanyContact;
  contacts: readonly CompanyContact[];
  removeAction: (userId: string) => FormAction;
}) {
  if (wouldRemoveLastAdmin(contacts, contact.user.id)) {
    return (
      <div className="gate-action">
        <button type="button" className="button button-secondary button-small" disabled>
          Yetkiliyi çıkar
        </button>
        <p className="field-hint">
          Şirkette en az bir yönetici kalmalı. Önce başka birini yönetici olarak davet et.
        </p>
      </div>
    );
  }

  return (
    <ContactRemoveForm
      action={removeAction(contact.user.id)}
      personName={personName(contact.user)}
    />
  );
}

function InvitationsSection({
  invitations,
  manages,
}: {
  invitations: CompanyContactsData<readonly CompanyInvitation[]> | null;
  manages: boolean;
}) {
  // Rolünden dolayı hiç sorulmadıysa bölüm de yok: gerekçesi yetkili
  // listesinin yanında bir kez yazılı.
  if (invitations === null || !manages) return null;

  return (
    <section className="app-panel" aria-labelledby="company-invitations-title">
      <div className="section-heading-row">
        <div>
          <p className="eyebrow">Davetler</p>
          <h2 id="company-invitations-title">Bekleyen davetler</h2>
        </div>
      </div>

      <InvitationList invitations={invitations} />

      {/*
       * Davet gönderme formu bilerek yok. Uç davet edilecek kişinin **T.C.
       * kimlik numarasını** istiyor (`InviteContactToCompanyDto`) ve web
       * formunun üçüncü bir kişinin kimlik numarasını işverenden toplayıp
       * toplamayacağı ürün ve KVKK kararı — is-koala/koala-web#30 "İnsan
       * kararı gerekiyor". Karar gelmeden form yazmak, geri alınması pahalı
       * bir veri toplama kararını sessizce vermek olurdu.
       */}
      <div className="state-card" role="status">
        <h3>Davet gönderme web&apos;de henüz açık değil</h3>
        <p>
          Davet ucu, davet edilen kişinin T.C. kimlik numarasını istiyor. Bu bilginin işverenden
          toplanıp toplanmayacağı karara bağlanana kadar formu açmıyoruz; daveti şimdilik Koala
          uygulamasından gönderebilirsin.
        </p>
      </div>
    </section>
  );
}

function InvitationList({
  invitations,
}: {
  invitations: CompanyContactsData<readonly CompanyInvitation[]>;
}) {
  if (invitations.status === "error") {
    return <ErrorState errorCode={invitations.errorCode} status={invitations.httpStatus} />;
  }

  const pending = pendingInvitations(invitations.data);
  if (pending.length === 0) return <EmptyState kind="companyInvitations" />;

  return (
    <>
      <ul className="profile-record-list" aria-label="Bekleyen davetler">
        {pending.map((invitation) => (
          <li key={invitation.id} className="profile-record contact-record">
            <PersonSummary
              user={invitation.invitedUser}
              note={`${contactRoleLabel(invitation.role)} olarak davet edildi`}
            />
          </li>
        ))}
      </ul>
      {/*
       * Davet e-postası `CRITICAL` öncelikli gidiyor ve yanında uygulama içi
       * bir bildirim de yazılıyor, ama teslim yine de garanti değil. "Kabul
       * edilene kadar listede görünmez" cümlesi, kullanıcının bekleyen bir
       * daveti yetkili listesinde aramasını engelliyor.
       */}
      <p className="muted">
        Davet edilen kişi daveti kabul edene kadar yetkili listesinde görünmez. Daveti geri çekmek
        için bugün bir yol yok.
      </p>
    </>
  );
}

function PersonSummary({ user, note }: { user: CompanyContactUser; note: string }) {
  return (
    <div className="contact-identity">
      <Avatar user={user} />
      <div>
        <h3>{personName(user)}</h3>
        <small>{note}</small>
      </div>
    </div>
  );
}

/**
 * Avatar dekoratif: adı zaten yanında yazıyor, yani `alt` metni ekran
 * okuyucuya aynı bilgiyi ikinci kez okuturdu.
 */
function Avatar({ user }: { user: CompanyContactUser }) {
  if (user.profilePictureUrl) {
    return (
      <Image
        className="contact-avatar"
        src={user.profilePictureUrl}
        alt=""
        width={44}
        height={44}
        unoptimized
      />
    );
  }

  const initials = `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}` || "K";
  return (
    <div className="contact-avatar contact-avatar-placeholder" aria-hidden="true">
      {initials}
    </div>
  );
}
