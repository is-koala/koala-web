import "server-only";

import type { CanonicalAddress } from "@/address/contract";
import { canonicalAddressFrom } from "@/address/read";
import type { CompanyCreateBody, CompanyUpdateBody } from "@/lib/company";
import type { CompanyContact } from "@/lib/company-contacts";
import { apiRequest } from "@/server/session/session";

/**
 * Şirket kaydının sunucu tarafı.
 *
 * Tarayıcı `api.iskoala.com` ile hiç konuşmuyor (ADR-0011): şirket
 * oluşturma, okuma, güncelleme ve logo uçlarının hepsi bu modülden ve yalnız
 * `apiRequest` üzerinden geçiyor, yani süresi dolmuş erişim tokenı sessizce
 * yenileniyor.
 *
 * Yetkilendirme burada tekrarlanmıyor: yazan uçların hepsi kendi kapısını
 * taşıyor (`requireCompanyAdmin`) ve geçemeyen çağrıya **404** dönüyor —
 * üyesi olunmayan şirket ile var olmayan şirket `errorCode` dahil ayırt
 * edilemez. Modül bu ayrımı yapmaya çalışmaz; hatayı olduğu gibi yukarı
 * taşır ve metni `@/lib/errors` seçer.
 */

/** `AddressDto`'nun şirket profilinde okunan parçası. */
type CompanyAddressResponse = {
  countryName?: string | null;
  cityName?: string | null;
  districtName?: string | null;
  components?: CanonicalAddress["components"] | null;
  displayAddress?: string | null;
  needsReview?: boolean;
  position?: { latitude?: number | string | null; longitude?: number | string | null } | null;
};

/** `CompanyDto`. Yalnız ekranda görünen ve karar veren alanlar taşınıyor. */
export type Company = {
  id: string;
  name: string;
  email: string;
  logoUrl: string | null;
  phoneNumber: string;
  website: string | null;
  description: string | null;
  taxNumber: string;
  /** Bilinmeyen bir değer de metin olarak taşınır; etiketi `companyTypeLabel` seçer. */
  type: string;
  address: CanonicalAddress | null;
  contacts: readonly CompanyContact[];
  followerCount: number;
  /**
   * Admin onayı. `CompanyManager.approveCompany` yalnız bayrağı çeviriyor ve
   * **hiçbir bildirim göndermiyor**; kullanıcı durumu ancak bu alanı yeniden
   * okuyarak öğrenir (is-koala/koala-backend#62).
   */
  approved: boolean;
};

type CompanyResponse = {
  id?: string | null;
  name?: string | null;
  email?: string | null;
  logoUrl?: string | null;
  phoneNumber?: string | null;
  website?: string | null;
  description?: string | null;
  taxNumber?: string | null;
  type?: string | null;
  address?: CompanyAddressResponse | null;
  companyContacts?: readonly CompanyContact[] | null;
  followerCount?: number | null;
  approved?: boolean;
};

/**
 * `POST /companies` — yalnız `multipart/form-data`.
 *
 * Logo aynı isteğin ikinci parçası, ayrı bir çağrı değil: şirket kurulup
 * logo yüklemesi düşerse kullanıcı **silinemeyen** ve logosuz kalan bir
 * şirketle kalırdı (`DELETE /companies/{id}` yok).
 */
export async function createCompany(
  details: CompanyCreateBody,
  logo: File | null,
): Promise<Company> {
  const body = new FormData();

  /*
   * Parçanın kendi içerik tipi `application/json` olmak zorunda:
   * `@RequestPart("company")` düz metin bir parçayı `CreateCompanyRequestDto`
   * olarak çözemez ve istek alan hatası bile taşımayan bir 400'e düşer.
   * `Blob` bunu söylemenin tek yolu — `FormData` düz dizeye tip yazamıyor.
   */
  body.append("company", new Blob([JSON.stringify(details)], { type: "application/json" }));

  // Boş bir parça bile `uploadValidator` tarafından "boş dosya" diye
  // reddedilir; logo seçilmediyse parça hiç eklenmez. Dosya adı ayrıca
  // geçilmiyor: `FormData` üçüncü argümanla yeni bir `File` üretiyor ve
  // `uploadValidator` uzantıyı **özgün dosya adından** okuduğu için adın
  // olduğu gibi taşınması gerekiyor.
  if (logo) body.append("logo", logo);

  return toCompany(await apiRequest<CompanyResponse | null>("/companies", { method: "POST", body }));
}

/**
 * `GET /companies/{companyId}`.
 *
 * Uç üyelik denetimi **yapmıyor** (`CompanyManager.java:267-273`): oturumu
 * olan herkes vergi numarası, e-posta, telefon ve tam adres dahil bütün
 * `CompanyDto`'yu okuyabiliyor. Web bu ucu yalnız kullanıcının kendi
 * şirketi için çağırır; kurumsal bilgileri herkese açık bir sayfada
 * göstermek bu boşluğu ürüne taşırdı.
 */
export async function getCompany(companyId: string): Promise<Company> {
  return toCompany(await apiRequest<CompanyResponse | null>(companyPath(companyId)));
}

/**
 * `PATCH /companies/{companyId}` — yalnız `ADMIN`.
 *
 * Beş metin alanı ve 0.9.24'ten beri isteğe bağlı `address`
 * (is-koala/koala-backend#288). Backend yalnız gönderilen alanları
 * uyguluyor; adres verildiğinde yeni bir adres kaydı açılıp şirkete
 * bağlanıyor ve yanıttaki `address` güncel kaydı taşıyor.
 */
export async function updateCompany(
  companyId: string,
  body: CompanyUpdateBody,
): Promise<Company> {
  return toCompany(
    await apiRequest<CompanyResponse | null>(companyPath(companyId), { method: "PATCH", body }),
  );
}

/**
 * `PUT /companies/{companyId}/logo` — multipart, parça adı `logo`.
 *
 * Şirket güncellemesinden ayrı bir uç, bu yüzden ayrı bir eylem: formun
 * kaydetmesine bağlamak, hiçbir alanı değiştirmeden logo değiştirmek isteyen
 * kullanıcıya beş alanı yeniden gönderttirirdi.
 */
export async function replaceCompanyLogo(companyId: string, logo: File): Promise<Company> {
  const body = new FormData();
  body.append("logo", logo);

  return toCompany(
    await apiRequest<CompanyResponse | null>(`${companyPath(companyId)}/logo`, {
      method: "PUT",
      body,
    }),
  );
}

/** `DELETE /companies/{companyId}/logo` — bağlantı düşer, depodaki nesne kalır. */
export async function removeCompanyLogo(companyId: string): Promise<Company> {
  return toCompany(
    await apiRequest<CompanyResponse | null>(`${companyPath(companyId)}/logo`, {
      method: "DELETE",
    }),
  );
}

/**
 * Bir şirket kaynağının backend adresi.
 *
 * Dışa açık, çünkü şirketin altında başka modüllerin sahiplendiği uçlar var:
 * `POST /companies/{companyId}/jobs` ilan modülünün işi ama yolun şirket
 * parçası buranın. İki yerde kurulsaydı biri kaçırmayı unutabilirdi — kimlik
 * adres çubuğundan geliyor ve kaçırılmadan birleştirmek yolu değiştirebilir.
 */
export function companyPath(companyId: string): string {
  return `/companies/${encodeURIComponent(companyId)}`;
}

/**
 * Zarfın içinden gelen gövdeyi ekranın okuduğu biçime daraltır.
 *
 * Gövdesiz başarılı yanıt (`null`) burada boş bir şirkete dönüşür ve
 * `id` boş kalır; çağıran onu yönlendirme kararında okuyor.
 */
function toCompany(response: CompanyResponse | null): Company {
  const source = response ?? {};

  return {
    id: source.id ?? "",
    name: source.name ?? "",
    email: source.email ?? "",
    logoUrl: source.logoUrl ?? null,
    phoneNumber: source.phoneNumber ?? "",
    website: source.website ?? null,
    description: source.description ?? null,
    taxNumber: source.taxNumber ?? "",
    type: source.type ?? "",
    address: toAddress(source.address),
    contacts: source.companyContacts ?? [],
    followerCount: source.followerCount ?? 0,
    approved: source.approved === true,
  };
}

function toAddress(address: CompanyAddressResponse | null | undefined): CanonicalAddress | null {
  return canonicalAddressFrom(address);
}
