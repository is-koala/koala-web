import type { Metadata } from "next";
import { notFound, unstable_rethrow } from "next/navigation";
import { Suspense } from "react";

import { EmployerGate } from "@/components/employer-gate";
import { LoadingState } from "@/components/states";
import { JobForm, type JobFormData, type JobFormTemplate } from "@/components/job-form";
import { isUuid } from "@/lib/identifiers";
import type { JobCategory } from "@/lib/job-posting";
import { quotePriceAction } from "@/app/(uygulama)/isveren/ilan/yeni/actions";
import { failureView } from "@/server/form";
import { fetchJobCategories, fetchJobTemplates, type JobTemplate } from "@/server/jobs/jobs";
import { corporateJobGate, currentGates } from "@/server/session/gates";

import { publishCompanyJobAction } from "./actions";

export const metadata: Metadata = {
  title: "Şirket adına yeni ilan",
  robots: { index: false, follow: false },
};

/**
 * Şirket adına ilan açma sayfası.
 *
 * Kapı `ShellGate` ile değil `corporateJobGate` **kararıyla** okunuyor: karar
 * adresteki şirkete bağlı ve bölüm kaydında böyle bir kapı yok. İki şirkette
 * yetkili bir kullanıcının biri onaylı biri değilse tek bir bölüm kapısı ikisi
 * için de yanlış cevap verirdi.
 *
 * Engellendiğinde form **hiç çizilmiyor** — `EmployerGate` bunu yapıyor.
 * Bireysel formda kapı forma bir prop olarak geçiyor ve form doldurulabilir
 * kalıyor, çünkü oradaki eksik (kimlik doğrulaması) kullanıcının
 * kapatabileceği bir şey. Buradaki iki eksik öyle değil: şirket onayı ekibin,
 * yetkililik başka bir yöneticinin elinde. Doldurulup reddedilen form ise tek
 * kullanımlık adres kanıtını yakardı (`candidateToken` 10 dakika yaşıyor).
 *
 * Burada `loading.tsx` yok: sayfa `notFound()` çağırıyor ve bir rota
 * seviyesinde Suspense sınırı HTTP durumunu 200'de kilitlerdi (`AGENTS.md`).
 * Yükleniyor durumu bunun yerine karar verildikten **sonra**, form verisini
 * bekleyen iç `Suspense` ile veriliyor — aynı kuralın kardeş sayfadaki hâli
 * (`../../page.tsx`).
 */
export default async function Page({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  // Kimlik adres çubuğundan geliyor; UUID olmayan bir değer hiçbir şirkete
  // karşılık gelmiyor ve backend'e sorulmuyor.
  if (!isUuid(companyId)) notFound();

  const { gates } = await currentGates();

  // Profil çözülemediyse kabuk zaten hata kartını çiziyor; bilinmeyen bir
  // durumu eksiklik gibi göstermek yanlış olurdu.
  if (gates === null) return null;

  const verdict = corporateJobGate(gates, companyId);
  const company = gates.companies.find((candidate) => candidate.companyId === companyId);

  return (
    <section className="app-panel">
      <p className="eyebrow">İşveren</p>
      <h1>{company ? `${company.companyName} adına yeni ilan` : "Şirket adına yeni ilan"}</h1>
      <p className="lede">
        Bu ilan şirket adına açılıyor. Başvurular ve ödeme de şirketin üzerinden yürür.
      </p>

      <EmployerGate blocked={verdict.open ? [] : verdict.blockedBy} action="İlanı yayımla">
        {verdict.open && company ? (
          <Suspense fallback={<LoadingState label="İlan formu yükleniyor…" />}>
            <CompanyJobFormPanel companyId={companyId} companyName={company.companyName} />
          </Suspense>
        ) : null}
      </EmployerGate>
    </section>
  );
}

/**
 * Formun verisi.
 *
 * Ayrı bir bileşen, çünkü kapı kapalıyken hiç çalışmamalı: kapı sayfanın
 * gövdesinde bir `if` olsaydı bu iki çağrı kullanıcının göremeyeceği bir ekran
 * için yapılırdı.
 */
export async function CompanyJobFormPanel({
  companyId,
  companyName,
}: {
  companyId: string;
  companyName: string;
}) {
  const [categories, templates] = await Promise.all([
    load<readonly JobCategory[]>(fetchJobCategories()),
    load<readonly JobTemplate[]>(fetchJobTemplates()),
  ]);

  return (
    <JobForm
      owner={{ kind: "company", companyId, companyName }}
      categories={categories}
      templates={toFormTemplates(templates)}
      // Kapı zaten yukarıda okundu ve kapalıysa form hiç çizilmiyor; forma
      // ikinci bir engel listesi geçmek aynı gerekçeyi iki kez yazdırırdı.
      blocked={[]}
      action={publishCompanyJobAction.bind(null, companyId)}
      quote={quotePriceAction}
    />
  );
}

async function load<T>(request: Promise<T>): Promise<JobFormData<T>> {
  try {
    return { status: "ready", data: await request };
  } catch (error) {
    unstable_rethrow(error);
    return { status: "error", ...failureView(error) };
  }
}

/**
 * Şablonu formun okuduğu düz metinlere çevirir.
 *
 * Şablonlar `GET /users/me/job-templates` ile kullanıcıya bağlı, şirkete
 * değil: `EmployerToolsController` şirket bazlı bir şablon listesi sunmuyor.
 * Yani kullanıcı kendi şablonlarını şirket ilanında da kullanabiliyor.
 */
function toFormTemplates(
  templates: JobFormData<readonly JobTemplate[]>,
): JobFormData<readonly JobFormTemplate[]> {
  if (templates.status === "error") return templates;

  return {
    status: "ready",
    data: templates.data.map((template) => ({
      id: template.id,
      templateName: template.templateName,
      categoryId: template.category?.id ?? null,
      title: template.title ?? null,
      description: template.description ?? null,
      sector: template.sector ?? null,
      position: template.position ?? null,
      duties: template.duties ?? null,
      dressCode: template.dressCode ?? null,
      type: template.type ?? null,
      salaryType: template.salaryType ?? null,
      salary: template.salary === null ? null : String(template.salary),
      minAge: template.minAge === null ? null : String(template.minAge),
      maxAge: template.maxAge === null ? null : String(template.maxAge),
      experienceRequired:
        template.experienceRequired === null ? null : String(template.experienceRequired),
    })),
  };
}
