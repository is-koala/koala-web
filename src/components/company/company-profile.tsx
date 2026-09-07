import Image from "next/image";
import Link from "next/link";

import { AddressView } from "@/components/address-view";
import { canManageCompany, companyTypeLabel, lockedCompanyFields } from "@/lib/company";
import type { Company } from "@/server/company/company";

/**
 * Şirket profili.
 *
 * Sunum bileşeni: oturumu, rolü ve backend'i kendisi okumaz — ne verilirse
 * onu çizer. Bu ayrım sayesinde ekran bir backend olmadan test edilebiliyor.
 *
 * `GET /companies/{companyId}` üyelik denetimi yapmadığı için burada
 * gösterilen vergi numarası, e-posta ve tam adres yalnız kullanıcının kendi
 * şirketinde çizilmeli; sayfanın kapısı çağıran tarafta.
 */
export type CompanyProfileProps = {
  company: Company;
  /** Kullanıcının bu şirketteki rolü; `GET /users/me` üyelik listesinden. */
  viewerRole: string;
  editHref: string;
  contactsHref: string;
  /**
   * Şirket adına ilan açma formunun adresi.
   *
   * Bağlantı yalnız **onaylı** şirkette çiziliyor. Kural istemcide yaşıyor —
   * `company.isApproved()` koala-backend'in iş mantığında hiç okunmuyor, yani
   * onaysız şirket API'den ilan açabiliyor — ama kullanıcıyı formun başında
   * kapanan bir kapıya yollamanın anlamı yok.
   */
  newJobHref: string;
};

export function CompanyProfileView({
  company,
  viewerRole,
  editHref,
  contactsHref,
  newJobHref,
}: CompanyProfileProps) {
  return (
    <div className="profile-page">
      <section className="app-panel profile-heading">
        <div className="contact-identity">
          <CompanyLogo company={company} />
          <div>
            <p className="eyebrow">Şirketim</p>
            <h1>{company.name}</h1>
            <ApprovalBadge approved={company.approved} />
          </div>
        </div>
        {canManageCompany(viewerRole) ? (
          <Link className="text-link" href={editHref}>
            Şirket bilgilerini düzenle
          </Link>
        ) : null}
      </section>

      <ApprovalNotice approved={company.approved} />

      {company.approved ? (
        <section className="app-panel" aria-labelledby="company-new-job-title">
          <div className="section-heading-row">
            <div>
              <p className="eyebrow">İlanlar</p>
              <h2 id="company-new-job-title">Şirket adına ilan</h2>
            </div>
          </div>
          <p className="lede">
            İlan şirket adına açılır; başvurular ve ödeme de şirketin üzerinden yürür.
          </p>
          {/*
            Yalnız yöneticiye değil, bütün yetkililere gösteriliyor:
            `createCorporateJob` `requireCompanyAdmin` istemiyor, yetkili
            listesinde olmayı arıyor.
          */}
          <Link className="button button-primary" href={newJobHref}>
            Şirket adına ilan aç
          </Link>
        </section>
      ) : null}

      <section className="app-panel" aria-labelledby="company-facts-title">
        <div className="section-heading-row">
          <div>
            <p className="eyebrow">Şirket bilgileri</p>
            <h2 id="company-facts-title">Temel bilgiler</h2>
          </div>
        </div>

        <dl className="job-facts">
          <Fact label="Şirket türü" value={companyTypeLabel(company.type)} />
          <Fact label="Vergi numarası" value={company.taxNumber} />
          <Fact label="E-posta" value={company.email} />
          <Fact label="Telefon" value={company.phoneNumber} />
          <Fact label="Web sitesi" value={company.website} />
          <Fact label="Takipçi sayısı" value={String(company.followerCount)} />
        </dl>

        {company.description ? <p className="record-description">{company.description}</p> : null}
      </section>

      <section className="app-panel" aria-labelledby="company-address-title">
        <div className="section-heading-row">
          <div>
            <p className="eyebrow">Adres</p>
            <h2 id="company-address-title">Şirket adresi</h2>
          </div>
        </div>
        <AddressView address={company.address} />
        <p className="muted">{addressLockReason}</p>
      </section>

      <section className="app-panel" aria-labelledby="company-contacts-link-title">
        <div className="section-heading-row">
          <div>
            <p className="eyebrow">Yetkililer</p>
            <h2 id="company-contacts-link-title">Şirket adına iş yapabilen kişiler</h2>
          </div>
        </div>
        <p className="lede">
          Şirket adına ilan açabilen, başvuruları görebilen ve atama yapabilen kişileri
          yetkililer sayfasından yönetirsin.
        </p>
        <Link className="text-link" href={contactsHref}>
          Şirket yetkilileri
        </Link>
      </section>
    </div>
  );
}

/** Adresin neden düzenlenemediği tek yerden okunuyor. */
const addressLockReason =
  lockedCompanyFields.find((field) => field.name === "address")?.reason ?? "";

function ApprovalBadge({ approved }: { approved: boolean }) {
  return approved ? (
    <p className="status-pill">Onaylandı</p>
  ) : (
    <p className="status-pill status-pill-warn">Onay bekliyor</p>
  );
}

/**
 * Onay bekleyen şirketin ekrandaki karşılığı.
 *
 * Üç şeyi birlikte söylüyor, çünkü ikisi eksik kalırsa kullanıcı yanlış bir
 * beklentiyle bekler: ilan açma yolu kapalı, onay **bildirimle
 * duyurulmuyor** (`approveCompany` hiçbir bildirim göndermiyor,
 * is-koala/koala-backend#62) ve durumu öğrenmenin tek yolu bu sayfayı yeniden
 * açmak.
 */
function ApprovalNotice({ approved }: { approved: boolean }) {
  if (approved) return null;

  return (
    <div className="state-card" role="status">
      <h2>Şirket kaydın inceleniyor</h2>
      <p>Onay tamamlanana kadar bu şirket adına ilan açamazsın.</p>
      <p>
        Onay tamamlandığında bildirim gönderilmiyor. Durumu öğrenmek için bu sayfayı yeniden
        açman gerekiyor.
      </p>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;

  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

/**
 * Logo dekoratif: şirketin adı zaten yanında yazıyor, yani `alt` metni ekran
 * okuyucuya aynı bilgiyi ikinci kez okuturdu.
 */
function CompanyLogo({ company }: { company: Company }) {
  if (company.logoUrl) {
    return (
      <Image
        className="contact-avatar"
        src={company.logoUrl}
        alt=""
        width={64}
        height={64}
        unoptimized
      />
    );
  }

  return (
    <div className="contact-avatar contact-avatar-placeholder" aria-hidden="true">
      {company.name[0] ?? "K"}
    </div>
  );
}
