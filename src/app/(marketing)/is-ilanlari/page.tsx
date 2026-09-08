import type { Metadata } from "next";
import { unstable_rethrow } from "next/navigation";

import { JobPagination, JobResultList, JobSearchForm } from "@/components/job-search";
import { ErrorState } from "@/components/states";
import {
  defaultJobSort,
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
 * `pageMetadata` tek bir `path` alıp tek bir canonical üretiyor ve bu, sonsuz
 * sayıda süzgeç kombinasyonu için yetmiyor. Karar iki parçalı:
 *
 * - **Süzgeçsiz** sayfalar (`/is-ilanlari`, `?sayfa=2`) indekslenir ve her biri
 *   kendi canonical'ını taşır. Sayfa 2 sayfa 1'in kopyası değil, ayrı bir
 *   ilan kümesi; birinin canonical'ını öbürüne çevirmek onu indeksten düşürürdü.
 * - **Süzgeçli** URL'ler `noindex, follow` alır ve canonical **taşımaz**. Bir
 *   arama motoru için noindex ile canonical çelişen iki sinyal; ikisini
 *   birlikte göndermek hangisine uyacağını belirsiz bırakır. `follow`
 *   kalıyor ki süzgeçli bir sayfadaki ilan bağlantıları yine taransın.
 */
export async function generateMetadata({ searchParams }: JobsPageProps): Promise<Metadata> {
  const query = parseJobSearchParams(await searchParams);
  const pageTitle = query.page > 1 ? `${title} – Sayfa ${query.page}` : title;

  if (hasJobFilters(query)) {
    return { title: pageTitle, description, robots: { index: false, follow: true } };
  }

  return pageMetadata(pageTitle, description, canonicalPath(query));
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
 * **Süzgeçler bu fonksiyona hiç uğramıyor** ve aynı akıl yürütmenin öbür ucu
 * bu. `ucret-tipi`, `isveren`, `min-ucret`, `max-ucret`, `sigorta` ve
 * `deneyim` sunucuda ayrı birer `where` koşulu, yani **başka** bir ilan kümesi
 * döndürüyorlar — sıralamanın tersi. Onları da buradan silmek, süzülmüş bir
 * sayfaya "asıl adresim süzgeçsiz liste" dedirtir ve Google'ın gördüğü içerik
 * ile işaret ettiği adres ayrışırdı. Bu yüzden karar yukarıda veriliyor:
 * `hasJobFilters` doğruysa sayfa `noindex, follow` alıp canonical'sız kalıyor
 * ve `canonicalPath` çağrılmıyor bile. Gerekçenin karşılığı
 * `hasJobFilters`'ın kendi yorumunda yazılı.
 */
function canonicalPath(query: JobSearchQuery): string {
  const params = jobSearchParams({ ...query, sort: defaultJobSort });
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
          <JobResultList jobs={result.jobs} query={query} />
          <JobPagination jobs={result.jobs} query={query} />
        </>
      )}
    </section>
  );
}

const emptyFilterOptions = { categories: [], cities: [], districts: [] } as const;
