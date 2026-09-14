"use client";

import { useEffect, useRef, useState } from "react";

import { istanbulServiceArea, mapCameraLimits } from "@/address/contract";
import { ensureGoogleMapsScript } from "@/address/maps";
import { formatGeoPoint, type GeoPoint } from "@/jobs/distance";
import type { JobSummary } from "@/jobs/search";
import { publicJobPath } from "@/lib/app-routes";

export type JobMapProps = {
  jobs: readonly JobSummary[];
  center: GeoPoint;
  mapsKey: string;
  /** Kullanıcı haritayı kaydırıp "bu bölgede ara" dediğinde gidilecek adres. */
  searchHrefFor: (center: GeoPoint) => string;
};

/**
 * İlanların haritası.
 *
 * Yalnız `gorunum=harita` ve anahtar varken yüklenir (`JobMapView` bunu
 * `next/dynamic` ile ayırıyor); liste sayfası Maps JavaScript'i hiç indirmez
 * (`tests/image-and-maps-budget.test.ts`). İşaretçiler ADR-0003'ün verdiği
 * yaklaşık konumda duruyor — bilgi penceresi bunu söylüyor.
 *
 * Harita **kendi başına süzmüyor**: kullanıcı kaydırıp düğmeye basınca adres
 * çubuğu yeni merkezle yeniden yazılıyor ve sunucu sayfayı yeniden çiziyor.
 * Böylece paylaşılan bağlantı aynı bölgeyi açıyor ve harita ile liste hiçbir
 * zaman farklı ilanları göstermiyor.
 */
export function JobMap({ jobs, center, mapsKey, searchHrefFor }: JobMapProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const [viewport, setViewport] = useState<GeoPoint>(center);
  const [moved, setMoved] = useState(false);

  useEffect(() => {
    const element = canvasRef.current;
    if (!element) return;
    let cancelled = false;
    let cleanup: (() => void) | null = null;

    ensureGoogleMapsScript(mapsKey)
      .then(() => {
        if (cancelled || !element.isConnected) return;
        const maps = (window as GoogleMapsWindow).google?.maps;
        if (!maps) throw new Error("Maps JavaScript API yüklenemedi.");

        const map = new maps.Map(element, {
          center: { lat: center.latitude, lng: center.longitude },
          zoom: 13,
          minZoom: mapCameraLimits.minZoom,
          maxZoom: mapCameraLimits.maxZoom,
          disableDefaultUI: true,
          zoomControl: true,
          clickableIcons: false,
          gestureHandling: "greedy",
          restriction: { latLngBounds: istanbulServiceArea, strictBounds: false },
        });
        const info = new maps.InfoWindow();
        const markers = jobs.flatMap((job) => {
          if (job.latitude === null || job.longitude === null) return [];
          const marker = new maps.Marker({
            map,
            position: { lat: job.latitude, lng: job.longitude },
            title: job.title,
          });
          marker.addListener("click", () => {
            info.setContent(infoContent(job));
            info.open({ map, anchor: marker });
          });
          return [marker];
        });
        const idle = map.addListener("idle", () => {
          const next = map.getCenter();
          if (!next) return;
          const point = { latitude: next.lat(), longitude: next.lng() };
          setViewport(point);
          setMoved(formatGeoPoint(point) !== formatGeoPoint(center));
        });

        cleanup = () => {
          maps.event.removeListener(idle);
          for (const marker of markers) marker.setMap(null);
          info.close();
        };
        setState("ready");
      })
      .catch(() => {
        if (!cancelled) setState("failed");
      });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [jobs, center, mapsKey]);

  return (
    <div className="job-map">
      <div
        ref={canvasRef}
        className="job-map-canvas"
        role="img"
        aria-label={`İlan haritası, ${jobs.length} ilan, merkez ${formatGeoPoint(center)}`}
      />
      {state === "loading" ? <p className="job-map-status" role="status">Harita yükleniyor…</p> : null}
      {state === "failed" ? (
        <p className="job-map-status" role="status">
          Harita yüklenemedi. Aşağıdaki liste aynı ilanları gösteriyor.
        </p>
      ) : null}
      {state === "ready" && moved ? (
        <a className="button button-primary button-small job-map-search" href={searchHrefFor(viewport)}>
          Bu bölgede ara
        </a>
      ) : null}
      <p className="muted address-attribution">Harita verileri: Google Maps</p>
    </div>
  );
}

/**
 * Bilgi penceresi içeriği DOM olarak kuruluyor, HTML dizesi değil: başlık
 * backend'den geliyor ve bir dize şablonu onu işaretleme olarak yorumlatırdı.
 */
function infoContent(job: JobSummary): HTMLElement {
  const root = document.createElement("div");
  root.className = "job-map-info";
  const link = document.createElement("a");
  link.href = publicJobPath(job.id);
  link.textContent = job.title;
  const place = document.createElement("p");
  place.textContent = [
    [job.districtName, job.cityName].filter(Boolean).join(", "),
    job.addressPrecision === "EXACT" ? null : "yaklaşık konum",
  ]
    .filter(Boolean)
    .join(" · ");
  root.append(link, place);
  return root;
}

type LatLng = { lat(): number; lng(): number };
type Listener = unknown;
type GoogleMap = {
  getCenter(): LatLng | undefined;
  addListener(event: string, handler: () => void): Listener;
};
type GoogleMarker = {
  addListener(event: string, handler: () => void): Listener;
  setMap(map: GoogleMap | null): void;
};
type GoogleMapsWindow = Window & {
  google?: {
    maps?: {
      Map: new (element: HTMLElement, options: Record<string, unknown>) => GoogleMap;
      Marker: new (options: Record<string, unknown>) => GoogleMarker;
      InfoWindow: new () => {
        setContent(content: HTMLElement): void;
        open(options: { map: GoogleMap; anchor: GoogleMarker }): void;
        close(): void;
      };
      event: { removeListener(listener: Listener): void };
    };
  };
};
