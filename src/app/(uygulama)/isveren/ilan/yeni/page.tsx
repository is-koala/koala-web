import type { Metadata } from "next";

import {
  IndividualJobForm,
  type JobFormData,
  type JobFormTemplate,
} from "@/components/individual-job-form";
import { newIndividualJobPath } from "@/lib/app-routes";
import type { JobCategory } from "@/lib/job-posting";
import { failureView } from "@/server/form";
import { fetchJobCategories, fetchJobTemplates, type JobTemplate } from "@/server/jobs/jobs";
import { currentGates } from "@/server/session/gates";

import { ShellGate } from "../../../shell";

import { publishIndividualJobAction, quotePriceAction } from "./actions";

export const metadata: Metadata = {
  title: "Yeni ilan",
  robots: { index: false, follow: false },
};

/**
 * Bireysel ilan açma sayfası.
 *
 * Kapısını `ShellGate` ile kendisi sarıyor, layout'tan miras almıyor
 * (`AGENTS.md`). Bölümün bildirdiği kapı `employerRole` ve engelleyici kip:
 * işveren olmayan hesapta form **hiç çizilmiyor**, çünkü rol kayıt anında
 * yazılıp geri alınamıyor ve doldurulacak formun sonunda kesin bir 403 var.
 */
export default async function Page() {
  return (
    <ShellGate shell="employer" href={newIndividualJobPath}>
      <NewIndividualJobPanel />
    </ShellGate>
  );
}

/**
 * Formun verisi.
 *
 * Ayrı bir bileşen, çünkü kapı kapalıyken hiç çalışmamalı: kapı sayfanın
 * gövdesinde bir `if` olsaydı bu iki çağrı kullanıcının göremeyeceği bir
 * ekran için yapılırdı.
 */
export async function NewIndividualJobPanel() {
  const { gates } = await currentGates();
  const [categories, templates] = await Promise.all([
    load<readonly JobCategory[]>(fetchJobCategories()),
    load<readonly JobTemplate[]>(fetchJobTemplates()),
  ]);

  // `individualJob` kapısı iki koşulu birlikte taşıyor; rol zaten `ShellGate`
  // tarafından kapatıldığı için buraya kalan tek eksik kimlik doğrulaması.
  const verdict = gates?.individualJob;
  const blocked = verdict === undefined || verdict.open ? [] : verdict.blockedBy;

  return (
    <section className="app-panel">
      <p className="eyebrow">İşveren</p>
      <h1>Yeni bireysel ilan</h1>
      <p className="lede">
        Kendi adına ilan açıyorsun. Şirket adına ilan açmak istiyorsan şirket ilanlarını
        kullanman gerekiyor.
      </p>

      <IndividualJobForm
        categories={categories}
        templates={toFormTemplates(templates)}
        blocked={blocked}
        action={publishIndividualJobAction}
        quote={quotePriceAction}
      />
    </section>
  );
}

async function load<T>(request: Promise<T>): Promise<JobFormData<T>> {
  try {
    return { status: "ready", data: await request };
  } catch (error) {
    return { status: "error", ...failureView(error) };
  }
}

/**
 * Şablonu formun okuduğu düz metinlere çevirir.
 *
 * `JobTemplateDto` sayı ve mantık alanları taşıyor, form ise input değerleri:
 * dönüşüm burada bir kez yapılıyor ki bileşen iki ayrı biçimi bilmek zorunda
 * kalmasın. Tarih ve adres yok — backend şablona ikisini de kopyalamıyor.
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
