"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";

import {
  addressErrorCodes,
  componentLimits,
  defaultMapCenter,
  emptyAddressDraft,
  isInsideServiceArea,
  istanbulServiceArea,
  serviceAreaNotice,
  type AddressCandidate,
  type AddressDraft,
  type AddressPosition,
  type AddressSuggestion,
  type ComponentField,
  type Coordinates,
  type ReferenceLocation,
} from "@/address/contract";
import { AddressGatewayError, browserAddressGateway, type AddressGateway } from "@/address/gateway-client";
import { useAddressSearch } from "@/address/use-address-search";
import { addressDraftErrors, addressWriteBody } from "@/address/write";
import { TextField } from "@/components/form-controls";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";

import { AddressMapPicker } from "./address-map-picker";
import { type PositionPickerProps } from "./address-position-picker";

export type { PositionPickerProps };

export type CanonicalAddressFormProps = {
  /** Gövdeyi taşıyan gizli alanın adı; sunucu `readAddressWrite` ile okur. */
  name?: string;
  gateway?: AddressGateway;
  debounceMs?: number;
  initialDraft?: AddressDraft;
  /**
   * Backend'in `details[]` içinde döndürdüğü, zaten Türkçe çözülmüş alan
   * mesajları. Anahtarlar bileşen alan adlarıyla aynı; iç içe DTO yolunun
   * (`address.components.`) kırpılması çağırana ait.
   */
  fieldErrors?: Readonly<Record<string, string>>;
  /**
   * Konum onayının çizimi. Varsayılan harita seçici; anahtar boşken haritasız
   * yedekle aynı sözleşmeyi uygular (is-koala/koala-web#28).
   */
  renderPositionPicker?: (props: PositionPickerProps) => React.ReactNode;
};

/** Sağlayıcıdan gelen adayın üzerine yazdığı alanlar; kalanı kullanıcının. */
const providerOwnedFields: ComponentField[] = [
  "neighborhood",
  "thoroughfare",
  "siteName",
  "buildingNumber",
  "postalCode",
];

const componentLabels: Record<ComponentField, string> = {
  neighborhood: "Mahalle",
  thoroughfare: "Cadde veya sokak",
  siteName: "Site veya tesis adı",
  block: "Blok",
  buildingName: "Bina adı",
  buildingNumber: "Bina numarası",
  floor: "Kat",
  unitNumber: "Daire numarası",
  postalCode: "Posta kodu",
  additionalDirections: "Tarif ve ek bilgi",
};

const requiredComponents = new Set<ComponentField>(["neighborhood", "thoroughfare", "postalCode"]);

/**
 * Backend'in kanonik adres sözleşmesini dolduran form.
 *
 * Adres sağlayıcısı istemciye hiç açılmıyor (ADR 0007): arama, çözümleme ve
 * ters çözümleme backend'in ağ geçidinden geçiyor ve konumun kim tarafından
 * onaylandığı `position.source` ile taşınıyor. Form haritasız da tamamlanır;
 * sağlayıcı düştüğünde tek yol elle doldurmak olduğu için alanlar hiçbir
 * durumda kilitlenmez.
 */
export function CanonicalAddressForm({
  name = "address",
  gateway = browserAddressGateway,
  debounceMs,
  initialDraft = emptyAddressDraft,
  fieldErrors,
  renderPositionPicker,
}: CanonicalAddressFormProps) {
  const [draft, setDraft] = useState<AddressDraft>(initialDraft);
  const [reviewConfirmed, setReviewConfirmed] = useState(!initialDraft.needsReview);
  const [touched, setTouched] = useState<ReadonlySet<string>>(new Set());
  const [manualOpened, setManualOpened] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [query, setQuery] = useState("");
  const [reverse, setReverse] = useState<{
    status: "idle" | "loading" | "error";
    errorCode: string | null;
    httpStatus: number;
  }>({ status: "idle", errorCode: null, httpStatus: 0 });

  const searchId = useId();
  const listboxId = useId();

  const applyCandidate = useCallback((candidate: AddressCandidate) => {
    setDraft((current) => ({
      ...current,
      country: {
        id: candidate.countryId,
        name: candidate.countryName,
        code: candidate.countryCode,
      },
      city: { id: candidate.cityId, name: candidate.cityName },
      district: { id: candidate.districtId, name: candidate.districtName },
      components: {
        ...current.components,
        ...Object.fromEntries(
          providerOwnedFields.map((field) => [field, candidate.components[field] ?? ""]),
        ),
      },
      position: {
        latitude: candidate.position.latitude,
        longitude: candidate.position.longitude,
      },
      source: candidate.position.source,
      candidateToken: candidate.candidateToken,
      attribution: candidate.attribution,
      needsReview: candidate.needsUserReview,
    }));
    // Eksik gelen aday kullanıcının açık onayını bekler; onaysız gövde
    // üretilmez ki eksik adres sessizce kaydedilmesin.
    setReviewConfirmed(!candidate.needsUserReview);
    setQuery("");
    setActiveIndex(-1);
  }, []);

  const search = useAddressSearch({ gateway, debounceMs, onCandidateResolved: applyCandidate });

  // Sağlayıcı yokken arama kutusu tek başına çıkmaz sokak: elle seçim yedeği
  // kullanıcı aramadan açılır. Türetilmiş değer, çünkü sağlayıcı geri
  // geldiğinde kullanıcının açtığı bölümün kapanmaması gerekiyor. Sağlayıcının
  // düştüğü ters çözümlemeden de anlaşılabilir; iki yol da aynı yedeğe çıkar.
  const providerAvailable =
    search.providerAvailable && reverse.errorCode !== addressErrorCodes.providerUnavailable;
  const manualOpen = manualOpened || !providerAvailable;

  const write = useMemo(
    () => (draft.needsReview && !reviewConfirmed ? null : addressWriteBody(draft)),
    [draft, reviewConfirmed],
  );

  const draftErrors = addressDraftErrors(draft);

  const setComponent = (field: ComponentField, value: string) => {
    setDraft((current) => ({ ...current, components: { ...current.components, [field]: value } }));
  };

  const confirmPosition = useCallback((position: Coordinates): string | null => {
    if (!Number.isFinite(position.latitude) || !Number.isFinite(position.longitude)) {
      return "Enlem ve boylam sayı olmalı.";
    }
    if (!isInsideServiceArea(position)) return serviceAreaNotice;

    // Konumu kullanıcı taşıdı: sağlayıcı kanıtı artık bu koordinata ait
    // değil ve `verifyAndConsume` token taşıyan bu gövdeyi reddederdi.
    // `needsReview` yerinde kalır: onay adayın eksik bileşenleri içindi ve
    // koordinatı doğrulamak o eksiği kapatmıyor. Ters çözümleme hatası
    // silinmez: pin onayı sağlayıcının düşmesini gizlemesin.
    setDraft((current) => ({
      ...current,
      position,
      source: "USER_CONFIRMED_PIN",
      candidateToken: null,
      attribution: null,
    }));
    return null;
  }, []);

  const lookupFromPosition = useCallback(
    async (position: Coordinates) => {
      setReverse({ status: "loading", errorCode: null, httpStatus: 0 });
      try {
        const candidate = await gateway.reverse(position);
        setReverse({ status: "idle", errorCode: null, httpStatus: 0 });
        return candidate;
      } catch (error) {
        const failure = error instanceof AddressGatewayError ? error : null;
        setReverse({
          status: "error",
          errorCode: failure?.errorCode ?? "UNEXPECTED",
          httpStatus: failure?.httpStatus ?? 500,
        });
        throw error;
      }
    },
    [gateway],
  );

  const suggestFromPosition = useCallback(
    async (position: Coordinates) => {
      try {
        applyCandidate(await lookupFromPosition(position));
      } catch {
        // Pin yazma konumudur; kanıt düşmezse eski token başka bir noktayla gider.
        confirmPosition(position);
      }
    },
    [applyCandidate, confirmPosition, lookupFromPosition],
  );

  const changeQuery = (value: string) => {
    setQuery(value);
    setActiveIndex(-1);
    search.search(value);
  };

  const listOpen = search.suggestions.length > 0;

  const onSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!listOpen) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % search.suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index <= 0 ? search.suggestions.length - 1 : index - 1));
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      void choose(search.suggestions[activeIndex]);
    } else if (event.key === "Escape") {
      setQuery("");
      search.search("");
    }
  };

  const choose = (suggestion: AddressSuggestion) => search.select(suggestion);

  const position: AddressPosition | null = draft.position
    ? { ...draft.position, source: draft.source }
    : null;

  const errorFor = (field: string) =>
    fieldErrors?.[field] ?? (touched.has(field) ? draftErrors[field] : undefined);

  const pickerProps: PositionPickerProps = {
    position,
    defaultCenter: defaultMapCenter,
    serviceArea: istanbulServiceArea,
    confirmPosition,
    suggestFromPosition,
    status: reverse.status,
    errorCode: reverse.errorCode,
    httpStatus: reverse.httpStatus,
    fieldError: errorFor("position"),
  };

  return (
    <div className="address-form">
      <input type="hidden" name={name} value={write ? JSON.stringify(write) : ""} readOnly />

      <section className="address-search" aria-label="Adres arama">
        <div className="field">
          <label htmlFor={searchId}>Adres ara</label>
          <input
            id={searchId}
            type="text"
            role="combobox"
            autoComplete="off"
            aria-expanded={listOpen}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={
              activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined
            }
            value={query}
            onChange={(event) => changeQuery(event.target.value)}
            onKeyDown={onSearchKeyDown}
          />
          <p className="field-hint">
            En az 3 karakter yaz; öneriler backend üzerinden getirilir.
          </p>
        </div>

        {search.status === "searching" && <LoadingState label="Adresler aranıyor" />}
        {search.status === "empty" && <EmptyState kind="addressSuggestions" />}
        {search.status === "error" && (
          <div className="address-search-error">
            <ErrorState errorCode={search.errorCode ?? undefined} status={search.httpStatus} />
            {/* Oturum ya da sağlayıcı hatasının tek çaresi tekrar sormak;
                düğme olmasa kullanıcı sorguyu silip yeniden yazmak zorunda
                kalırdı. */}
            <button
              type="button"
              className="button button-secondary button-small"
              onClick={search.retry}
            >
              Aramayı yeniden dene
            </button>
          </div>
        )}

        <ul className="address-suggestions" role="listbox" id={listboxId} hidden={!listOpen}>
          {search.suggestions.map((suggestion, index) => (
            <li
              key={suggestion.id}
              id={`${listboxId}-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              className={index === activeIndex ? "is-active" : undefined}
              onClick={() => void choose(suggestion)}
            >
              <strong>{suggestion.mainText}</strong>
              <span>{suggestion.secondaryText}</span>
            </li>
          ))}
        </ul>

        {/* Sağlayıcı şartı: verisi ekrandayken kaynağı da görünmeli.
            `AddressSuggestionDto` attribution taşımıyor, bu yüzden aday
            çözümlenene kadar nötr bir cümle durur. */}
        {(listOpen || draft.attribution) && (
          <p className="muted address-attribution">
            {draft.attribution
              ? `Adres verileri: ${draft.attribution}`
              : "Öneriler Koala'nın adres sağlayıcısından geliyor."}
          </p>
        )}
      </section>

      {draft.needsReview && (
        <div className="form-warning">
          <p>
            Sağlayıcıdan gelen adres eksik olabilir. Alanları kontrol edip onayla, sonra devam
            edebilirsin.
          </p>
          <div className="checkbox-field">
            <input
              id="address-review-confirmed"
              type="checkbox"
              checked={reviewConfirmed}
              onChange={(event) => setReviewConfirmed(event.target.checked)}
            />
            <label htmlFor="address-review-confirmed">
              Adres bilgilerini kontrol ettim, doğru.
            </label>
          </div>
        </div>
      )}

      <ReferenceSection
        draft={draft}
        gateway={gateway}
        open={manualOpen}
        onOpen={() => setManualOpened(true)}
        onSelect={(patch) => setDraft((current) => ({ ...current, ...patch }))}
      />

      <div className="address-components">
        {(Object.keys(componentLabels) as ComponentField[]).map((field) => (
          <TextField
            key={field}
            name={field}
            label={componentLabels[field]}
            required={requiredComponents.has(field)}
            value={draft.components[field]}
            onValueChange={(value) => setComponent(field, value)}
            onBlur={() => setTouched((current) => new Set(current).add(field))}
            error={errorFor(field)}
            maxLength={componentLimits[field]}
            pattern={field === "postalCode" ? "\\d{5}" : undefined}
          />
        ))}
      </div>

      {renderPositionPicker ? (
        renderPositionPicker(pickerProps)
      ) : (
        <AddressMapPicker
          {...pickerProps}
          lookupFromPosition={lookupFromPosition}
          applyCandidate={applyCandidate}
        />
      )}
    </div>
  );
}

/**
 * Ülke, il ve ilçenin elle seçimi.
 *
 * Aramadan gelen aday bu üçünü zaten getiriyor; bölüm kapalı başlar ve
 * listeler ancak açıldığında yüklenir. Sağlayıcı düştüğünde form onu
 * kendiliğinden açar — o durumda adresi tamamlamanın tek yolu bu, bu yüzden
 * bölüm kendi yükleniyor, boş ve hata durumlarını ayrıca çizer.
 */
function ReferenceSection({
  draft,
  gateway,
  open,
  onOpen,
  onSelect,
}: {
  draft: AddressDraft;
  gateway: AddressGateway;
  open: boolean;
  onOpen: () => void;
  onSelect: (patch: Partial<AddressDraft>) => void;
}) {
  const countryId = draft.country?.id;
  const cityId = draft.city?.id;

  const loadCountries = useCallback(() => gateway.countries(), [gateway]);
  const loadCities = useCallback(
    () => (countryId ? gateway.cities(countryId) : Promise.resolve([])),
    [countryId, gateway],
  );
  const loadDistricts = useCallback(
    () => (cityId ? gateway.districts(cityId) : Promise.resolve([])),
    [cityId, gateway],
  );

  const countries = useReferenceList(open ? loadCountries : null);
  const cities = useReferenceList(open && countryId ? loadCities : null);
  const districts = useReferenceList(open && cityId ? loadDistricts : null);

  const summary = [draft.country?.name, draft.city?.name, draft.district?.name]
    .filter(Boolean)
    .join(" · ");

  return (
    <section className="address-reference" aria-label="İdari bölüm">
      {summary && (
        <p className="muted" data-testid="address-reference-summary">
          {summary}
        </p>
      )}

      {!open && (
        <button type="button" className="button button-secondary button-small" onClick={onOpen}>
          Ülke, il ve ilçeyi elle seç
        </button>
      )}

      {countries.status === "loading" && <LoadingState label="Ülkeler yükleniyor" />}
      {countries.status === "error" && (
        <ErrorState errorCode={countries.errorCode ?? undefined} status={countries.httpStatus} />
      )}
      {countries.status === "empty" && (
        <div className="state-card" role="status">
          <h2>Ülke listesi alınamadı</h2>
          <p>Adresi aramadan seçmeyi deneyebilir ya da biraz sonra sayfayı yenileyebilirsin.</p>
        </div>
      )}

      {countries.status === "ready" && (
        <div className="address-reference-fields">
          <ReferenceSelect
            label="Ülke"
            list={countries}
            value={draft.country?.id ?? ""}
            onChange={(option) => onSelect({ country: option, city: null, district: null })}
          />
          <ReferenceSelect
            label="İl"
            list={cities}
            value={draft.city?.id ?? ""}
            onChange={(option) => onSelect({ city: option, district: null })}
          />
          <ReferenceSelect
            label="İlçe"
            list={districts}
            value={draft.district?.id ?? ""}
            onChange={(option) => onSelect({ district: option })}
          />
        </div>
      )}
    </section>
  );
}

type ReferenceList = {
  status: "idle" | "loading" | "ready" | "empty" | "error";
  items: ReferenceLocation[];
  errorCode: string | null;
  httpStatus: number;
};

/**
 * Referans listesinin dört durumu.
 *
 * Yükleniyor durumu saklanmıyor, türetiliyor: effect içinde senkron
 * `setState` bir tur fazladan render doğuruyor ve React bunu ayrıca uyarıyor.
 * Sonuç hangi yükleyiciye ait olduğunu taşır, böylece ülke değişince eski
 * il listesi bir kare boyunca ekranda kalmaz.
 */
function useReferenceList(load: (() => Promise<ReferenceLocation[]>) | null): ReferenceList {
  const [result, setResult] = useState<{
    load: unknown;
    items: ReferenceLocation[];
    errorCode: string | null;
    httpStatus: number;
  } | null>(null);

  useEffect(() => {
    if (!load) return;
    let live = true;
    void load().then(
      (items) => {
        if (live) setResult({ load, items, errorCode: null, httpStatus: 0 });
      },
      (error: unknown) => {
        const failure = error instanceof AddressGatewayError ? error : null;
        if (live) {
          setResult({
            load,
            items: [],
            errorCode: failure?.errorCode ?? "UNEXPECTED",
            httpStatus: failure?.httpStatus ?? 500,
          });
        }
      },
    );
    return () => {
      live = false;
    };
  }, [load]);

  const settled = result && result.load === load ? result : null;
  if (!load) return { status: "idle", items: [], errorCode: null, httpStatus: 0 };
  if (!settled) return { status: "loading", items: [], errorCode: null, httpStatus: 0 };
  if (settled.errorCode) {
    return {
      status: "error",
      items: [],
      errorCode: settled.errorCode,
      httpStatus: settled.httpStatus,
    };
  }
  return {
    status: settled.items.length > 0 ? "ready" : "empty",
    items: settled.items,
    errorCode: null,
    httpStatus: 0,
  };
}

function ReferenceSelect({
  label,
  list,
  value,
  onChange,
}: {
  label: string;
  list: ReferenceList;
  value: string;
  onChange: (option: ReferenceLocation | null) => void;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        value={value}
        disabled={list.status === "idle" || list.status === "loading"}
        onChange={(event) =>
          onChange(list.items.find((option) => option.id === event.target.value) ?? null)
        }
      >
        <option value="">Seç</option>
        {list.items.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
      {list.status === "loading" && <p className="field-hint">Yükleniyor…</p>}
      {list.status === "empty" && <p className="field-hint">Liste boş döndü.</p>}
      {list.status === "error" && <p className="field-error">Liste alınamadı.</p>}
    </div>
  );
}
