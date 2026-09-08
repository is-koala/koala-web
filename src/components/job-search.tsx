import Link from "next/link";

import { LinkPending } from "@/components/link-pending";
import { EmptyState } from "@/components/states";
import { employerTypeValues } from "@/jobs/employer-jobs";
import {
  activeJobFilters,
  booleanFilterChoice,
  booleanFilterValues,
  districtCityParamName,
  employerTypeFilterLabels,
  experienceFilterLabels,
  hasJobFilters,
  insuranceFilterLabels,
  isPageOutOfRange,
  jobSearchParamNames,
  jobSearchParams,
  jobSortOptions,
  jobTypeLabels,
  lastJobPage,
  referenceFieldOptions,
  referenceFilterLabels,
  salaryTypeFilterLabels,
  salaryTypeLabels,
  type BooleanFilterValue,
  type JobFilterOptions,
  type JobSearchPage,
  type JobSearchQuery,
  type JobSummary,
  type ReferenceOption,
} from "@/jobs/search";
import { publicJobPath, publicJobsPath } from "@/lib/app-routes";
import { formatJobDate } from "@/lib/dates";
import { jobTypeValues, salaryTypeValues } from "@/lib/job-posting";
import { formatMoney } from "@/lib/money";
import { safeImageUrl } from "@/lib/urls";

/**
 * Herkese açık ilan listesinin ekran parçaları.
 *
 * Hiçbiri istemci bileşeni değil ve bu bilinçli: süzgeç, sıralama ve sayfa
 * adres çubuğunda taşınıyor, yani paylaşılan bir bağlantı aynı listeyi açıyor,
 * geri düğmesi çalışıyor ve arama motoru her kombinasyonu gerçek bir sayfa
 * olarak görüyor. Yerel durumda tutulsalardı üçü de kaybolurdu.
 */

/**
 * Süzgeç formu.
 *
 * `method="get"`: gönderim seçimi adres çubuğuna yazar, JavaScript'siz çalışır
 * ve sonuç paylaşılabilir olur. Sayfa numarası bilerek bir form alanı değil —
 * yeni bir süzgeç yeni bir sonuç kümesi demek ve kullanıcıyı o kümenin
 * yedinci sayfasında bırakmak boş bir ekran gösterirdi.
 */
export function JobSearchForm({
  query,
  options,
}: {
  query: JobSearchQuery;
  options: JobFilterOptions;
}) {
  return (
    <form className="job-filters" method="get" action={publicJobsPath}>
      <div className="job-filter-fields">
        <div className="field">
          <label htmlFor="job-filter-text">Ne arıyorsun?</label>
          <input
            id="job-filter-text"
            name={jobSearchParamNames.text}
            type="search"
            defaultValue={query.text ?? ""}
            placeholder="Örneğin: garson, kurye, fotoğrafçı"
          />
        </div>

        <ReferenceField
          id="job-filter-category"
          label="Kategori"
          name={jobSearchParamNames.categoryId}
          placeholder="Tüm kategoriler"
          options={options.categories}
          selected={query.categoryId}
          fallback={referenceFilterLabels.category}
        />

        <ReferenceField
          id="job-filter-city"
          label="İl"
          name={jobSearchParamNames.cityId}
          placeholder="Tüm iller"
          options={options.cities}
          selected={query.cityId}
          fallback={referenceFilterLabels.city}
        />

        {/*
          İlçe kutusu yalnız bir il seçiliyken var: ilçeler `GET
          /reference/cities/{cityId}/districts` ile geliyor, yani il olmadan
          sunulacak bir liste de yok. Gizli alan, listenin hangi ile ait
          olduğunu söylüyor; il değişip gönderildiğinde ilçe seçimi düşüyor.

          Seçili bir ilçe kutuyu **tek başına** da açıyor: sözlük ucu
          okunamadığında liste boş dönüyordu ve kutuyla birlikte gizli alan da
          çizilmiyordu, yani gönderim ilçe seçimini götürmüyordu. Seçili ilçe
          zaten bir il taşıyor (`districtParam` ilsiz ilçeyi düşürüyor), yani
          gizli alanın yazacağı kimlik de yerinde.
        */}
        {options.districts.length > 0 || query.districtId !== null ? (
          <>
            <input type="hidden" name={districtCityParamName} value={query.cityId ?? ""} />
            <ReferenceField
              id="job-filter-district"
              label="İlçe"
              name={jobSearchParamNames.districtId}
              placeholder="Tüm ilçeler"
              options={options.districts}
              selected={query.districtId}
              fallback={referenceFilterLabels.district}
            />
          </>
        ) : null}

        <ChoiceField
          id="job-filter-type"
          label="İlan türü"
          name={jobSearchParamNames.type}
          placeholder="Tüm türler"
          choices={jobTypeValues.map((type) => ({ value: type, label: jobTypeLabels[type] }))}
          selected={query.type}
        />

        <ChoiceField
          id="job-filter-salary-type"
          label="Ücret tipi"
          name={jobSearchParamNames.salaryType}
          placeholder="Saatlik ve günlük"
          choices={salaryTypeValues.map((value) => ({
            value,
            label: salaryTypeFilterLabels[value],
          }))}
          selected={query.salaryType}
        />

        <ChoiceField
          id="job-filter-employer-type"
          label="İlanı veren"
          name={jobSearchParamNames.employerType}
          placeholder="Herkes"
          choices={employerTypeValues.map((value) => ({
            value,
            label: employerTypeFilterLabels[value],
          }))}
          selected={query.employerType}
        />

        <SalaryField
          id="job-filter-min-salary"
          label="En az ücret"
          name={jobSearchParamNames.minSalary}
          placeholder="Alt sınır yok"
          value={query.minSalary}
        />

        <SalaryField
          id="job-filter-max-salary"
          label="En çok ücret"
          name={jobSearchParamNames.maxSalary}
          placeholder="Üst sınır yok"
          value={query.maxSalary}
        />

        {/*
          Üç durumlu, onay kutusu değil: sunucu `null` (süzme), `true` ve
          `false`'ı ayrı okuyor ve işaretsiz bir onay kutusu hiç gönderilmediği
          için "farketmez" ile "hayır" tek hâle katlanırdı — sigortasız işleri
          arayan kullanıcı onları hiç süzemezdi.
        */}
        <ChoiceField
          id="job-filter-insurance"
          label="Sigorta"
          name={jobSearchParamNames.insuranceRequired}
          placeholder="Farketmez"
          choices={booleanChoices(insuranceFilterLabels)}
          selected={booleanFilterChoice(query.insuranceRequired)}
        />

        <ChoiceField
          id="job-filter-experience"
          label="Deneyim"
          name={jobSearchParamNames.experienceRequired}
          placeholder="Farketmez"
          choices={booleanChoices(experienceFilterLabels)}
          selected={booleanFilterChoice(query.experienceRequired)}
        />

        <div className="field">
          <label htmlFor="job-filter-sort">Sıralama</label>
          <select id="job-filter-sort" name={jobSearchParamNames.sort} defaultValue={query.sort}>
            {jobSortOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="job-filter-actions">
        <button className="button button-primary" type="submit">
          İlanları süz
        </button>
        {hasJobFilters(query) ? (
          <Link className="text-link" href={publicJobsPath}>
            Süzgeçleri temizle
          </Link>
        ) : null}
      </div>

      <ActiveFilterBadges query={query} options={options} />
    </form>
  );
}

/**
 * Seçili süzgeçler, tek tek silinebilir.
 *
 * Her rozet gerçek bir `<a href>`: JavaScript kapalıyken de bir süzgeç
 * kaldırılabilmeli, ve düğme + istemci durumu bunu kapatırdı. Form
 * gönderilmesi de gerekmiyor — bağlantı zaten doğru adresi taşıyor.
 *
 * Bağlantı `<form>`'un içinde duruyor ve bu geçerli: iç içe geçen şey bir form
 * değil, bir liste. Rozetlerin süzgeç kutularının yanında durması gerekiyor
 * çünkü ikisi aynı şeyi iki farklı okunurlukta söylüyor — kutular ne
 * seçilebileceğini, rozetler ne seçili olduğunu.
 */
function ActiveFilterBadges({
  query,
  options,
}: {
  query: JobSearchQuery;
  options: JobFilterOptions;
}) {
  const filters = activeJobFilters(query, options);
  if (filters.length === 0) return null;

  return (
    <ul className="job-filter-badges" aria-label="Seçili süzgeçler">
      {filters.map((filter) => (
        <li key={filter.id}>
          {/*
            Görünen metin süzgecin kendisi, erişilebilir ad ise ne yapacağını
            söylüyor: ekran okuyucuda tek başına "Kadıköy" bir bağlantı adı
            olarak nereye gittiğini anlatmıyor.
          */}
          <Link href={jobSearchHref(filter.without)} aria-label={`${filter.label} süzgecini kaldır`}>
            {filter.label}
            <span aria-hidden="true">×</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Üç durumlu süzgecin iki yazılı seçeneği; üçüncüsü `placeholder`. */
function booleanChoices(labels: Readonly<Record<BooleanFilterValue, string>>): readonly Choice[] {
  return booleanFilterValues.map((value) => ({ value, label: labels[value] }));
}

type Choice = { value: string; label: string };

function ChoiceField({
  id,
  label,
  name,
  placeholder,
  choices,
  selected,
}: {
  id: string;
  label: string;
  name: string;
  placeholder: string;
  choices: readonly Choice[];
  selected: string | null;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} name={name} defaultValue={selected ?? ""}>
        <option value="">{placeholder}</option>
        {choices.map((choice) => (
          <option key={choice.value} value={choice.value}>
            {choice.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * Ücret sınırı kutusu.
 *
 * `type="number"`: tarayıcı ondalık ayracı olarak **nokta** gönderiyor, yani
 * Türkçe klavyede virgülle yazılan bir tutar da sunucuya `JobSearchCriteriaDto`
 * `BigDecimal`'inin okuyabileceği biçimde gidiyor. `step` iki basamak, çünkü
 * `jobs.salary` sütunu `NUMERIC(19, 2)`.
 */
function SalaryField({
  id,
  label,
  name,
  placeholder,
  value,
}: {
  id: string;
  label: string;
  name: string;
  placeholder: string;
  value: string | null;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label} (₺)</label>
      <input
        id={id}
        name={name}
        type="number"
        inputMode="decimal"
        min="0"
        step="0.01"
        defaultValue={value ?? ""}
        placeholder={placeholder}
      />
    </div>
  );
}

/**
 * Sözlükten beslenen süzgeç kutusu.
 *
 * `fallback` seçili maddenin sözlükte bulunamadığı hâlin adı. Kutu o maddeyi
 * yine de bir seçenek olarak taşıyor — yoksa tarayıcı eşleşmeyen seçimi ilk
 * seçeneğe düşürür ve gönderim kullanıcının süzgecini sessizce silerdi
 * (`referenceFieldOptions`).
 */
function ReferenceField({
  id,
  label,
  name,
  placeholder,
  options,
  selected,
  fallback,
}: {
  id: string;
  label: string;
  name: string;
  placeholder: string;
  options: readonly ReferenceOption[];
  selected: string | null;
  fallback: string;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} name={name} defaultValue={selected ?? ""}>
        <option value="">{placeholder}</option>
        {referenceFieldOptions(options, selected, fallback).map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * Sonuç listesi.
 *
 * Boş sonuç bir hata değil: sunucu 200 ve boş bir `content` dizisiyle dönüyor.
 * Ama boşluğun **üç** ayrı sebebi var ve üçü ayrı metin yazıyor, çünkü
 * kullanıcının yapabileceği şey de üç ayrı şey: sitede hiç ilan yoksa
 * yapılacak bir şey yok, süzgeç fazla darsa gevşetilir, istenen sayfa
 * numarası listenin dışındaysa var olan bir sayfaya dönülür. Tek bir metin
 * yazmak, ikinci ve üçüncü durumdaki kullanıcıya sitenin boş olduğunu
 * öğretirdi.
 *
 * Süzgeçli boşlukta metin **hangi** süzgeçlerin daralttığını da yazıyor. Sabit
 * bir cümle ("başka bir il ya da kategori seçebilirsin") on bir süzgecin
 * ikisini tanıyordu ve gerisinde yanlış yere baktırıyordu: ters bir ücret
 * aralığında daraltan şey ne il ne kategori. Liste `activeJobFilters`'tan
 * geliyor, yani rozet şeridiyle aynı sözcükler.
 */
export function JobResultList({
  jobs,
  query,
  options,
}: {
  jobs: JobSearchPage;
  query: JobSearchQuery;
  options: JobFilterOptions;
}) {
  if (isPageOutOfRange(jobs)) {
    const lastPage = lastJobPage(jobs);
    return (
      <EmptyState kind="jobPageOutOfRange">
        <Link className="text-link" href={jobSearchHref({ ...query, page: lastPage })}>
          Son sayfaya dön ({lastPage}. sayfa)
        </Link>
      </EmptyState>
    );
  }

  if (jobs.content.length === 0) {
    // Hangi metnin yazılacağına rozet listesinin **kendisi** karar veriyor,
    // ayrı bir `hasJobFilters` çağrısı değil: iki soru da "seçili bir süzgeç
    // var mı" ve ikisi ayrı okunsaydı ekran "bu süzgeçlere uyan ilan yok" deyip
    // altında hiçbir süzgeç sayamayacağı bir hâle düşebilirdi.
    const filters = activeJobFilters(query, options);
    if (filters.length === 0) return <EmptyState kind="jobs" />;

    return (
      <EmptyState kind="jobSearch">
        <p className="state-filters">
          Şu an açık olanlar: {filters.map((filter) => filter.label).join(" · ")}
        </p>
      </EmptyState>
    );
  }

  return (
    <>
      <p className="job-result-count" aria-live="polite">
        {jobs.totalElements} ilan bulundu
      </p>
      <ul className="job-grid">
        {jobs.content.map((job) => (
          <li key={job.id}>
            <JobCard job={job} />
          </li>
        ))}
      </ul>
    </>
  );
}

/**
 * Sayfalama.
 *
 * Bağlantılar gerçek `<a href>`: JavaScript kapalı bir tarayıcı da, bir arama
 * motoru da ikinci sayfaya geçebilmeli. Bir düğme + istemci durumu ikisini de
 * kapatırdı ve liste tek sayfadan ibaret kalırdı.
 *
 * Bekleme göstergesi bağlantının **içinde** duruyor (`LinkPending`): rotanın
 * yanına bir `loading.tsx` konsaydı Next bütün sayfayı bir Suspense sınırına
 * alır ve ilanlar ilk HTML'de görünür olmaktan çıkardı.
 */
export function JobPagination({ jobs, query }: { jobs: JobSearchPage; query: JobSearchQuery }) {
  // Menzil dışı sayfada şerit hiç çizilmiyor: "Sayfa 999 / 3" bir konum değil
  // ve "Önceki sayfa" 998'e giderdi — o da menzil dışı. Listeye dönüş yolunu
  // boş durum kartı veriyor, gerçek bir sayfaya işaret ederek.
  if (jobs.totalPages <= 1 || isPageOutOfRange(jobs)) return null;

  // Kullanıcıya 1 tabanlı sayı gösteriliyor; `PageDto.page` 0 tabanlı geliyor.
  const current = jobs.page + 1;

  return (
    <nav className="job-pagination" aria-label="İlan sayfaları">
      {jobs.first ? (
        <span />
      ) : (
        <Link href={jobSearchHref({ ...query, page: current - 1 })} rel="prev">
          Önceki sayfa
          <LinkPending />
        </Link>
      )}
      <span>
        Sayfa {current} / {jobs.totalPages}
      </span>
      {jobs.last ? (
        <span />
      ) : (
        <Link href={jobSearchHref({ ...query, page: current + 1 })} rel="next">
          Sonraki sayfa
          <LinkPending />
        </Link>
      )}
    </nav>
  );
}

/** Süzgeç ve sayfa birlikte taşınıyor: sayfa değişince süzgeç düşmemeli. */
export function jobSearchHref(query: JobSearchQuery): string {
  const params = jobSearchParams(query);
  return params.size === 0 ? publicJobsPath : `${publicJobsPath}?${params}`;
}

function JobCard({ job }: { job: JobSummary }) {
  const titleId = `ilan-${job.id}`;
  const cover = safeImageUrl(job.coverImageUrl);

  return (
    <article className="job-card" aria-labelledby={titleId}>
      {cover === null ? null : (
        /*
          `next/image` değil düz `<img>`: `next.config.ts` içinde `images`
          bloğu yok ve kapak görselleri backend'in depolama kökeninden geliyor
          (`StorageUrlResolver`), yani optimize edici onları reddederdi.
          Adres backend'den geldiği için `safeImageUrl` kapısından geçiyor.
        */
        // eslint-disable-next-line @next/next/no-img-element
        <img className="job-card-cover" src={cover} alt="" loading="lazy" decoding="async" />
      )}

      <div className="job-card-body">
        <p className="job-card-kicker">
          {[job.categoryName, employerLabel(job)].filter(Boolean).join(" · ")}
        </p>

        <h2 id={titleId}>
          {/*
            Bekleme göstergesi sayfalama bağlantısındaki gerekçenin aynısıyla
            burada: ilan ayrıntısının yanında `loading.tsx` **yok**
            (is-koala/koala-web#94), yani tıklamayla sunucu yanıtı arasındaki
            boşluğu dolduracak bir iskelet de yok. `LinkPending` o boşluğu
            sayfayı bir Suspense sınırına sokmadan dolduruyor.
          */}
          <Link className="text-link" href={publicJobPath(job.id)}>
            {job.title}
            <LinkPending />
          </Link>
        </h2>

        <dl className="job-card-facts">
          <Fact label="Konum" value={locationLabel(job)} />
          <Fact label="İş tarihi" value={formatJobDate(job.startsAt)} />
          <Fact label="Ücret" value={payoutLabel(job)} />
          {job.type === "UNKNOWN" ? null : <Fact label="Tür" value={jobTypeLabels[job.type]} />}
        </dl>

        <JobBadges job={job} />
      </div>
    </article>
  );
}

function Fact({ label, value }: { label: string; value: string | null }) {
  if (value === null) return null;
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function JobBadges({ job }: { job: JobSummary }) {
  const badges = [
    job.insuranceRequired ? "Sigortalı çalışma" : null,
    job.experienceRequired ? "Deneyim isteniyor" : null,
  ].filter((badge): badge is string => badge !== null);

  if (badges.length === 0) return null;

  return (
    <ul className="job-card-badges">
      {badges.map((badge) => (
        <li key={badge}>{badge}</li>
      ))}
    </ul>
  );
}

/**
 * Kartın konum satırı.
 *
 * Yalnız il ve ilçe yazılıyor; `latitude`/`longitude` ekrana **hiç** girmiyor.
 * ADR-0003 gereği anonim ziyaretçiye giden koordinat iki ondalığa yuvarlanmış
 * bir bölge ve `addressPrecision` bunu söylüyor — o değeri kesin bir konum
 * gibi çizmek, gizlenmek üzere bulanıklaştırılmış bir adresi kesinmiş gibi
 * sunmak olurdu. Kesinlik `EXACT` değilken kullanıcıya da yazılı olarak
 * söyleniyor, çünkü "Kadıköy, İstanbul" tek başına tam adres sanılabilir.
 */
function locationLabel(job: JobSummary): string | null {
  const place = [job.districtName, job.cityName].filter(Boolean).join(", ");
  if (!place) return null;
  return job.addressPrecision === "EXACT" ? place : `${place} (yaklaşık)`;
}

/**
 * Kartın ücreti.
 *
 * Kaynak `pricing` anlık görüntüsü, `salary` değil: ADR-0002 fiyatı ilan
 * yayımlandığında donduruyor ve iki alan ayrışabilir; ekranda kilitlenmiş olan
 * durmalı. Tutar dize olarak biçimlendiriliyor, `Number`'a hiç çevrilmiyor.
 */
function payoutLabel(job: JobSummary): string | null {
  if (job.workerPayout === null || job.currency === null) return null;
  const amount = formatMoney(job.workerPayout, job.currency);
  const unit = salaryTypeLabels[job.salaryType];
  return unit ? `${amount} / ${unit}` : amount;
}

function employerLabel(job: JobSummary): string | null {
  if (job.employerType === "COMPANY") return job.companyName ?? "Şirket ilanı";
  if (job.employerType === "INDIVIDUAL") return "Bireysel ilan";
  return null;
}
