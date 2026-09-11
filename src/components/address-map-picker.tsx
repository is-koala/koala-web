"use client";

import { useEffect, useRef, useState } from "react";

import {
  clampToServiceArea,
  formatCoordinate,
  mapCameraLimits,
  type AddressCandidate,
  type Coordinates,
} from "@/address/contract";
import {
  googleMapsJavaScriptKey,
  loadGoogleMaps,
  type LoadMap,
  type MapHandle,
} from "@/address/maps";

import {
  PositionPicker,
  type PositionPickerProps,
} from "./address-position-picker";

export type AddressMapPickerProps = PositionPickerProps & {
  lookupFromPosition: (position: Coordinates) => Promise<AddressCandidate>;
  applyCandidate: (candidate: AddressCandidate) => void;
  mapsKey?: string;
  loadMap?: LoadMap;
};

/**
 * Sabit merkez pinli harita seçici.
 *
 * Mobil ile aynı jest: harita kayar, pin ekranın ortasında durur. Sürüklenebilir
 * marker iki platformda farklı koordinat üretir diye yok. Maps anahtarı boşken
 * betik hiç inmez; klavye yolu (`PositionPicker`) her durumda çalışır.
 */
export function AddressMapPicker({
  mapsKey = googleMapsJavaScriptKey(),
  loadMap = loadGoogleMaps,
  lookupFromPosition,
  applyCandidate,
  confirmPosition,
  ...picker
}: AddressMapPickerProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapHandle | null>(null);
  const confirmRef = useRef(confirmPosition);
  const positionRef = useRef(picker.position);

  useEffect(() => {
    confirmRef.current = confirmPosition;
    positionRef.current = picker.position;
  });

  const [camera, setCamera] = useState<Coordinates>(() =>
    clampToServiceArea(picker.position ?? picker.defaultCenter),
  );
  const [mapReady, setMapReady] = useState(false);
  const [preview, setPreview] = useState<{
    candidate: AddressCandidate;
    pin: Coordinates;
  } | null>(null);

  const key = mapsKey.trim();

  useEffect(() => {
    if (!key || !canvasRef.current) return;
    const element = canvasRef.current;
    let cancelled = false;

    void loadMap(key).then((surface) => {
      if (cancelled || !element.isConnected) return;
      const origin = clampToServiceArea(positionRef.current ?? picker.defaultCenter);
      const handle = surface.attach(element, {
        center: origin,
        zoom: mapCameraLimits.defaultZoom,
        minZoom: mapCameraLimits.minZoom,
        maxZoom: mapCameraLimits.maxZoom,
        bounds: picker.serviceArea,
        onIdle: (center) => {
          setCamera(center);
          const locked = positionRef.current;
          if (
            locked &&
            locked.source !== "USER_CONFIRMED_PIN" &&
            (locked.latitude !== center.latitude || locked.longitude !== center.longitude)
          ) {
            confirmRef.current(center);
          }
        },
      });
      mapRef.current = handle;
      setCamera(handle.getCenter());
      setMapReady(true);
    });

    return () => {
      cancelled = true;
      mapRef.current?.destroy();
      mapRef.current = null;
    };
  }, [key, loadMap, picker.defaultCenter, picker.serviceArea]);

  const confirmMapPin = async () => {
    const pin = clampToServiceArea(mapRef.current?.getCenter() ?? camera);
    setCamera(pin);
    setPreview(null);
    try {
      const candidate = await lookupFromPosition(pin);
      setPreview({ candidate, pin });
    } catch {
      confirmPosition(pin);
      setPreview(null);
    }
  };

  return (
    <div className="address-map-picker">
      {key ? (
        <div className="address-map">
        <div className="address-map-frame">
          <div
            ref={canvasRef}
            className="address-map-canvas"
            role="img"
            aria-label={`İstanbul hizmet alanı haritası, merkez ${formatCoordinate(camera.latitude)}, ${formatCoordinate(camera.longitude)}`}
          />
          <div className="address-map-pin" aria-hidden="true" />
        </div>
          <p className="address-map-coords">
            {formatCoordinate(camera.latitude)}, {formatCoordinate(camera.longitude)}
          </p>
          <p className="muted address-attribution">Adres verileri: Google Maps</p>
          {mapReady && (
            <button
              type="button"
              className="button button-secondary button-small"
              disabled={picker.status === "loading"}
              onClick={() => void confirmMapPin()}
            >
              Bu konumu kullan
            </button>
          )}
        </div>
      ) : (
        <p className="field-hint">
          Harita şu anda kullanılamıyor. Konumu enlem ve boylamla onaylayabilirsin.
        </p>
      )}

      {preview && (
        <div className="address-map-preview">
          <p>
            {preview.candidate.components.thoroughfare} {preview.candidate.components.buildingNumber},{" "}
            {preview.candidate.districtName}
          </p>
          <p className="muted address-attribution">
            Adres verileri: {preview.candidate.attribution}
          </p>
          <div className="button-row">
            <button
              type="button"
              className="button button-primary button-small"
              onClick={() => {
                applyCandidate({
                  ...preview.candidate,
                  position: {
                    ...preview.candidate.position,
                    latitude: preview.pin.latitude,
                    longitude: preview.pin.longitude,
                  },
                });
                setPreview(null);
              }}
            >
              Adresi kullan
            </button>
            <button
              type="button"
              className="button button-secondary button-small"
              onClick={() => {
                confirmPosition(preview.pin);
                setPreview(null);
              }}
            >
              Sadece pini kullan
            </button>
          </div>
        </div>
      )}

      <PositionPicker {...picker} confirmPosition={confirmPosition} />
    </div>
  );
}
