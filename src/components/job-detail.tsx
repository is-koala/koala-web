import type { FormAction } from "@/lib/form-state";
import type { JobDetail, SalaryType } from "@/jobs/contract";
import { jobApplicationsClosedReason } from "@/jobs/lifecycle";

import { JobApplicationForm } from "./job-application-form";

const monthNames = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
] as const;

export function JobDetailView({ job, applyAction }: { job: JobDetail; applyAction: FormAction }) {
  const employer = job.companyName ?? job.employerName;
  // Backend başvuru alırken ilanın durumuna bakmıyor; kapatılmış bir ilana
  // doğrudan bağlantıyla gelen kişiye çalışan bir form göstermek, işverenin
  // kapattığı ilana başvuru düşürmek olurdu.
  const applicationsClosed = jobApplicationsClosedReason(job.status);

  return (
    <article className="job-detail">
      <header className="job-detail-hero">
        <div>
          <p className="eyebrow">{job.categoryName ?? "İş ilanı"}</p>
          <h1>{job.title}</h1>
          {employer ? <p className="job-detail-employer">{employer}</p> : null}
        </div>
        <dl className="job-facts" aria-label="İlan özeti">
          <Fact label="Tarih" value={formatSchedule(job.startsAt, job.endsAt)} />
          <Fact label="Kazanç" value={formatPayout(job.workerPayout, job.currency, job.salaryType)} />
          <Fact
            label={job.addressPrecision === "APPROXIMATE" ? "Yaklaşık konum" : "Konum"}
            value={job.location ?? "Konum bilgisi paylaşılmadı"}
          />
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
              {job.dressCode ? <li>Kıyafet: {job.dressCode}</li> : null}
            </ul>
          </section>
        </div>

        <aside className="job-application-card" aria-labelledby="application-title">
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
              <p className="muted">Benzer ilanları iş ilanları sayfasından bulabilirsin.</p>
            </>
          )}
        </aside>
      </div>
    </article>
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

function formatSchedule(startsAt: string, endsAt: string): string {
  const start = parseLocalTimestamp(startsAt);
  const end = parseLocalTimestamp(endsAt);
  if (!start || !end) return "Tarih bilgisi paylaşılmadı";
  const date = `${start.day} ${monthNames[start.month - 1]} ${start.year}`;
  return `${date}, ${start.time}–${end.time}`;
}

function parseLocalTimestamp(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!match) return null;
  return {
    year: match[1],
    month: Number(match[2]),
    day: Number(match[3]),
    time: `${match[4]}:${match[5]}`,
  };
}

function formatPayout(amount: string | null, currency: string | null, salaryType: SalaryType) {
  if (!amount || !currency) return "Kazanç bilgisi paylaşılmadı";
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(amount);
  if (!match) return `${amount} ${currency}`;
  const integer = match[1].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const decimal = (match[2] ?? "00").padEnd(2, "0");
  const period = salaryType === "DAILY" ? " / gün" : salaryType === "HOURLY" ? " / saat" : "";
  return `${integer},${decimal} ${currency}${period}`;
}
