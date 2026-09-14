import type { Metadata } from "next";
import { unstable_rethrow } from "next/navigation";

import { defaultMapCenter } from "@/address/contract";
import { JobMapView } from "@/components/job-map-view";
import { JobPagination, JobResultList, JobSearchForm } from "@/components/job-search";
import { ErrorState } from "@/components/states";
import {
  defaultJobSort,
  mapJobView,
  hasJobFilters,
  jobSearchParams,
  parseJobSearchParams,
  type JobSearchQuery,
  type RawSearchParams,
} from "@/jobs/search";
import { publicJobsPath } from "@/lib/app-routes";
import { pageMetadata } from "@/lib/metadata";
import { failureView } from "@/server/form";
import { readJobFilterOptions, searchJobs } from "@/server/jobs/search";

const title = "İş İlanları";
const description =
  "Koala'daki günlük ve kısa süreli iş ilanlarını il, ilçe, kategori ve türe göre ara.";

type JobsPageProps = {
  /** Next 16'da `searchParams` bir `Promise`; `await` edilmeden okunamaz. */
  searchParams: Promise<RawSearchParams>;
};

/**
 * Sayfalı ve süzgeçli listenin metadata'sı.
 *
 * Ham sorgu dizesi aynı süzgeç kümesini farklı sırada, varsayılan değerlerle
 * ya da geçersiz değerlerle yazabiliyor. Canonical her iki dalda da parse
 * edilmiş `JobSearchQuery` üzerinden kuruluyor; böylece tek içerik tek adrese
 * iniyor. İndeksleme kararı ayrıca veriliyor:
 *
 * - **Süzgeçsiz** sayfalar (`/is-ilanlari`, `?sayfa=2`) indekslenir ve her biri
 *   kendi canonical'ını taşır. Sayfa 2 sayfa 1'in kopyası değil, ayrı bir
 *   ilan kümesi; birinin canonical'ını öbürüne çevirmek onu indeksten düşürürdü.
 * - **Süzgeçli** URL'ler kendi normalize edilmiş canonical'ını ve
 *   `noindex, follow` taşır. Canonical'ın yokluğu issue #22'deki "her sayfada"
 *   sözleşmesini bozuyordu; `follow` kalıyor ki ilan bağlantıları taransın.
 */
export async function generateMetadata({ searchParams }: JobsPageProps): Promise<Metadata> {
  const query = parseJobSearchParams(await searchParams);
  const pageTitle = query.page > 1 ? `${title} – Sayfa ${query.page}` : title;
  const metadata = pageMetadata(pageTitle, description, canonicalPath(query));

  if (hasJobFilters(query)) {
    return { ...metadata, robots: { index: false, follow: true } };
  }

  return metadata;
}

/**
 * Süzgeçsiz canonical yalnız **sayfa** numarasını taşır.
 *
 * Sayfa ile sıralama burada ters yönde karara bağlanıyor ve gerekçeleri ayrı:
 *
 * - **Sayfa kalıyor.** `?sayfa=2` sayfa 1'in kopyası değil, başka ilanlar
 *   taşıyor; canonical'ı sayfa 1'e çevirmek o ilanları indeksten düşürürdü.
 * - **Sıralama düşüyor.** Beş sıralama seçeneği aynı ilan kümesinin farklı
 *   dizilişi. `hasJobFilters` onu bilerek bir süzgeç saymıyor, yani
 *   `?sirala=ucret-artan` `noindex` almıyor; canonical de onu taşısaydı tek bir
 *   içerik beş indekslenebilir URL'ye açılırdı. Düşürülünce beşi tek adreste
 *   birleşiyor ve `hasJobFilters`'ın gerekçesi ("aynı sonuç kümesinin farklı
 *   dilimleri, ayrı bir içerik değil") indeksleme tarafında da tutuyor.
 *
 * **Süzgeçler kalıyor.** `ucret-tipi`, `isveren`, `min-ucret`, `max-ucret`,
 * `sigorta` ve `deneyim` sunucuda ayrı birer `where` koşulu, yani sıralamanın
 * tersine başka ilan kümesi döndürüyorlar. Onları silmek süzülmüş sayfaya
 * "asıl adresim süzgeçsiz liste" dedirtir; burada yalnız parser'ın tanıdığı,
 * normalize ettiği süzgeçler deterministik sırayla yazılıyor.
 */
function canonicalPath(query: JobSearchQuery): string {
  // Görünüm de sıralama gibi düşüyor: harita aynı kümenin başka bir yüzeyi.
  const params = jobSearchParams({ ...query, sort: defaultJobSort, view: "liste" });
  return params.size === 0 ? publicJobsPath : `${publicJobsPath}?${params}`;
}

export default async function Page({ searchParams }: JobsPageProps) {
  return <JobsPage searchParams={searchParams} />;
}

/**
 * Herkese açık ilan listesi.
 *
 * Sunucu bileşeni: ilanlar SSR'da çekiliyor ve HTML'e basılıyor, yani
 * JavaScript kapalıyken de görünüyorlar ve arama motoru başlıkları kaynakta
 * okuyor. `(marketing)` grubunda çünkü site başlığı ve alt bilgisi görünmeli;
 * grubun diğer sayfalarından farklı olarak statik üretilemiyor, adres
 * çubuğundaki süzgeç her istekte farklı bir sonuç kümesi demek.
 *
 * Sözlükler ile liste ayrı `try` bloklarında değil ama ayrı sonuçlar: süzgeç
 * kutuları boş kalsa bile ilanlar çizilmeli, ve liste okunamadığında da
 * kullanıcı süzgecini değiştirip yeniden deneyebilmeli.
 */
export async function JobsPage({ searchParams }: JobsPageProps) {
  const query = parseJobSearchParams(await searchParams);

  const [options, result] = await Promise.all([
    readJobFilterOptions(query.cityId).catch((error: unknown) => {
      unstable_rethrow(error);
      // Sözlük okunamazsa süzgeç kutuları boş kalır ama liste çizilmeye devam
      // eder: kullanıcının asıl geldiği şey ilanlar, süzgeç değil.
      return emptyFilterOptions;
    }),
    searchJobs(query)
      .then((jobs) => ({ jobs }))
      .catch((error: unknown) => {
        unstable_rethrow(error);
        return { failure: failureView(error) };
      }),
  ]);

  return (
    <section className="job-search">
      <header className="hero hero-compact">
        <p className="eyebrow">İlanlar</p>
        <h1>{title}</h1>
        <p className="lede">
          Yakınındaki günlük ve kısa süreli işleri gör. Başvurmak için Koala hesabınla giriş
          yapman yeterli.
        </p>
      </header>

      <JobSearchForm query={query} options={options} />

      {"failure" in result ? (
        <ErrorState errorCode={result.failure.errorCode} status={result.failure.httpStatus} />
      ) : (
        <>
          {/*
            Harita listenin **üstünde**, yerine değil: ilan bağlantıları ilk
            HTML'de kalmalı (JavaScript kapalı ziyaretçi ve arama motoru) ve
            harita yalnız aynı ilanları başka bir yüzeyde gösteriyor. Merkez
            konum süzgecinden; süzgeç yoksa hizmet alanının varsayılanı.
          */}
          {query.view === mapJobView ? (
            <JobMapView
              jobs={result.jobs.content}
              query={query}
              center={query.location ?? defaultMapCenter}
            />
          ) : null}
          <JobResultList jobs={result.jobs} query={query} options={options} />
          <JobPagination jobs={result.jobs} query={query} />
        </>
      )}
    </section>
  );
}

const emptyFilterOptions = { categories: [], cities: [], districts: [] } as const;
