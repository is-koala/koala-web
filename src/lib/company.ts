import type { AddressWrite } from "@/address/contract";

/**
 * Şirket kaydının istemci tarafı kuralları.
 *
 * Sunucu katmanını içe aktarmaz: hem sunucuda çizilen sayfalar hem
 * `"use client"` formları aynı kuralı okuyor. İki yerde ayrışsalardı ekranda
 * geçerli görünen bir form sunucuda reddedilirdi.
 */

/**
 * `CompanyType`. Sekiz değer ve karşılıkları; kullanıcı bunlardan birini
 * **bir kez** seçiyor — `UpdateCompanyRequestDto` `type` taşımadığı için
 * yanlış seçim bir daha düzeltilemiyor.
 */
export const companyTypes = [
  { value: "SOLE_PROPRIETORSHIP", label: "Şahıs şirketi" },
  { value: "LIMITED", label: "Limited şirket" },
  { value: "CORPORATION", label: "Anonim şirket" },
  { value: "NON_PROFIT", label: "Kâr amacı gütmeyen kuruluş" },
  { value: "GOVERNMENT", label: "Kamu kurumu" },
  { value: "STARTUP", label: "Girişim" },
  { value: "AGENCY", label: "Ajans" },
  { value: "OTHER", label: "Diğer" },
] as const;

export type CompanyType = (typeof companyTypes)[number]["value"];

/**
 * Tür rozetinin metni. Tanınmayan değer olduğu gibi geçer: uydurulmuş bir
 * etiket, sözleşmenin değiştiğini ekrandan gizlerdi.
 */
export function companyTypeLabel(type: string): string {
  return companyTypes.find((option) => option.value === type)?.label ?? type;
}

/**
 * Metin alanlarının gerçek sınırı.
 *
 * DTO değil **sütun** genişliği: `companies` tablosunda `name`, `email`,
 * `phone_number`, `website`, `description` ve `tax_number` sütunlarının hepsi
 * `VARCHAR(255)` (`db/changelog/2025/08/20-01-changelog.xml:66-72`), ama
 * `UpdateCompanyRequestDto` website'a 512, açıklamaya 4000 izin veriyor.
 * DTO'ya güvenmek, doğrulamadan geçip veritabanında patlayan ve kullanıcıya
 * `errorCode` taşımayan bir 500 üretirdi (is-koala/koala-backend#62).
 */
export const companyTextLimit = 255;

/**
 * Şirket ayarlarını, logoyu ve yetkili listesini yönetme yetkisi.
 *
 * Tanınan tek değere bağlı, "ADMIN değilse STAFF'tır" varsayımına değil:
 * sözleşmeden kaldırılmış bir rol ya da yanıttaki bir sapma yetkiyi sessizce
 * açmamalı. Backend karşılığı `CompanyManager.requireCompanyAdmin` ve aynı
 * kapı hem `PATCH /companies/{id}` hem logo hem yetkili uçlarının önünde —
 * bu yüzden kural tek yerde ve `canManageContacts` buradan besleniyor.
 */
export function canManageCompany(role: string | null | undefined): boolean {
  return role === "ADMIN";
}

/** Formun tuttuğu alanlar; adları backend DTO alan adlarıyla birebir aynı. */
export type CompanyField =
  | "name"
  | "email"
  | "phoneNumber"
  | "website"
  | "description"
  | "taxNumber"
  | "type";

export type CompanyDraft = Record<CompanyField, string>;

export const emptyCompanyDraft: CompanyDraft = {
  name: "",
  email: "",
  phoneNumber: "",
  website: "",
  description: "",
  taxNumber: "",
  type: "",
};

/** `POST /companies` gövdesinin taşıdığı alanlar. */
export const createCompanyFields: readonly CompanyField[] = [
  "name",
  "email",
  "phoneNumber",
  "website",
  "description",
  "taxNumber",
  "type",
];

/**
 * `PATCH /companies/{companyId}` gövdesinin taşıdığı alanlar.
 *
 * Beşi de `UpdateCompanyRequestDto`'da yazılı; listeye bir alan eklemek
 * backend'in sessizce yok sayacağı bir yazma üretir.
 */
export const editableCompanyFields = [
  "name",
  "email",
  "phoneNumber",
  "website",
  "description",
] as const satisfies readonly CompanyField[];

export type EditableCompanyField = (typeof editableCompanyFields)[number];

export type CompanyUpdateBody = Record<EditableCompanyField, string>;

/**
 * Kurulduktan sonra değiştirilemeyen alanlar ve nedenleri.
 *
 * Ekranda gerekçesiyle birlikte duruyor: kullanıcı "neden düzenleyemiyorum"
 * sorusunun cevabını başka bir sayfada aramamalı. Liste tek yerde, çünkü
 * düzenleme ekranı ile profil aynı gerekçeyi yazıyor.
 */
export const lockedCompanyFields = [
  {
    name: "taxNumber",
    label: "Vergi numarası",
    reason:
      "Vergi numarası şirket kaydıyla birlikte kuruluyor ve sonradan değiştirilemiyor. Yanlışsa destek ekibiyle iletişime geçmen gerekiyor.",
  },
  {
    name: "type",
    label: "Şirket türü",
    reason:
      "Şirket türü kayıt anında seçiliyor ve güncelleme ucu bu alanı taşımıyor, yani sonradan değiştirilemiyor.",
  },
  {
    name: "address",
    label: "Şirket adresi",
    reason:
      "Şirket adresi kayıt anında onaylanan konuma bağlı ve güncelleme ucu adresi taşımıyor. Adres değişikliği için destek ekibiyle iletişime geçmen gerekiyor.",
  },
] as const;

/**
 * Alan bazlı Türkçe hatalar; anahtarlar backend DTO alan adlarıyla aynı, yani
 * sunucudan dönen `details[]` aynı alanların altına düşüyor.
 *
 * Denetlenecek alanlar dışarıdan geliyor: oluşturma yedi alanı, düzenleme
 * beşini gönderiyor ve düzenlemede boş bulunan vergi numarası için hata
 * yazmak kullanıcıya kapatamayacağı bir eksik gösterirdi. Kural tablosu yine
 * tek — iki liste aynı kurallardan besleniyor.
 */
export function companyDraftErrors(
  draft: CompanyDraft,
  fields: readonly CompanyField[],
): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const field of fields) {
    const message = fieldError(field, draft[field] ?? "");
    if (message) errors[field] = message;
  }

  return errors;
}

const requiredMessages: Partial<Record<CompanyField, string>> = {
  name: "Şirket adı zorunlu.",
  email: "Şirket e-postası zorunlu.",
  phoneNumber: "Telefon numarası zorunlu.",
  // Backend `taxNumber` üzerinde hiçbir biçim doğrulaması yapmıyor ve alan
  // kurulduktan sonra değiştirilemiyor. İstemcide uydurulmuş bir kalıp,
  // sunucunun kabul edeceği geçerli bir numarayı geri çevirirdi.
  taxNumber: "Vergi numarası zorunlu.",
  type: "Şirket türü zorunlu.",
};

function fieldError(field: CompanyField, raw: string): string | null {
  const value = raw.trim();

  if (!value) return requiredMessages[field] ?? null;
  if (value.length > companyTextLimit) {
    return `En fazla ${companyTextLimit} karakter olabilir.`;
  }
  if (field === "email" && !isEmail(value)) return "Geçerli bir e-posta adresi yaz.";
  if (field === "type" && !companyTypes.some((option) => option.value === value)) {
    return "Listedeki şirket türlerinden birini seç.";
  }

  return null;
}

/**
 * `@Email`in kabul ettiğinden daha dar değil, daha okunaklı bir kalıp: son
 * söz sunucuda. Amaç kullanıcıyı bir ağ turu beklemeden yazım hatasına
 * götürmek.
 */
function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * `/isveren/sirket` adresinin ne yapacağı.
 *
 * Karar `GET /users/me` yanıtındaki üyelik listesinden çıkıyor: backend'de
 * "şirketlerim" diye ayrı bir uç **yok** ve kabuk bu yanıtı zaten okudu.
 *
 * Üç durum da ayrı, çünkü ikisini birleştirmek görünür bir zarar veriyor:
 * tek şirketi olan kullanıcıyı seçim ekranından geçirmek her girişte
 * gereksiz bir tıklama ekler; birden çok şirketi olanda ilkini seçmek ise
 * ikinci şirketi adres çubuğu dışında hiçbir yerden görünmez yapar — ve
 * backend ikinci şirket açmayı hiçbir yerde engellemiyor.
 */
export type CompanySectionDestination =
  | { kind: "create" }
  | { kind: "single"; companyId: string }
  | { kind: "choose" };

export function companySectionDestination(
  companies: readonly { companyId: string }[],
): CompanySectionDestination {
  if (companies.length === 0) return { kind: "create" };
  if (companies.length === 1) return { kind: "single", companyId: companies[0].companyId };
  return { kind: "choose" };
}

/** `CreateCompanyRequestDto` gövdesi. */
export type CompanyCreateBody = {
  name: string;
  email: string;
  phoneNumber: string;
  taxNumber: string;
  type: string;
  address: AddressWrite;
  website?: string;
  description?: string;
};

/**
 * Oluşturma gövdesi; taslak eksikse ya da adres onaylanmadıysa `null`.
 *
 * Gövde beyaz listeyle kuruluyor, taslaktan kopyalanmıyor: taslağa eklenen
 * her yeni alan aksi hâlde gövdeye sızardı. Boş bırakılan opsiyonel alan hiç
 * girmez — boş dizeyi kaydetmek, kullanıcının doldurmadığı bir web adresini
 * şirket profiline yazardı.
 */
export function companyCreateBody(
  draft: CompanyDraft,
  address: AddressWrite | null,
): CompanyCreateBody | null {
  if (address === null) return null;
  if (Object.keys(companyDraftErrors(draft, createCompanyFields)).length > 0) return null;

  const body: CompanyCreateBody = {
    name: draft.name.trim(),
    email: draft.email.trim(),
    phoneNumber: draft.phoneNumber.trim(),
    taxNumber: draft.taxNumber.trim(),
    type: draft.type.trim(),
    address,
  };

  const website = draft.website.trim();
  if (website) body.website = website;
  const description = draft.description.trim();
  if (description) body.description = description;

  return body;
}

/**
 * Güncelleme gövdesi: beş alan, hepsi her zaman.
 *
 * Temizlenen alan gövdeden **çıkarılmaz**, boş dize olarak gider:
 * `updateCompany` yalnız `null` olmayan alanları uyguluyor
 * (`CompanyManager.java:281-300`), yani alanı atlamak kullanıcının sildiği
 * web adresini eski hâliyle bırakırdı.
 */
export function companyUpdateBody(draft: CompanyDraft): CompanyUpdateBody {
  return Object.fromEntries(
    editableCompanyFields.map((field) => [field, draft[field].trim()]),
  ) as CompanyUpdateBody;
}
