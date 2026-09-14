"use client";

import dynamic from "next/dynamic";

import { googleMapsJavaScriptKey } from "@/address/maps";
import type { GeoPoint } from "@/jobs/distance";
import { jobSearchParams, type JobSearchQuery, type JobSummary } from "@/jobs/search";
import { publicJobsPath } from "@/lib/app-routes";

/**
 * Harita görünümünün kabuğu: anahtar varsa haritayı **ayrı parça** olarak
 * indirir, yoksa liste görünümüne bağlanan sabit bir yer tutucu çizer.
 *
 * Anahtar `NEXT_PUBLIC_GOOGLE_MAPS_JS_KEY` derleme anında donuyor (AGENTS.md
 * "Sır yönetimi"); boş anahtar hiçbir ortamı kırmıyor — is-koala/koala-web#12
 * anahtarı ekleyene kadar harita düğmesi bu yer tutucuya açılıyor ve
 * ilanlar aşağıda mesafeyle listelenmeye devam ediyor.
 */
const JobMap = dynamic(() => import("./job-map").then((module) => module.JobMap), {
  ssr: false,
  loading: () => (
    <div className="job-map">
      <p className="job-map-status" role="status">Harita hazırlanıyor…</p>
    </div>
  ),
});

export function JobMapView({
  jobs,
  query,
  center,
  mapsKey = googleMapsJavaScriptKey(),
}: {
  jobs: readonly JobSummary[];
  query: JobSearchQuery;
  center: GeoPoint;
  mapsKey?: string;
}) {
  if (!mapsKey.trim()) {
    return (
      <div className="job-map job-map-placeholder" role="status">
        <h2>Harita bu ortamda kapalı</h2>
        <p>
          İlanlar aşağıda konumuna uzaklıklarıyla listeleniyor; &quot;Önce en yakın&quot; sıralamasını
          seçebilirsin.
        </p>
      </div>
    );
  }

  return (
    <JobMap
      jobs={jobs}
      center={center}
      mapsKey={mapsKey}
      searchHrefFor={(next) => {
        const params = jobSearchParams({ ...query, location: next, page: 1 });
        return `${publicJobsPath}?${params}`;
      }}
    />
  );
}
