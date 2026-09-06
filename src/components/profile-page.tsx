import Image from "next/image";

import { ProfileDetailsForm, ProfilePictureForm } from "@/components/profile/details-forms";
import { EducationCreator, EducationEditor } from "@/components/profile/education-forms";
import { ExperienceCreator, ExperienceEditor } from "@/components/profile/experience-forms";
import { NotificationPreferencesForm } from "@/components/profile/notification-preferences-form";
import { ErrorState } from "@/components/states";
import {
  employmentTypeOptions,
  gradeTypeOptions,
  profileCompletion,
  type AcademicReference,
  type EditableProfile,
  type Education,
  type Experience,
  type NotificationPreference,
} from "@/lib/profile";

export type ProfileDataResult<T> =
  | { status: "ready"; data: T }
  | { status: "error"; errorCode: string; httpStatus: number };

export function ProfilePageView({
  profile,
  preferences,
  universities,
}: {
  profile: EditableProfile;
  preferences: ProfileDataResult<readonly NotificationPreference[]>;
  universities: ProfileDataResult<readonly AcademicReference[]>;
}) {
  const completion = profileCompletion(profile);

  return (
    <div className="profile-page">
      <section className="app-panel profile-heading">
        <div>
          <p className="eyebrow">İş arayan profili</p>
          <h1>Profilim</h1>
          <p className="lede">
            İşverenlerin seni tanımasına yardımcı olacak bilgileri ve özgeçmişini burada yönet.
          </p>
        </div>
        <ProfileAvatar profile={profile} />
      </section>

      <section className="app-panel completion-card" aria-labelledby="profile-completion-title">
        <div className="section-heading-row">
          <div>
            <p className="eyebrow">Profil tamamlanma</p>
            <h2 id="profile-completion-title">%{completion.percentage} tamamlandı</h2>
          </div>
          <strong className="completion-number">%{completion.percentage}</strong>
        </div>
        <progress aria-label="Profil tamamlanma yüzdesi" max="100" value={completion.percentage} />
        <p className="muted">
          Dolu bir profil, işverenin başvurunu değerlendirirken daha fazla bilgi görmesini sağlar.
          Bu gösterge başvuru izni değildir; kimlik, adres ve ödeme bilgisi koşulları ayrıca
          denetlenir.
        </p>
        {completion.missing.length > 0 ? (
          <ul className="missing-list">
            {completion.missing.map((item) => <li key={item}>{item}</li>)}
          </ul>
        ) : (
          <p className="completion-done">Profilinin bu bölümündeki tüm alanlar tamam.</p>
        )}
      </section>

      <section className="app-panel" aria-labelledby="profile-picture-title">
        <SectionHeading
          eyebrow="Fotoğraf"
          title="Profil fotoğrafı"
          id="profile-picture-title"
          description="Fotoğraf sunucuda işlenir ve tarayıcıya oturum bilgisi açılmadan yüklenir."
        />
        <ProfilePictureForm />
      </section>

      <section className="app-panel" aria-labelledby="profile-details-title">
        <SectionHeading
          eyebrow="Temel bilgiler"
          title="Kendini anlat"
          id="profile-details-title"
          description="Yetkinliklerini ve ilgilendiğin iş türlerini ayrı ayrı yazabilirsin."
        />
        <ProfileDetailsForm profile={profile} />
      </section>

      <section className="app-panel" aria-labelledby="contact-title">
        <SectionHeading
          eyebrow="İletişim"
          title="İletişim bilgileri"
          id="contact-title"
          description="Doğrulama durumu, bildirim kanallarını anlamana yardımcı olur."
        />
        <dl className="contact-grid">
          <div>
            <dt>E-posta</dt>
            <dd>{profile.email || "Eklenmedi"}</dd>
            <VerificationBadge verified={profile.emailVerified} />
          </div>
          <div>
            <dt>Telefon</dt>
            <dd>{profile.phoneNumber || "Eklenmedi"}</dd>
            <VerificationBadge verified={profile.phoneVerified} />
          </div>
        </dl>
      </section>

      <section className="app-panel" aria-labelledby="experience-title">
        <SectionHeading
          eyebrow="Özgeçmiş"
          title="Deneyimler"
          id="experience-title"
          description="Burada eklediğin kayıtlar mobil uygulamadaki özgeçmişinde de görünür."
        />
        {profile.experiences.length === 0 ? (
          <ProfileEmpty
            title="Henüz deneyim eklemedin"
            message="İlk iş deneyimini ekleyerek yaptığın işleri görünür kıl."
          />
        ) : (
          <div className="profile-record-list">
            {profile.experiences.map((experience) => (
              <ExperienceRecord key={experience.id} experience={experience} />
            ))}
          </div>
        )}
        <ExperienceCreator />
      </section>

      <section className="app-panel" aria-labelledby="education-title">
        <SectionHeading
          eyebrow="Özgeçmiş"
          title="Eğitim"
          id="education-title"
          description="Üniversite, fakülte ve bölümü güncel eğitim kataloğundan birlikte seç."
        />
        {profile.educations.length === 0 ? (
          <ProfileEmpty
            title="Henüz eğitim eklemedin"
            message="Eğitim geçmişini ekleyerek profilini tamamla."
          />
        ) : (
          <div className="profile-record-list">
            {profile.educations.map((education) => (
              <EducationRecord key={education.id} education={education} />
            ))}
          </div>
        )}
        {profile.educations.map((education) => (
          <EducationEditor
            key={`editor-${education.id}`}
            education={education}
            universities={universities.status === "ready" ? universities.data : []}
          />
        ))}
        {universities.status === "error" ? (
          <ErrorState errorCode={universities.errorCode} status={universities.httpStatus} />
        ) : universities.data.length === 0 ? (
          <ProfileEmpty
            title="Eğitim kataloğu henüz hazır değil"
            message="Üniversite kataloğu dolduğunda eğitim kaydı ekleyebilirsin."
          />
        ) : (
          <EducationCreator universities={universities.data} />
        )}
      </section>

      <section className="app-panel" aria-labelledby="preferences-title">
        <SectionHeading
          eyebrow="İletişim tercihleri"
          title="Sana nasıl ulaşalım?"
          id="preferences-title"
          description="İşlemsel bildirimler hesabın için zorunludur; diğer kanalları seçebilirsin."
        />
        {preferences.status === "error" ? (
          <ErrorState errorCode={preferences.errorCode} status={preferences.httpStatus} />
        ) : preferences.data.length === 0 ? (
          <ProfileEmpty
            title="İletişim tercihi bulunamadı"
            message="Tercihler hazır olduğunda burada listelenecek."
          />
        ) : (
          <NotificationPreferencesForm preferences={preferences.data} />
        )}
      </section>
    </div>
  );
}

function ProfileAvatar({ profile }: { profile: EditableProfile }) {
  if (profile.profilePictureUrl) {
    return (
      <Image
        className="profile-avatar"
        src={profile.profilePictureUrl}
        alt={`${profile.firstName ?? ""} ${profile.lastName ?? ""} profil fotoğrafı`.trim()}
        width={112}
        height={112}
        unoptimized
      />
    );
  }

  const initials = `${profile.firstName?.[0] ?? ""}${profile.lastName?.[0] ?? ""}` || "K";
  return <div className="profile-avatar profile-avatar-placeholder" aria-label="Profil fotoğrafı yok">{initials}</div>;
}

function SectionHeading({
  eyebrow,
  title,
  id,
  description,
}: {
  eyebrow: string;
  title: string;
  id: string;
  description: string;
}) {
  return (
    <div className="profile-section-heading">
      <p className="eyebrow">{eyebrow}</p>
      <h2 id={id}>{title}</h2>
      <p className="muted">{description}</p>
    </div>
  );
}

function ProfileEmpty({ title, message }: { title: string; message: string }) {
  return (
    <div className="state-card profile-empty" role="status">
      <h3>{title}</h3>
      <p>{message}</p>
    </div>
  );
}

function VerificationBadge({ verified }: { verified: boolean }) {
  return <span className={verified ? "verification verified" : "verification"}>{verified ? "Doğrulandı" : "Doğrulanmadı"}</span>;
}

function ExperienceRecord({ experience }: { experience: Experience }) {
  const employmentType = employmentTypeOptions.find(({ value }) => value === experience.employmentType)?.label;
  return (
    <article className="profile-record">
      <div>
        <h3>{experience.title}</h3>
        <p>{[experience.companyName, experience.cityName].filter(Boolean).join(" · ") || "İşveren belirtilmedi"}</p>
        <small>{[employmentType, dateRange(experience.startDate, experience.endDate)].filter(Boolean).join(" · ")}</small>
        {experience.description ? <p className="record-description">{experience.description}</p> : null}
      </div>
      <ExperienceEditor experience={experience} />
    </article>
  );
}

function EducationRecord({ education }: { education: Education }) {
  const gradeType = gradeTypeOptions.find(({ value }) => value === education.type)?.label ?? education.type;
  return (
    <article className="profile-record">
      <div>
        <h3>{education.departmentName}</h3>
        <p>{`${education.universityName} · ${education.facultyName}`}</p>
        <small>{`${gradeType} · ${dateRange(education.startDate, education.endDate)} · Ortalama ${education.gpa.toLocaleString("tr-TR")}`}</small>
      </div>
    </article>
  );
}

function dateRange(startDate: string, endDate: string | null): string {
  return `${monthYear(startDate)} – ${endDate ? monthYear(endDate) : "Devam ediyor"}`;
}

function monthYear(value: string): string {
  return new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}
