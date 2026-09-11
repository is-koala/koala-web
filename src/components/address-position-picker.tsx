"use client";

import { useId, useState } from "react";

import {
  coordinateDecimals,
  type AddressPosition,
  type Coordinates,
  type istanbulServiceArea,
} from "@/address/contract";
import { ErrorState } from "@/components/states";

/**
 * Konum onayının sözleşmesi.
 *
 * Harita seçici bu arayüzü uygular: Maps JavaScript anahtarı yalnız karo
 * çizimi için istemciye iner, adres çözümleme yine `suggestFromPosition` /
 * `lookupFromPosition` üzerinden backend'de kalır. `confirmPosition`
 * kullanıcının kendi onayıdır (`USER_CONFIRMED_PIN`).
 */
export type PositionPickerProps = {
  position: AddressPosition | null;
  defaultCenter: Coordinates;
  serviceArea: typeof istanbulServiceArea;
  /** Kabul edilirse `null`, edilmezse kullanıcıya gösterilecek Türkçe metin. */
  confirmPosition: (position: Coordinates) => string | null;
  suggestFromPosition: (position: Coordinates) => Promise<void>;
  status: "idle" | "loading" | "error";
  errorCode: string | null;
  httpStatus: number;
  fieldError?: string;
};

/**
 * Haritasız konum onayı.
 *
 * Harita anahtarı gelene kadar tek çalışan yol bu; sağlayıcı düştüğünde de
 * yerinde kalır, çünkü konumu backend'e sormadan da onaylayabilmek gerekiyor.
 */
export function PositionPicker({
  position,
  defaultCenter,
  serviceArea,
  confirmPosition,
  suggestFromPosition,
  status,
  errorCode,
  httpStatus,
  fieldError,
}: PositionPickerProps) {
  const latitudeId = useId();
  const longitudeId = useId();
  const [latitude, setLatitude] = useState(text(position?.latitude ?? defaultCenter.latitude));
  const [longitude, setLongitude] = useState(text(position?.longitude ?? defaultCenter.longitude));
  const [message, setMessage] = useState<string | null>(null);
  const [shown, setShown] = useState<AddressPosition | null>(position);

  // Aday aramadan geldiğinde kutular onun konumunu göstermeli; kullanıcı
  // aksi hâlde ekranda bir konum, gövdede başkasını taşırdı. Eşitleme render
  // sırasında yapılıyor: effect ile yapılsaydı kullanıcı bir kare boyunca
  // eski koordinatı görürdü.
  if (position !== shown) {
    setShown(position);
    if (position) {
      setLatitude(text(position.latitude));
      setLongitude(text(position.longitude));
    }
  }

  const coordinates = (): Coordinates => ({
    latitude: Number.parseFloat(latitude),
    longitude: Number.parseFloat(longitude),
  });

  return (
    <section className="address-position" aria-label="Konum onayı">
      <h3>Konum</h3>
      <p className="field-hint">
        Konumu enlem ve boylamla da onaylayabilirsin. Koala yalnız İstanbul
        sınırlarında ({serviceArea.south}–{serviceArea.north} /{" "}
        {serviceArea.west}–{serviceArea.east}) çalışıyor.
      </p>

      <div className="address-position-fields">
        <div className="field">
          <label htmlFor={latitudeId}>Enlem</label>
          <input
            id={latitudeId}
            type="text"
            inputMode="decimal"
            value={latitude}
            onChange={(event) => setLatitude(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor={longitudeId}>Boylam</label>
          <input
            id={longitudeId}
            type="text"
            inputMode="decimal"
            value={longitude}
            onChange={(event) => setLongitude(event.target.value)}
          />
        </div>
      </div>

      <div className="button-row">
        <button
          type="button"
          className="button button-secondary button-small"
          onClick={() => setMessage(confirmPosition(coordinates()))}
        >
          Konumu onayla
        </button>
        <button
          type="button"
          className="button button-secondary button-small"
          disabled={status === "loading"}
          onClick={() => {
            setMessage(null);
            void suggestFromPosition(coordinates());
          }}
        >
          Bu konumdan adres öner
        </button>
      </div>

      {position && (
        <p className="muted">
          Onaylanan konum: {text(position.latitude)}, {text(position.longitude)} (
          {sourceLabels[position.source]})
        </p>
      )}

      {message && <p className="field-error">{message}</p>}
      {fieldError && <p className="field-error">{fieldError}</p>}
      {status === "error" && (
        <ErrorState errorCode={errorCode ?? undefined} status={httpStatus} />
      )}
    </section>
  );
}

const sourceLabels = {
  AUTOCOMPLETE_CONFIRMED: "aramadan seçildi",
  REVERSE_GEOCODE_CONFIRMED: "konumdan çözümlendi",
  USER_CONFIRMED_PIN: "elle onaylandı",
} as const;

/** Kutuda gereksiz sıfır kuyruğu görünmesin diye ondalık kırpılır. */
function text(value: number) {
  return String(Number(value.toFixed(coordinateDecimals)));
}
