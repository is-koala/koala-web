import type { Metadata } from "next";
import { notFound, unstable_rethrow } from "next/navigation";

import { JobDetailState, type JobDetailLoadState } from "@/components/job-detail-state";
import type { JobDetail } from "@/jobs/contract";
import { jobPostingJsonLd } from "@/jobs/job-posting-schema";
import { publicJobPath } from "@/lib/app-routes";
import { publicEnvironment } from "@/lib/env";
import { isUuid } from "@/lib/identifiers";
import { pageMetadata } from "@/lib/metadata";
import { site } from "@/lib/site";
import { failureView } from "@/server/form";
import { readJobDetail } from "@/server/jobs/public-jobs";

import { applyToJobAction } from "./actions";

/**
 * İlan içeriği yayımlandığında donduruluyor (ADR-0002) ve sonradan çok az
 * değişiyor; buna karşılık sayfa arama motorunun geldiği yer, yani her
 * görüntülemede backend'e gitmesi hem gecikme hem `PUBLIC` hız sınırı
 * kovasında gereksiz bir yük. Beş dakika, bayatlayabilecek tek şeyi —
 * `hiredCount` sayacını ve ilanın kapanmasını — kabul edilebilir bir
 * pencerede tutuyor.
 *
 * Rota bunu ancak istek-zamanı API'si okumadığı için alabiliyor:
 * `readJobDetail` çerez ve başlık okumuyor (`publicReaderCaller`). Sayfaya
 * `cookies()` okuyan bir çağrı eklemek `revalidate`'i sessizce iptal eder ve
 * sayfa yeniden her istekte üretilir.
 */
export const revalidate = 300;

/**
 * Boş dizi ISR'ı **açan** şey, kapatan değil.
 *
 * Next'in kendi belgesi (`generate-static-params.md`, "All paths at runtime"):
 * *"You must always return an array from `generateStaticParams`, even if it's
 * empty. Otherwise, the route will be dynamically rendered."* Yani
 * `revalidate = 300` tek başına yetmiyor; bu fonksiyon olmadan rota `ƒ`
 * kalıyor ve beş dakikalık pencere hiç uygulanmıyor. Bunu kaynak koda bakarak
 * anlamak mümkün değil — `next build` çıktısındaki rota tablosunda görülüyor.
 *
 * Dizi **boş**, çünkü build anında hangi ilanların açık olduğu bilinmiyor ve
 * hepsini önceden üretmek build süresini backend'in ilan sayısına bağlardı.
 * `dynamicParams` varsayılan olarak `true`: ilk ziyaret edilen ilan o anda
 * üretiliyor ve sonraki beş dakika önbellekten geliyor.
 */
export function generateStaticParams(): { jobId: string }[] {
  return [];
}

type JobDetailPageProps = {
  /** Next 16'da `params` bir `Promise`; `await` edilmeden okunamaz. */
  params: Promise<{ jobId: string }>;
};

/**
 * İlan sayfasının metadata'sı.
 *
 * Başlık ilçe ve ili taşıyor çünkü Türkçe iş aramasının neredeyse tamamı
 * konumla yapılıyor; marka son eki kökteki `title.template`'ten geliyor, yani
 * ayrı bir ayraç kullanmıyor ve site geneliyle aynı biçimde bitiyor.
 *
 * **Kapalı, iptal edilmiş ya da durumu okunamayan ilan `noindex` alıyor.**
 * Google süresi geçmiş ilan sayfalarını cezalandırıyor; sayfa erişilebilir
 * kalıyor (paylaşılmış bağlantı ölmüyor) ama indekse girmiyor. Aynı kararı
 * yapısal veri tarafında `jobPostingJsonLd` veriyor.
 *
 * Okunamayan ilan burada `notFound()` çağırmıyor: metadata ile sayfa aynı
 * `readJobDetail`'i paylaşıyor (`React.cache`) ve 404 kararını tek yerde,
 * sayfanın kendisinde vermek onu iki koldan bakılan bir kural olmaktan
 * çıkarıyor.
 */
export async function generateMetadata({ params }: JobDetailPageProps): Promise<Metadata> {
  const { jobId } = await params;
  const job = isUuid(jobId) ? await readJobDetail(jobId).catch(ignoreFailure) : null;
  if (job === null) return { title: "İlan bulunamadı", robots: { index: false, follow: true } };

  const metadata = pageMetadata(
    [job.title, locationSuffix(job)].filter(Boolean).join(" — "),
    describe(job),
    publicJobPath(job.id),
    coverImageUrl(job),
  );

  return job.status === "OPEN"
    ? metadata
    : { ...metadata, robots: { index: false, follow: true } };
}

export default async function Page({ params }: JobDetailPageProps) {
  const { jobId } = await params;
  // Kimliği olmayan adres bir ilan değil; backend'e gitmeden 404.
  if (!isUuid(jobId)) notFound();

  const result = await loadJob(jobId);

  /*
   * `notFound()` bilerek `try` bloğunun **dışında**. Next onu bir istisnayla
   * gerçekleştiriyor; aynı `try` içinde çağrılsaydı kendi `catch`'imize
   * düşerdi ve 404 sessizce bir hata ekranına dönerdi. `unstable_rethrow` bu
   * istisnayı tanıyıp geçiriyor, ama kararı kapsam dışına almak o inceliğe
   * hiç yaslanmamak demek.
   *
   * Boş gövde ile 404 aynı şey: ilan yok. Sayfanın kendi "bulunamadı"
   * kartını 200 ile çizmek yerine Next'in 404'ü veriliyor — yanındaki
   * `loading.tsx` kaldırıldığı için durum artık 200'de kilitlenmiyor
   * (`AGENTS.md` § "Yapı", is-koala/koala-web#94).
   */
  if (result.job === null && (result.failure === null || result.failure.httpStatus === 404)) {
    notFound();
  }

  const state: JobDetailLoadState =
    result.job === null
      ? {
          status: "error",
          errorCode: result.failure?.errorCode ?? "UNEXPECTED",
          httpStatus: result.failure?.httpStatus ?? 500,
        }
      : { status: "ready", job: result.job, applyAction: applyToJobAction.bind(null, jobId) };

  const jsonLd =
    result.job === null ? null : jobPostingJsonLd(result.job, canonicalUrl(result.job.id));

  return (
    <>
      {jsonLd === null ? null : (
        /*
          `<` unicode kaçışı Next'in kendi JSON-LD rehberinden: ilan başlığı
          ve açıklaması işverenin yazdığı serbest metin, ve kaçış olmadan
          içine gömülü bir `</script>` etiketten çıkıp sayfaya kod
          düşürebilirdi.
        */
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replaceAll("<", "\\u003c") }}
        />
      )}
      <JobDetailState state={state} />
    </>
  );
}

/**
 * İlanı okur ve başarısızlığı bir değere çevirir.
 *
 * `try` bu fonksiyonun içinde kalıyor ki sayfanın 404 kararı istisna
 * akışından tamamen ayrılsın; çağıran yalnız iki alana bakıyor.
 */
async function loadJob(
  jobId: string,
): Promise<{ job: JobDetail | null; failure: ReturnType<typeof failureView> | null }> {
  try {
    return { job: await readJobDetail(jobId), failure: null };
  } catch (error) {
    unstable_rethrow(error);
    return { job: null, failure: failureView(error) };
  }
}

/** "İlçe, İl"; ikisi de yoksa boş. */
function locationSuffix(job: JobDetail): string {
  return [job.districtName, job.cityName].filter(Boolean).join(", ");
}

/**
 * Arama sonucunda görünecek açıklama.
 *
 * İlan açıklaması yoksa başlık ve konumdan bir cümle kuruluyor: boş bir
 * `description` sonuç kartını arama motorunun seçtiği rastgele bir sayfa
 * parçasına bırakırdı.
 */
function describe(job: JobDetail): string {
  const summary = job.description ?? job.duties;
  if (summary === null) {
    const where = locationSuffix(job);
    return `${job.title}${where ? ` — ${where}` : ""} ilanının ayrıntıları ve başvuru bilgisi ${site.name}'da.`;
  }
  return truncate(summary, descriptionLength);
}

/** Google arama sonucunda açıklamayı bu uzunluk civarında kesiyor. */
const descriptionLength = 155;

/**
 * Metni sınırın altına indirir ve kelimenin ortasında kesmez.
 *
 * Kesme noktası son boşluk: yarım bir kelime, açıklamayı okuyan insana
 * metnin bozuk olduğunu düşündürür.
 */
function truncate(value: string, limit: number): string {
  const collapsed = value.replace(/\s+/g, " ").trim();
  if (collapsed.length <= limit) return collapsed;
  const cut = collapsed.slice(0, limit);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > limit / 2 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** Galerinin kapak görseli; kapak işaretlenmemişse ilk görsel, o da yoksa `null`. */
function coverImageUrl(job: JobDetail): string | null {
  const cover = job.images.find((image) => image.cover) ?? job.images.at(0);
  return cover?.url ?? null;
}

function canonicalUrl(jobId: string): string {
  return new URL(publicJobPath(jobId), publicEnvironment().siteUrl).toString();
}

/**
 * Metadata backend hatasında sessiz kalır.
 *
 * Sayfa aynı çağrıyı kendisi de yapıyor ve hata ekranını o çiziyor; metadata
 * üretimi bir kez daha atarsa ziyaretçi ilanı hiç göremez, oysa gövde
 * çizilebilir durumda.
 */
function ignoreFailure(error: unknown): null {
  unstable_rethrow(error);
  return null;
}
