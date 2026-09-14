"use client";

import { useEffect, useId, useRef, useState } from "react";

import {
  defaultDistanceKm,
  distanceOptionsKm,
  formatGeoPoint,
  type GeoPoint,
} from "@/jobs/distance";
import { jobSearchParamNames, type JobSearchQuery } from "@/jobs/search";

/**
 * Süzgeç formunun konum parçası.
 *
 * Konum yalnız tarayıcıdan gelir (`navigator.geolocation`) ve adres çubuğuna
 * `konum=enlem,boylam` olarak yazılır; sunucu tarafında kullanıcıya dair
 * hiçbir konum saklanmıyor. Düğme JavaScript ister — formun kalanı
 * JavaScript'siz de çalışır, yalnız bu daraltma seçeneği görünmez.
 *
 * Yarıçap kutusu konum seçiliyken görünür: konumsuz yarıçap sunucuya
 * gitmiyor (`parseJobSearchParams`), yani kutuyu konumsuz göstermek hiçbir
 * şeye bağlı olmayan bir seçim sunmak olurdu.
 */
export function JobLocationFilter({ query }: { query: JobSearchQuery }) {
  const [location, setLocation] = useState<GeoPoint | null>(query.location);
  const [status, setStatus] = useState<"idle" | "locating" | "denied" | "unavailable">("idle");
  const distanceId = useId();
  const containerRef = useRef<HTMLDivElement>(null);

  const pendingSubmit = useRef(false);

  /**
   * Konum alınır alınmaz form gönderilir: kullanıcı "konumumu kullan" dedi,
   * ikinci bir "süz" tıklaması sormadığı bir soru. Gizli alan bir sonraki
   * commit'te DOM'a giriyor; gönderim bu yüzden bir etki olarak, o commit'ten
   * sonra tetikleniyor. Bayrak ref'te: gönderim bir render tetiklememeli.
   */
  useEffect(() => {
    if (!pendingSubmit.current) return;
    pendingSubmit.current = false;
    containerRef.current?.closest("form")?.requestSubmit();
  }, [location]);

  const locate = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unavailable");
      return;
    }
    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        pendingSubmit.current = true;
        setStatus("idle");
      },
      (error) => {
        setStatus(error.code === error.PERMISSION_DENIED ? "denied" : "unavailable");
      },
      { enableHighAccuracy: false, maximumAge: 300_000, timeout: 10_000 },
    );
  };

  return (
    <div className="job-location-filter" ref={containerRef}>
      {location === null ? (
        <button
          type="button"
          className="button button-secondary button-small"
          onClick={locate}
          disabled={status === "locating"}
        >
          {status === "locating" ? "Konum alınıyor…" : "Konumumu kullan"}
        </button>
      ) : (
        <>
          <input type="hidden" name={jobSearchParamNames.location} value={formatGeoPoint(location)} />
          <div className="field">
            <label htmlFor={distanceId}>Uzaklık</label>
            <select
              id={distanceId}
              name={jobSearchParamNames.distance}
              defaultValue={String(query.distanceKm ?? defaultDistanceKm)}
            >
              {distanceOptionsKm.map((km) => (
                <option key={km} value={km}>{`${km} km çevre`}</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="button button-secondary button-small"
            onClick={() => setLocation(null)}
          >
            Konumu kaldır
          </button>
        </>
      )}
      {status === "denied" ? (
        <p className="field-hint" role="status">
          Konum izni verilmedi. İl ve ilçe seçerek de daraltabilirsin.
        </p>
      ) : null}
      {status === "unavailable" ? (
        <p className="field-hint" role="status">
          Konum alınamadı. İl ve ilçe seçerek de daraltabilirsin.
        </p>
      ) : null}
    </div>
  );
}
