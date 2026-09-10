import Link from "next/link";

import type { JobDetail, JobImage } from "@/jobs/contract";
import { jobApplicationsClosedReason } from "@/jobs/lifecycle";
import { jobTypeLabels, salaryTypeLabels } from "@/jobs/search";
import { publicJobsPath } from "@/lib/app-routes";
import { formatJobDate } from "@/lib/dates";
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
 */
export function JobDetailView({ job, applyAction }: { job: JobDetail; applyAction: FormAction }) {
  // Backend'in başvuru kapısı yine son güvenlik sınırı; web aynı kararı
  // önceden gösterir ki süresi dolmuş bağlantı çalışan bir form vaat etmesin.
  const applicationsClosed = jobApplicationsClosedReason(job);
  const openings = remainingOpenings(job);

  return (
    <article className="job-detail">
      <header className="job-detail-hero">
        <div>
          <p className="eyebrow">{job.categoryName ?? "İş ilanı"}</p>
          <h1>{job.title}</h1>
        </div>
        <dl className="job-facts" aria-label="İlan özeti">
          <Fact label="Tarih" value={formatSchedule(job)} />
          <Fact label="Kazanç" value={formatPayout(job)} />
          <Fact
            /*
              Etiket `addressPrecision`'ı okuyor ama alanları o seçmiyor: yanıt
              hangi kesinlikte gelirse gelsin ekrana yalnız il ve ilçe çıkıyor.
              Bayrak burada ziyaretçiye vaadi doğru kuruyor — "Konum" yazıp
              ilçe göstermek, adresin bundan ibaret olduğunu ima ederdi.
            */
            label={job.addressPrecision === "EXACT" ? "Konum" : "Yaklaşık konum"}
            value={locationLabel(job)}
          />
          {job.type === "UNKNOWN" ? null : <Fact label="Tür" value={jobTypeLabels[job.type]} />}
          {openings === null ? null : <Fact label="Açık pozisyon" value={openings} />}
        </dl>
      </header>

      <div className="job-detail-layout">
        <div className="job-detail-content">
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

        <aside className="job-application-card" aria-labelledby="application-title">
          <JobEmployerCard job={job} />
          <p className="eyebrow">Başvuru</p>
          {applicationsClosed === null ? (
            <>
              <h2 id="application-title">Bu işte çalışmak ister misin?</h2>
              <p>Başvurunu işverene ilet; durumunu Başvurularım sayfasından takip et.</p>
              <JobApplicationForm action={applyAction} />
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

/**
 * İşveren kartı.
 *
 * Şirkette logo ve ad; bireysel işverende yalnız ad ve o da bir şirket
 * unvanı gibi sunulmuyor. Kişi adı yapısal veriye hiç girmiyor
 * (`job-posting-schema.ts`), ama ekranda görünmesi gerekiyor: ziyaretçi kime
 * başvurduğunu bilmeli.
 */
function JobEmployerCard({ job }: { job: JobDetail }) {
  const name = job.companyName ?? job.employerName;
  if (name === null) return null;

  return (
    <div className="job-detail-employer">
      {job.companyName !== null && job.companyLogoUrl !== null ? (
        /*
          `next/image` değil düz `<img>`: `next.config.ts` içinde `images`
          bloğu yok ve logolar backend'in depolama kökeninden geliyor
          (`StorageUrlResolver`), yani optimize edici onları reddederdi.
          Adres `safeImageUrl` kapısından `toJobDetail` içinde geçiyor.
        */
        // eslint-disable-next-line @next/next/no-img-element
        <img className="job-detail-logo" src={job.companyLogoUrl} alt="" decoding="async" />
      ) : null}
      <p>
        <span className="muted">{job.companyName === null ? "İşveren" : "Şirket"}</span>
        <br />
        {name}
      </p>
    </div>
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
