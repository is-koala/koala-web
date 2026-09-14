import Link from "next/link";

import { ratingSummaryLabel } from "@/applications/employer-review";
import type { EmployerStats, JobDetail, JobImage } from "@/jobs/contract";
import { jobApplicationsClosedReason } from "@/jobs/lifecycle";
import { jobTypeLabels, salaryTypeLabels } from "@/jobs/search";
import { publicJobPath, publicJobsPath } from "@/lib/app-routes";
import { formatDate, formatJobDate, formatMonthYear, isFormattableDate } from "@/lib/dates";
import type { FormAction } from "@/lib/form-state";
import { formatMoney } from "@/lib/money";

import { JobApplicationForm } from "./job-application-form";

/**
 * Herkese açık ilan ayrıntısı.
 *
 * Sunucu bileşeni ve öyle kalmalı: sayfanın var oluş sebebi ilanın ilk
 * HTML'de, script'siz görünmesi (is-koala/koala-web#21, #94). Buraya bir
 * `"use client"` sınırı girerse içerik yine istemciye taşınır.
 *
 * Ekranda adresten yalnız il ve ilçe var; modelde başka bir adres alanı zaten
 * yok (`src/jobs/contract.ts`, ADR-0003).
 *
 * Gövde (`*JobFacts`, `JobDetailBody`) işverenin kendi ilan sayfasıyla ortak
 * (`/isveren/ilan/{id}`, is-koala/koala-web#166): aynı `JobDetailDto`
 * alanlarını iki ekran ayrı ayrı çizerken işverenin sayfası yirmi beş alanın
 * üçünü gösterir olmuştu. Ayrışan tek şey kenar çubuğu — burada başvuru
 * kartı, orada işveren eylemleri.
 */
export function JobDetailView({
  job,
  applyAction,
  employerStats = null,
}: {
  job: JobDetail;
  applyAction: FormAction;
  /** İşveren güven kartı; okunamadıysa `null` ve kart çizilmiyor. */
  employerStats?: EmployerStats | null;
}) {
  // Backend'in başvuru kapısı yine son güvenlik sınırı; web aynı kararı
  // önceden gösterir ki süresi dolmuş bağlantı çalışan bir form vaat etmesin.
  const applicationsClosed = jobApplicationsClosedReason(job);

  return (
    <article className="job-detail">
      <header className="job-detail-hero">
        <div>
          <p className="eyebrow">{job.categoryName ?? "İş ilanı"}</p>
          <h1>{job.title}</h1>
        </div>
        <PublicJobFacts job={job} />
      </header>

      <div className="job-detail-layout">
        <JobDetailBody job={job} />

        <aside className="job-application-card" aria-labelledby="application-title">
          <JobEmployerCard job={job} stats={employerStats} />
          <p className="eyebrow">Başvuru</p>
          {applicationsClosed === null ? (
            <>
              <h2 id="application-title">Bu işte çalışmak ister misin?</h2>
              <p>Başvurunu işverene ilet; durumunu Başvurularım sayfasından takip et.</p>
              <JobApplicationForm action={applyAction} returnPath={publicJobPath(job.id)} />
            </>
          ) : (
            <>
              <h2 id="application-title">Bu ilan başvuruya kapalı</h2>
              <p>{applicationsClosed}</p>
              <p>
                <Link className="text-link" href={publicJobsPath}>
                  Benzer ilanları gör
                </Link>
              </p>
            </>
          )}
        </aside>
      </div>
    </article>
  );
}

/** Özet satırı; `time` taşıyan hücre `value` yerine `node` veriyor. */
type FactEntry = { readonly label: string; readonly value: string; readonly at?: string };

/**
 * Ziyaretçinin ilan özeti: tarih, kazanç, konum, tür, açık pozisyon, yayın tarihi.
 *
 * Kazanç yalnız çalışanın alacağı tutar (ADR-0002); konum etiketi
 * `addressPrecision`'dan seçiliyor ama alanlar hep il/ilçe — bayrağın yanlış
 * gelmesi bir sızıntıya dönüşemiyor (ADR-0003). Açık pozisyon kalan yer.
 */
export function PublicJobFacts({ job }: { job: JobDetail }) {
  return (
    <FactList
      entries={[
        { label: "Tarih", value: formatSchedule(job) },
        { label: "Kazanç", value: formatPayout(job) },
        { label: job.addressPrecision === "EXACT" ? "Konum" : "Yaklaşık konum", value: locationLabel(job) },
        ...typeFact(job),
        ...optionalFact("Açık pozisyon", remainingOpenings(job)),
        ...publishedFact(job),
      ]}
    />
  );
}

/**
 * Sahibin ilan özeti: tarih, adres, tür, dolan kontenjan, başvuru sayısı, yayın tarihi.
 *
 * Kazanç satırı yok — işveren fiyatı dökümde üç satır olarak görüyor ve
 * özete yalnız çalışan ücretini yazmak ona "ilanım bu kadar" dedirtirdi.
 * Kontenjan dolan yer ("1 / 4 kişi işe alındı"): soru "kaç kişiyi aldım".
 * `address` backend'in sahibe kurduğu satır; maskeli geldiyse etiket
 * "Yaklaşık konum", satır yoksa il/ilçe.
 */
export function EmployerJobFacts({
  job,
  address,
  applicationCount,
  className,
}: {
  job: JobDetail;
  /** Sahibe açılan adres satırı (`displayAddress`); yoksa il/ilçe. */
  address: string | null;
  /** `JobDetailDto.applicationCount`; alan gelmediyse satır yok. */
  applicationCount: number | null;
  className?: string;
}) {
  const exact = job.addressPrecision === "EXACT";
  return (
    <FactList
      className={className}
      entries={[
        { label: "Tarih", value: formatSchedule(job) },
        {
          label: exact ? (address ? "Adres" : "Konum") : "Yaklaşık konum",
          value: address ?? locationLabel(job),
        },
        ...typeFact(job),
        ...optionalFact("Kontenjan", hiredOpenings(job)),
        ...optionalFact("Başvuru", applicationCount === null ? null : `${applicationCount} başvuru`),
        ...publishedFact(job),
      ]}
    />
  );
}

function FactList({ entries, className }: { entries: readonly FactEntry[]; className?: string }) {
  return (
    <dl className={["job-facts", className].filter(Boolean).join(" ")} aria-label="İlan özeti">
      {entries.map((entry) => (
        <div key={entry.label}>
          <dt>{entry.label}</dt>
          <dd>{entry.at ? <time dateTime={entry.at}>{entry.value}</time> : entry.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function typeFact(job: JobDetail): readonly FactEntry[] {
  return job.type === "UNKNOWN" ? [] : [{ label: "Tür", value: jobTypeLabels[job.type] }];
}

function optionalFact(label: string, value: string | null): readonly FactEntry[] {
  return value === null ? [] : [{ label, value }];
}

/** Yayın tarihi (`createdAt`, `Instant`); okunamayan değerde satır düşer. */
function publishedFact(job: JobDetail): readonly FactEntry[] {
  if (!job.createdAt || !isFormattableDate(job.createdAt)) return [];
  return [{ label: "Yayın tarihi", value: formatDate(job.createdAt), at: job.createdAt }];
}

/**
 * İlanın gövdesi: açıklama, görevler, aranan özellikler, galeri, ücret dökümü.
 *
 * Boş açıklama yazılı bir cümleyle çiziliyor ("paylaşılmadı"); öbür bölümler
 * alan yoksa hiç açılmıyor. Fark bilinçli: açıklama her ilanda beklenen tek
 * bölüm, ötekiler seçimlik.
 */
export function JobDetailBody({ job, className }: { job: JobDetail; className?: string }) {
  return (
    <div className={["job-detail-content", className].filter(Boolean).join(" ")}>
      <section>
        <h2>İş hakkında</h2>
        <p>{job.description ?? "İlan açıklaması paylaşılmadı."}</p>
      </section>
      {job.duties ? (
        <section>
          <h2>Görevler</h2>
          <p>{job.duties}</p>
        </section>
      ) : null}
      <section>
        <h2>Aranan özellikler</h2>
        <ul className="job-requirements">
          <li>{job.insuranceRequired ? "Sigorta gerekiyor" : "Sigorta şartı yok"}</li>
          <li>{job.experienceRequired ? "Deneyim gerekiyor" : "Deneyim şartı yok"}</li>
          {ageRange(job) ? <li>Yaş aralığı: {ageRange(job)}</li> : null}
          {job.dressCode ? <li>Kıyafet: {job.dressCode}</li> : null}
        </ul>
      </section>
      <JobGallery images={job.images} title={job.title} />
      <JobPricing job={job} />
    </div>
  );
}

/**
 * İşveren kartı.
 *
 * Şirkette logo ve ad; bireysel işverende yalnız ad ve o da bir şirket
 * unvanı gibi sunulmuyor. Kişi adı yapısal veriye hiç girmiyor
 * (`job-posting-schema.ts`), ama ekranda görünmesi gerekiyor: ziyaretçi kime
 * başvurduğunu bilmeli.
 */
function JobEmployerCard({ job, stats }: { job: JobDetail; stats: EmployerStats | null }) {
  const name = job.companyName ?? job.employerName;
  if (name === null) return null;

  return (
    <div className="job-detail-employer">
      {job.companyName !== null && job.companyLogoUrl !== null ? (
        /*
          `next/image` değil düz `<img>`: depolama kökeni henüz
          `images.remotePatterns`'e girmedi (is-koala/koala-web#35), yani
          optimize edici logoları reddederdi. Format/boyut bütçesi
          `src/lib/image-budget.ts` içinde duruyor. Adres `safeImageUrl`
          kapısından `toJobDetail` içinde geçiyor.
        */
        // eslint-disable-next-line @next/next/no-img-element
        <img className="job-detail-logo" src={job.companyLogoUrl} alt="" decoding="async" />
      ) : null}
      <p>
        <span className="muted">{job.companyName === null ? "İşveren" : "Şirket"}</span>
        <br />
        {name}
      </p>
      {stats ? <EmployerTrust stats={stats} /> : null}
    </div>
  );
}

/**
 * İşveren güven kartı: açtığı ilan, tamamlanan iş, puan, üyelik.
 *
 * Puan yalnız değerlendirme varken yazılıyor: backend değerlendirmesi
 * olmayan işverene `0` döndürüyor ve "0,0 puan" yeni bir işvereni kötü bir
 * işveren gibi gösterirdi. Sayılar ilanın kendisi gibi ISR penceresinde
 * bayatlayabiliyor; kartın sorusu "bu işveren kim" ve beş dakikalık gecikme o
 * soruyu değiştirmiyor.
 */
function EmployerTrust({ stats }: { stats: EmployerStats }) {
  const rating = ratingSummaryLabel(stats);
  const memberSince =
    stats.memberSince && isFormattableDate(stats.memberSince)
      ? formatMonthYear(stats.memberSince)
      : null;

  return (
    <dl className="job-employer-trust" aria-label="İşveren güven kartı">
      <div>
        <dt>Açtığı ilan</dt>
        <dd>{stats.jobsPosted}</dd>
      </div>
      <div>
        <dt>Tamamlanan iş</dt>
        <dd>{stats.completedJobs}</dd>
      </div>
      {rating ? (
        <div>
          <dt>Puan</dt>
          <dd>{rating}</dd>
        </div>
      ) : null}
      {memberSince ? (
        <div>
          <dt>Üyelik</dt>
          <dd>
            <time dateTime={stats.memberSince ?? undefined}>{memberSince}</time>
          </dd>
        </div>
      ) : null}
    </dl>
  );
}

/**
 * Fiyat dökümü.
 *
 * Üç satır ayrı ayrı yazılıyor ve toplanmıyor: ADR-0002 hizmet bedelini
 * çalışan ödemesinin **üstüne** ekliyor, yani işverenin ödeyeceği toplam ile
 * çalışanın alacağı tutar farklı sayılar. Tek bir "ücret" yazmak ikisinden
 * hangisi olduğunu belirsiz bırakır ve iş arayanı yanıltırdı.
 */
function JobPricing({ job }: { job: JobDetail }) {
  if (job.pricing === null) return null;
  const { currency, workerPayout, serviceFeeAmount, employerTotal } = job.pricing;

  return (
    <section>
      <h2>Ücret dökümü</h2>
      <dl className="price-breakdown" aria-label="Ücret dökümü">
        <Fact label="Çalışan ücreti" value={formatMoney(workerPayout, currency)} />
        <Fact label="Koala hizmet bedeli" value={formatMoney(serviceFeeAmount, currency)} />
        <Fact label="İşveren toplamı" value={formatMoney(employerTotal, currency)} />
      </dl>
      <p className="muted">
        Çalışana ödenen tutar ile işverenin ödediği toplam ayrı: Koala hizmet bedeli çalışan
        ücretinin üstüne ekleniyor. Bu fiyat ilan yayımlandığında kilitlendi ve değişmiyor.
      </p>
    </section>
  );
}

/** Galeri; görsel yoksa bölüm hiç açılmıyor. */
function JobGallery({ images, title }: { images: readonly JobImage[]; title: string }) {
  if (images.length === 0) return null;

  return (
    <section>
      <h2>Galeri</h2>
      <ul className="job-gallery">
        {images.map((image) => (
          <li key={image.url}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image.url}
              alt={image.caption ?? `${title} ilanından bir görsel`}
              loading="lazy"
              decoding="async"
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function locationLabel(job: JobDetail): string {
  const where = [job.districtName, job.cityName].filter(Boolean).join(", ");
  return where || "Konum bilgisi paylaşılmadı";
}

/**
 * Kalan kontenjan; sınırsız ya da okunamaz ilanda `null`.
 *
 * `hiredCount` backend'de yalnız {CONFIRMED, IN_PROGRESS, COMPLETED}
 * atamaları sayıyor, yani bu sayı kalan kontenjanın **üst sınırı**; metin de
 * onu kesin bir söz gibi yazmıyor.
 */
function remainingOpenings(job: JobDetail): string | null {
  if (job.headcount === null) return null;
  const remaining = Math.max(job.headcount - job.hiredCount, 0);
  return `${remaining} / ${job.headcount} kişi`;
}

/**
 * İşverenin gözünden dolan kontenjan.
 *
 * Aynı iki alandan farklı bir cümle: işveren kaç kişiyi aldığını soruyor ve
 * `hiredCount` tam olarak onu sayıyor. Sınırsız ilanda yine `null` — "1 / ∞"
 * yazmak olmayan bir kotayı bildirmek olurdu (`jobs/headcount.ts`).
 */
function hiredOpenings(job: JobDetail): string | null {
  if (job.headcount === null) return null;
  return `${Math.max(job.hiredCount, 0)} / ${job.headcount} kişi işe alındı`;
}

/** Yaş aralığı; iki uç da yoksa satır düşer. */
function ageRange(job: JobDetail): string | null {
  if (job.minAge > 0 && job.maxAge > 0) return `${job.minAge}–${job.maxAge}`;
  if (job.minAge > 0) return `${job.minAge} ve üzeri`;
  if (job.maxAge > 0) return `${job.maxAge} ve altı`;
  return null;
}

/**
 * "12 Eylül 2026, 09:00–18:00".
 *
 * Tarih `formatJobDate` üzerinden geçiyor; saat ise ISO önekinden metin
 * olarak okunuyor. `new Date(...)` bu ofsetsiz değerleri çalıştığı ortamın
 * saat diliminde yorumlar ve gece yarısına yakın işlerde günü kaydırırdı
 * (`src/lib/dates.ts`).
 */
function formatSchedule(job: JobDetail): string {
  const date = formatJobDate(job.startsAt);
  const start = clockTime(job.startsAt);
  const end = clockTime(job.endsAt);
  if (date === job.startsAt) return "Tarih bilgisi paylaşılmadı";
  return start && end ? `${date}, ${start}–${end}` : date;
}

function clockTime(value: string): string | null {
  return /^\d{4}-\d{2}-\d{2}T(\d{2}:\d{2})/.exec(value)?.[1] ?? null;
}

/**
 * Özetteki kazanç yalnız **çalışanın alacağı** tutar; dökümü aşağıdaki bölüm
 * veriyor. İşveren toplamını buraya yazmak, iş arayana cebine girmeyecek bir
 * sayıyı kazanç diye göstermek olurdu (ADR-0002).
 */
function formatPayout(job: JobDetail): string {
  if (job.pricing === null) return "Kazanç bilgisi paylaşılmadı";
  const amount = formatMoney(job.pricing.workerPayout, job.pricing.currency);
  const unit = salaryTypeLabels[job.salaryType];
  return unit ? `${unit} ${amount}` : amount;
}
