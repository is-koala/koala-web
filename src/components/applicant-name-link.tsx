import Link from "next/link";

import { applicantDossierPath } from "@/lib/app-routes";
import { isUuid } from "@/lib/identifiers";

/**
 * Aday dosyasına bağlantı — aday kartı, yetenek havuzu satırı ve atamanın
 * işçi kartı aynı kuralı okuyor (is-koala/koala-web#166): kimlik UUID ise
 * `/isveren/aday/{id}`, değilse bağlantı yok. Üç yerde elle kurulan `Link`
 * kural değiştiğinde birini geride bırakırdı.
 *
 * `label` verilmişse eylem bağlantısı ("Aday dosyasını aç"); kimliksiz
 * kayıtta hiç çizilmez. Verilmemişse adın kendisi bağlantı olur ve
 * kimliksiz kayıtta ad düz yazılır — kart adı hiçbir hâlde kaybetmez.
 *
 * `"use client"` yok: sunucu sayfası ve istemci listeleri aynı bileşeni
 * kullanıyor; içinde durum ya da olay yok.
 */
export function ApplicantNameLink({
  workerId,
  name,
  label,
}: {
  workerId: string;
  name: string;
  label?: string;
}) {
  if (!isUuid(workerId)) return label ? null : <>{name}</>;
  return (
    <Link className={label ? "text-link" : "applicant-name-link"} href={applicantDossierPath(workerId)}>
      {label ?? name}
    </Link>
  );
}
