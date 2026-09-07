"use client";

import Link from "next/link";
import { useActionState, useEffect, useId, useMemo, useState, useSyncExternalStore } from "react";

import type { AddressGateway } from "@/address/gateway-client";
import { CanonicalAddressForm } from "@/components/canonical-address-form";
import { EmployerGate } from "@/components/employer-gate";
import {
  FieldError,
  FormAlert,
  InputField,
  SelectField,
  SubmitButton,
  TextField,
  TextareaField,
} from "@/components/form-controls";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { idleFormState, type FormAction, type FormState } from "@/lib/form-state";
import type { GateId } from "@/lib/gates";
import {
  addressFieldErrors,
  companyJobErrors,
  deserializeDraft,
  emptyJobDraft,
  individualJobErrors,
  insuranceLocked,
  moneyPattern,
  serializeDraft,
  unmatchedFieldMessages,
  type JobDraft,
  type JobCategory,
  type PriceQuoteResult,
} from "@/lib/job-posting";
import { formatMoney } from "@/lib/money";

/**
 * İlan açma formu — bireysel ve şirket.
 *
 * Çok adımlı ama **tek** `<form>`: adımlar gizlenip gösteriliyor, alanların
 * hepsi bağlı kalıyor. Adım başına ayrı form olsaydı ya her adımda bir
 * gönderim olurdu (ilan yarım kaydedilemiyor) ya da değerler adım değişince
 * kaybolurdu.
 *
 * İki işveren türü için **tek** bileşen. Formu kopyalamak sigorta kuralının
 * iki yerde yaşaması demekti ve bu depoda tekrarlayan kusur tam olarak o:
 * doğru yazılmış bir kural, sonradan eklenen bir yol tarafından sessizce
 * geçersiz kılınıyor. Ayrıldıkları yer sayılabilir kadar az — kategori
 * listesinin davranışı, sigorta anahtarı ve saklanan taslağın anahtarı.
 *
 * Tarayıcının kendi `required` doğrulaması kullanılmıyor: gizli bir panelde
 * duran zorunlu alan gönderimi görünmez biçimde kilitler. Kuralların tek
 * kaynağı `@/lib/job-posting`, ve aynı işlev sunucu action'ında da okunuyor.
 */

/** Sayfanın sunucuda okuduğu verinin iki ucu; yükleme durumu `loading.tsx`'te. */
export type JobFormData<T> =
  | { status: "ready"; data: T }
  | { status: "error"; errorCode: string; httpStatus: number };

/** Şablonun formu dolduran alanları; tarih ve adres taşımıyor. */
export type JobFormTemplate = {
  id: string;
  templateName: string;
  categoryId: string | null;
  title: string | null;
  description: string | null;
  sector: string | null;
  position: string | null;
  duties: string | null;
  dressCode: string | null;
  type: string | null;
  salaryType: string | null;
  salary: string | null;
  minAge: string | null;
  maxAge: string | null;
  experienceRequired: string | null;
};

/**
 * İlanın kimin adına açıldığı.
 *
 * Şirket kimliği burada taşınıyor çünkü form onu iki yerde kullanıyor:
 * saklanan taslağın anahtarı (iki şirketin taslağı birbirine karışmamalı) ve
 * gönderimi karşılayan action. `boolean` bir bayrak ikisini de veremezdi.
 */
export type JobFormOwner =
  | { readonly kind: "individual" }
  | { readonly kind: "company"; readonly companyId: string; readonly companyName: string };

export type JobFormProps = {
  owner: JobFormOwner;
  categories: JobFormData<readonly JobCategory[]>;
  templates: JobFormData<readonly JobFormTemplate[]>;
  /**
   * Yayımlama eyleminin karşılanmamış kapıları — `viewerGates(...).individualJob`
   * ya da `corporateJobGate(...)`. Boş değilse form doldurulabilir kalır,
   * yalnız yayımlama kapanır.
   */
  blocked: readonly GateId[];
  action: FormAction;
  quote: (workerPayout: string) => Promise<PriceQuoteResult>;
  /**
   * Adres ağ geçidi ve gecikmesi; ikisi de yalnız testin ağı taklit
   * edebilmesi için dışarı açık. Üretimde varsayılanlar kullanılıyor ve
   * kanonik adres bileşeni kendi BFF uçlarına gidiyor.
   */
  addressGateway?: AddressGateway;
  addressDebounceMs?: number;
};

const steps = [
  "Kategori",
  "Temel bilgiler",
  "Tarih ve ücret",
  "Koşullar",
  "Adres",
  "Fiyat ve yayımla",
] as const;

type StepName = (typeof steps)[number];

/** Bir alanın hangi adımda çizildiği; eksik alan o adıma dönebilsin diye. */
const fieldSteps: Readonly<Record<string, StepName>> = {
  categoryId: "Kategori",
  title: "Temel bilgiler",
  description: "Temel bilgiler",
  sector: "Temel bilgiler",
  position: "Temel bilgiler",
  duties: "Temel bilgiler",
  dressCode: "Temel bilgiler",
  type: "Tarih ve ücret",
  salaryType: "Tarih ve ücret",
  salary: "Tarih ve ücret",
  startDateTime: "Tarih ve ücret",
  endDateTime: "Tarih ve ücret",
  minAge: "Koşullar",
  maxAge: "Koşullar",
  experienceRequired: "Koşullar",
  headcount: "Koşullar",
  insurancePreference: "Koşullar",
  address: "Adres",
};

/**
 * Kaza ile kapanan sekmeden dönenler için; anahtar sürümlü ki şema değişince
 * düşsün.
 *
 * İşveren kimliği anahtarın parçası: aynı kullanıcı hem kendi adına hem iki
 * ayrı şirket adına ilan açabiliyor ve tek bir anahtar, bir şirketin yarım
 * taslağını öbürünün formunda gösterirdi.
 */
function draftStorageKey(owner: JobFormOwner): string {
  return owner.kind === "individual"
    ? "koala.ilan.bireysel.v1"
    : `koala.ilan.sirket.${owner.companyId}.v1`;
}

type QuoteState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; result: Extract<PriceQuoteResult, { status: "ready" }> }
  | { status: "error"; errorCode: string; httpStatus: number };

export function JobForm({
  owner,
  categories,
  templates,
  blocked,
  action,
  quote,
  addressGateway,
  addressDebounceMs,
}: JobFormProps) {
  const storageKey = draftStorageKey(owner);
  // Kural seçimi tek yerde: gövdeyi kuran sunucu action'ı da aynı ayrımı aynı
  // iki işlevle yapıyor, yani form kabul ettiği bir taslağı sunucuya
  // reddettiremiyor.
  const jobErrors = owner.kind === "company" ? companyJobErrors : individualJobErrors;

  // Taslak, kullanıcı ilk harfi yazana kadar `null`: o ana kadar ekranda
  // tarayıcıdan geri yüklenen değerler duruyor ve depolamaya hiçbir şey
  // yazılmıyor. `null` olmasaydı ilk render boş taslağı kaydeder ve
  // kullanıcının önceki yazdıklarını sessizce silerdi.
  const [edited, setEdited] = useState<JobDraft | null>(null);
  const [step, setStep] = useState<StepName>("Kategori");
  const [priceQuote, setPriceQuote] = useState<QuoteState>({ status: "idle" });
  const formId = useId();

  // `localStorage` sunucuda yok: hidratlanmadan önce okunursa sunucunun
  // ürettiği HTML ile tarayıcınınki ayrışır. Bu kanca "artık tarayıcıdayız"
  // sorusunun React'in kendi cevabı.
  const hydrated = useSyncExternalStore(subscribeToNothing, () => true, () => false);
  const restored = useMemo(
    () => (hydrated ? deserializeDraft(readStoredDraft(storageKey)) : emptyJobDraft),
    [hydrated, storageKey],
  );
  const draft = edited ?? restored;

  const catalog = categories.status === "ready" ? categories.data : null;

  /**
   * Gönderimden önceki son kapı.
   *
   * Kural sunucuda da okunuyor; buradaki kopya kullanıcıyı bir ağ turu
   * beklemeden eksiğine götürmek için. `endDateTime > startDateTime` ise
   * yalnız burada ve sunucu action'ında var — backend onu hiç denetlemiyor.
   */
  const submit = async (previous: FormState, formData: FormData): Promise<FormState> => {
    const errors = jobErrors(draft, catalog);
    if (!formData.get("address")) errors.address = "Adresi onaylaman gerekiyor.";

    if (Object.keys(errors).length > 0) {
      setStep(firstStepWithError(errors));
      // Backend aynı durumu bu kodla bildiriyor; form iki kaynağı ayırmak
      // zorunda kalmasın diye istemci de aynısını kullanıyor.
      return { status: "error", errorCode: "VALIDATION_FAILED", httpStatus: 400, fieldErrors: errors };
    }

    // Gönderim artık sunucuya çıkıyor ve başarılı olursa sayfa ilanın kendi
    // adresine gidiyor: form geride kalır ve saklanan taslak silinmezse
    // kullanıcı bir dahaki gelişinde yayımladığı ilanı yeniden doldurulmuş
    // bulur. Sunucu yine de reddederse yazdıkları React durumunda duruyor ve
    // ilk tuş vuruşunda kayıt yeniden yazılıyor.
    clearStoredDraft(storageKey);

    return action(previous, formData);
  };

  const [state, formAction] = useActionState(submit, idleFormState);

  const fieldErrors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const errorFor = (field: keyof JobDraft) => fieldErrors[field];

  useEffect(() => {
    if (edited !== null) writeStoredDraft(storageKey, edited);
  }, [edited, storageKey]);

  const set = (field: keyof JobDraft) => (value: string) => {
    setEdited({ ...draft, [field]: value });
  };

  const askForPrice = async () => {
    const payout = draft.salary.trim();
    if (!moneyPattern.test(payout) || Number(payout) < 1) {
      setPriceQuote({ status: "idle" });
      return;
    }

    setPriceQuote({ status: "loading" });
    const result = await quote(payout);
    setPriceQuote(
      result.status === "ready"
        ? { status: "ready", result }
        : { status: "error", errorCode: result.errorCode, httpStatus: result.httpStatus },
    );
  };

  const applyTemplate = (templateId: string) => {
    if (templates.status !== "ready") return;
    const template = templates.data.find((candidate) => candidate.id === templateId);
    if (!template) return;

    setEdited({
      ...draft,
      ...Object.fromEntries(
        (Object.keys(emptyJobDraft) as (keyof JobDraft)[])
          .map((field) => [field, template[field as keyof JobFormTemplate]])
          .filter(([, value]) => typeof value === "string" && value !== ""),
      ),
    });
  };

  return (
    <form
      action={formAction}
      noValidate
      onKeyDown={blockImplicitSubmit}
      className="job-form"
    >
      <nav className="job-form-steps" aria-label="İlan adımları">
        {steps.map((name) => (
          <button
            key={name}
            type="button"
            className={name === step ? "step is-current" : "step"}
            aria-current={name === step ? "step" : undefined}
            onClick={() => setStep(name)}
          >
            {name}
          </button>
        ))}
      </nav>

      <FormAlert state={state} />
      <UnmatchedMessages fieldErrors={fieldErrors} />

      <StepPanel name="Kategori" current={step}>
        <TemplatePicker templates={templates} onPick={applyTemplate} />
        <CategoryChoice
          owner={owner}
          categories={categories}
          value={draft.categoryId}
          error={errorFor("categoryId")}
          onChange={set("categoryId")}
        />
      </StepPanel>

      <StepPanel name="Temel bilgiler" current={step}>
        <TextField
          name="title"
          label="İlan başlığı"
          required={false}
          maxLength={160}
          value={draft.title}
          onValueChange={set("title")}
          error={errorFor("title")}
        />
        <TextareaField
          name="description"
          label="İlan açıklaması"
          rows={5}
          defaultValue=""
          value={draft.description}
          onValueChange={set("description")}
          error={errorFor("description")}
        />
        <TextField
          name="position"
          label="Pozisyon"
          required={false}
          value={draft.position}
          onValueChange={set("position")}
          error={errorFor("position")}
        />
        <TextField
          name="sector"
          label="Sektör"
          required={false}
          hint="İstersen boş bırakabilirsin."
          value={draft.sector}
          onValueChange={set("sector")}
          error={errorFor("sector")}
        />
        <TextareaField
          name="duties"
          label="Görev ve sorumluluklar"
          rows={3}
          defaultValue=""
          value={draft.duties}
          onValueChange={set("duties")}
          error={errorFor("duties")}
        />
        <TextField
          name="dressCode"
          label="Kıyafet kuralı"
          required={false}
          hint="Örneğin siyah pantolon, beyaz gömlek."
          value={draft.dressCode}
          onValueChange={set("dressCode")}
          error={errorFor("dressCode")}
        />
      </StepPanel>

      <StepPanel name="Tarih ve ücret" current={step}>
        <SelectField
          name="type"
          label="İlan türü"
          required={false}
          placeholder="Seç"
          options={[
            { value: "ONE_TIME", label: "Tek seferlik" },
            { value: "RECURRING", label: "Tekrar eden" },
          ]}
          value={draft.type}
          onChange={(event) => set("type")(event.target.value)}
          error={errorFor("type")}
        />
        <SelectField
          name="salaryType"
          label="Ücret türü"
          required={false}
          placeholder="Seç"
          options={[
            { value: "HOURLY", label: "Saatlik" },
            { value: "DAILY", label: "Günlük" },
          ]}
          value={draft.salaryType}
          onChange={(event) => set("salaryType")(event.target.value)}
          error={errorFor("salaryType")}
        />
        <InputField
          name="salary"
          type="number"
          label="Çalışana ödenecek ücret"
          hint="Koala hizmet bedeli bunun üzerine eklenir; toplamı fiyat adımında görürsün."
          required={false}
          min="1"
          step="0.01"
          defaultValue=""
          value={draft.salary}
          onValueChange={set("salary")}
          error={errorFor("salary")}
        />
        <InputField
          name="startDateTime"
          type="datetime-local"
          label="Başlangıç"
          required={false}
          defaultValue=""
          value={draft.startDateTime}
          onValueChange={set("startDateTime")}
          error={errorFor("startDateTime")}
        />
        <InputField
          name="endDateTime"
          type="datetime-local"
          label="Bitiş"
          required={false}
          defaultValue=""
          value={draft.endDateTime}
          onValueChange={set("endDateTime")}
          error={errorFor("endDateTime")}
        />
      </StepPanel>

      <StepPanel name="Koşullar" current={step}>
        <InputField
          name="minAge"
          type="number"
          label="En küçük yaş"
          required={false}
          min="1"
          defaultValue=""
          value={draft.minAge}
          onValueChange={set("minAge")}
          error={errorFor("minAge")}
        />
        <InputField
          name="maxAge"
          type="number"
          label="En büyük yaş"
          required={false}
          min="1"
          defaultValue=""
          value={draft.maxAge}
          onValueChange={set("maxAge")}
          error={errorFor("maxAge")}
        />
        <SelectField
          name="experienceRequired"
          label="Deneyim gerekli mi"
          required={false}
          placeholder="Seç"
          options={[
            { value: "false", label: "Deneyim şart değil" },
            { value: "true", label: "Deneyim gerekli" },
          ]}
          value={draft.experienceRequired}
          onChange={(event) => set("experienceRequired")(event.target.value)}
          error={errorFor("experienceRequired")}
        />
        <InputField
          name="headcount"
          type="number"
          label="Kişi sayısı"
          hint="Boş bırakabilirsin."
          required={false}
          min="1"
          defaultValue=""
          value={draft.headcount}
          onValueChange={set("headcount")}
          error={errorFor("headcount")}
        />
        {owner.kind === "company" ? (
          <InsuranceChoice
            locked={insuranceLocked(catalog, draft.categoryId)}
            value={draft.insurancePreference}
            onChange={set("insurancePreference")}
          />
        ) : null}
      </StepPanel>

      <StepPanel name="Adres" current={step}>
        {/*
          ADR-0003: bireysel işverenin tam adresi hiçbir zaman herkese açık
          olmuyor ve sunucu `addressPublic`'i koşulsuz `false` yapıyor
          (`JobManager.java:155`). Şirket ilanında alan gövdede taşınabiliyor
          ama gönderilmiyor: işyeri adresini herkese açmak ayrı bir ürün
          kararı ve verilmedi, yani sunucu orada da `false` yazıyor. İki
          durumda da burada bir seçenek değil, bir bilgi var.
        */}
        <p className="field-hint">
          İşin adresini yalnızca işe aldığın işçi görür; ilanda yalnızca ilçe ve yaklaşık
          konum görünür.
        </p>
        <p className="field-hint">Koala şu anda yalnızca İstanbul&apos;da hizmet veriyor.</p>
        <FieldError id={`${formId}-address`} message={fieldErrors.address} />
        <CanonicalAddressForm
          gateway={addressGateway}
          debounceMs={addressDebounceMs}
          fieldErrors={addressFieldErrors(fieldErrors)}
        />
      </StepPanel>

      <StepPanel name="Fiyat ve yayımla" current={step}>
        <PriceSummary quote={priceQuote} onAsk={askForPrice} />
      </StepPanel>

      <footer className="job-form-actions">
        <EmployerGate blocked={blocked} action="İlanı yayımla">
          <SubmitButton label="İlanı yayımla" pendingLabel="Yayımlanıyor…" />
        </EmployerGate>
      </footer>
    </form>
  );
}

/**
 * Bir metin alanında Enter'a basmak formu göndermez.
 *
 * Tarayıcının örtük gönderimi tek alanlı formlarda kolaylık, burada tuzak:
 * form uzun, çok adımlı ve içinde bir adres **arama** kutusu var — orada
 * Enter'a basan kullanıcı arama yapmak istiyor, ilan yayımlamak değil.
 * `textarea` dışarıda: orada Enter zaten satır başı, gönderim değil.
 */
function blockImplicitSubmit(event: React.KeyboardEvent<HTMLFormElement>) {
  const target = event.target as HTMLElement;
  if (event.key !== "Enter" || target.tagName !== "INPUT") return;
  event.preventDefault();
}

function StepPanel({
  name,
  current,
  children,
}: {
  name: StepName;
  current: StepName;
  children: React.ReactNode;
}) {
  return (
    <section className="job-form-panel" hidden={name !== current} aria-label={name}>
      <h2>{name}</h2>
      {children}
    </section>
  );
}

/**
 * Fiyat adımı.
 *
 * Üç tutar da `POST /payment-quotes` yanıtından okunuyor ve burada
 * **hesaplanmıyor**: hizmet bedeli oranı çalışma zamanı ayarından geliyor ve
 * yuvarlama `HALF_UP`. Oran ekranda gösterilmiyor — ADR-0002 üç kalem sayıyor
 * ve oranı yüzdeye çevirmek, "hesaplama yok" kuralının ilk deliği olurdu.
 */
function PriceSummary({ quote, onAsk }: { quote: QuoteState; onAsk: () => void }) {
  return (
    <div className="job-form-price">
      <button type="button" className="button button-secondary" onClick={onAsk}>
        Fiyatı hesapla
      </button>

      {quote.status === "idle" ? (
        <EmptyState kind="priceQuote" />
      ) : null}
      {quote.status === "loading" ? <LoadingState label="Fiyat hesaplanıyor…" /> : null}
      {quote.status === "error" ? (
        <ErrorState errorCode={quote.errorCode} status={quote.httpStatus} />
      ) : null}

      {quote.status === "ready" ? (
        <>
          <div className="price-breakdown" role="group" aria-label="Fiyat özeti">
            <PriceLine
              label="Çalışan ücreti"
              amount={quote.result.breakdown.workerPayout}
              currency={quote.result.breakdown.currency}
            />
            <PriceLine
              label="Koala hizmet bedeli"
              amount={quote.result.breakdown.serviceFeeAmount}
              currency={quote.result.breakdown.currency}
            />
            <PriceLine
              label="İşveren toplamı"
              amount={quote.result.breakdown.employerTotal}
              currency={quote.result.breakdown.currency}
            />
          </div>
          <p role="note" className="price-freeze">
            Bu fiyat ilan yayımlandığında kilitlenir ve sonradan değişmez.
          </p>
        </>
      ) : null}
    </div>
  );
}

function PriceLine({
  label,
  amount,
  currency,
}: {
  label: string;
  amount: string;
  currency: string;
}) {
  return (
    <p className="price-line">
      <span>{label}</span>
      <strong>{formatMoney(amount, currency)}</strong>
    </p>
  );
}

/**
 * Kategori seçimi.
 *
 * Sigorta zorunlu kategoriler listeden **çıkarılmıyor**: kullanıcı aradığı işi
 * bulamazsa neden bulamadığını da öğrenemez. Bireysel ilanda devre dışı
 * duruyorlar ve nedeni yanlarında yazılı (`JobManager.java:134-137`); şirket
 * ilanında seçilebiliyorlar, çünkü `createCorporateJob` onları kabul ediyor.
 */
function CategoryChoice({
  owner,
  categories,
  value,
  error,
  onChange,
}: {
  owner: JobFormOwner;
  categories: JobFormData<readonly JobCategory[]>;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  if (categories.status === "error") {
    return <ErrorState errorCode={categories.errorCode} status={categories.httpStatus} />;
  }
  if (categories.data.length === 0) return <EmptyState kind="jobCategories" />;

  const forCompany = owner.kind === "company";

  return (
    <fieldset className="category-choice">
      <legend>İş kategorisi</legend>
      {forCompany ? (
        <p className="field-hint">
          Sigorta zorunlu bir iş seçersen sigortalı çalışma koşulu ilana otomatik eklenir ve
          kapatılamaz.
        </p>
      ) : (
        <p className="field-hint">
          Sigorta zorunlu işler seçilemez: bu iş için sigorta zorunlu, bireysel ilanla açılamaz —
          şirket ilanı gerekir. <Link className="text-link" href="/isveren/ilanlar">Şirket ilanları</Link>
        </p>
      )}
      {categories.data.map((category) => (
        <div className="checkbox-field" key={category.id}>
          <input
            id={`category-${category.id}`}
            type="radio"
            name="categoryId"
            value={category.id}
            checked={value === category.id}
            disabled={!forCompany && category.requiresInsurance}
            onChange={(event) => onChange(event.target.value)}
          />
          <label htmlFor={`category-${category.id}`}>
            {category.name}
            {category.requiresInsurance ? <span className="badge"> · Sigorta zorunlu</span> : null}
          </label>
        </div>
      ))}
      <FieldError message={error} />
    </fieldset>
  );
}

/**
 * Şirket ilanının sigorta anahtarı.
 *
 * Kilit **türetiliyor**: `insuranceLocked` her render'da seçili kategoriyi
 * okuyor ve saklanan hiçbir alana bakmıyor. Kategori seçiminde elle
 * güncellenen bir alan olsaydı, kategoriyi değiştiren her yolun (seçici,
 * şablon, geri yüklenen taslak) onu güncellemeyi hatırlaması gerekirdi —
 * koala-mobile#24 bir yol unutulduğu için doğmuştu.
 *
 * Kilitliyken anahtar devre dışı ve devre dışı bir kutu gönderime hiç
 * girmiyor; bu yüzden yanında aynı adı taşıyan gizli bir alan duruyor.
 * Değeri yine türetmenin sonucu ve hesap tek kaynakta: sunucu action'ı da
 * gövdeyi kurarken aynı `insuranceRequiredFor`'u çağırıyor, kendi kopyasını
 * yazmıyor. Gizli alan formdan gelen tercihi değil o türetmeyi taşıyor;
 * katalog sunucuda okunamazsa son söz bu değerde kalıyor ve kullanıcı
 * kapatamayacağı bir 400'e düşmüyor.
 */
function InsuranceChoice({
  locked,
  value,
  onChange,
}: {
  locked: boolean;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="insurance-choice">
      <div className="checkbox-field">
        <input
          id="insurancePreference"
          type="checkbox"
          name={locked ? undefined : "insurancePreference"}
          value="true"
          checked={locked || value === "true"}
          disabled={locked}
          onChange={(event) => onChange(event.target.checked ? "true" : "false")}
        />
        <label htmlFor="insurancePreference">Sigortalı çalışma</label>
      </div>
      {locked ? <input type="hidden" name="insurancePreference" value="true" /> : null}
      <p className="field-hint">
        {locked
          ? "Bu kategoride sigorta zorunlu; koşul ilandan kaldırılamaz."
          : "İstersen bu ilanda sigortalı çalışma koşulu arayabilirsin."}
      </p>
    </div>
  );
}

/** Şablon yalnız var olan bir ilandan üretilebiliyor; oluşturma #34'ün işi. */
function TemplatePicker({
  templates,
  onPick,
}: {
  templates: JobFormData<readonly JobFormTemplate[]>;
  onPick: (templateId: string) => void;
}) {
  if (templates.status === "error") {
    return <ErrorState errorCode={templates.errorCode} status={templates.httpStatus} />;
  }
  // Boş durum sessiz bırakılmıyor: şablonun olmadığını okuyan kullanıcı
  // eksik bir ekranla karşılaştığını sanmaz (`AGENTS.md`, "Ekran durumları").
  if (templates.data.length === 0) {
    return (
      <p className="field-hint">
        Henüz şablonun yok. Yayımladığın bir ilandan şablon çıkarabildiğinde burada
        listelenecek.
      </p>
    );
  }

  return (
    <SelectField
      name="jobTemplateId"
      label="Şablondan doldur"
      placeholder="Şablon seçme"
      required={false}
      hint="Şablon tarihleri ve adresi doldurmaz."
      options={templates.data.map((template) => ({
        value: template.id,
        label: template.templateName,
      }))}
      onChange={(event) => onPick(event.target.value)}
    />
  );
}

/**
 * Ekranda karşılığı olmayan alan mesajları.
 *
 * Backend tanımadığımız bir alan adı bildirirse mesaj sessizce düşerdi;
 * kullanıcı reddi görür ama sebebini hiçbir yerde okuyamazdı.
 */
function UnmatchedMessages({ fieldErrors }: { fieldErrors: Readonly<Record<string, string>> }) {
  const messages = unmatchedFieldMessages(fieldErrors);
  if (messages.length === 0) return null;

  return (
    <ul className="state-card state-card-error">
      {messages.map((message) => (
        <li key={message}>{message}</li>
      ))}
    </ul>
  );
}

function firstStepWithError(errors: Readonly<Record<string, string>>): StepName {
  const found = steps.find((name) =>
    Object.keys(errors).some((field) => fieldSteps[field] === name),
  );
  return found ?? "Kategori";
}

/** Hidrasyon dışında değişen bir şey yok; abone olunacak bir kaynak da yok. */
function subscribeToNothing() {
  return () => {};
}

/** Depolama kapalı ya da dolu olabilir; taslak kaybı formu durdurmamalı. */
function readStoredDraft(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStoredDraft(key: string, draft: JobDraft): void {
  try {
    window.localStorage.setItem(key, serializeDraft(draft));
  } catch {
    // Yazılamadıysa yapılacak bir şey yok; form çalışmaya devam eder.
  }
}

function clearStoredDraft(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Depolama kapalıysa silinecek bir şey de yok.
  }
}
