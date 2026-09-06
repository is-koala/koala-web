import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { ApiError } from "@/server/api/errors";
import { backendPaths, unauthorizedStatus, unexpectedError } from "@/server/contract";

import { requireSessionForCurrentPath } from "./guard";
import { currentPathLoginRedirect } from "./login-redirect";
import { apiRequest } from "./session";

/** `CompanyMembershipDto`. Bir kullanıcı birden çok şirkette yetkili olabilir. */
export type ViewerCompany = {
  companyId: string;
  companyName: string;
  /** `CompanyContactRole`; bilinmeyen bir değer geldiğinde de metin olarak taşınır. */
  role: string;
  /** Admin onayı. Birden çok şirkette her üyeliğin kendi değeri var. */
  approved: boolean;
};

/**
 * Kabuğun ve altındaki sayfaların tanıdığı kullanıcı.
 *
 * `UserMeResponseDto`'nun tamamı değil, iki kurala göre daraltılmış hâli:
 *
 * 1. **Ekranda görüneni ve kapıların sorduğunu taşır.** Bir alan buraya ancak
 *    bir sayfa onu çiziyorsa ya da bir kapı ona bakıyorsa eklenir; "ileride
 *    lazım olur" diye eklenmez. Yanıt zaten alınmış olduğu için genişletmek
 *    tek satır.
 * 2. **Hassas alanlar değer olarak değil, varlık olarak.** Kimlik numarası ve
 *    adres yalnız "var mı" sorusuna cevap verir. Kapıların sorduğu soru bu; ham
 *    değeri kabuğa çıkarmak hiçbir kapıyı açmaz, ama veriyi log'a, Sentry
 *    olayına ve ölçümlemeye açık hâle getirirdi.
 *
 * Kapı **kararları** — "bireysel ilan açabilir mi", "ödeme oturumu açabilir
 * mi" — burada yok; onlar is-koala/koala-web#26'nın işi ve bu alanlardan
 * türetilecek.
 */
export type Viewer = {
  firstName: string;
  /** Kabuğun başlığında görünen ad; ad soyad boşsa e-postaya düşer. */
  displayName: string;
  /** JSON'da `isEmployer`; Java alan adı `employer` okunmaz. */
  isEmployer: boolean;
  identityVerified: boolean;
  /** Maskeli TC dolu mu — ödeme kapısının `identityVerified` yanındaki ikinci koşulu. */
  hasIdentityNumber: boolean;
  /** Bireysel işverenin fatura adresi kapısı. Şirket ilanı şirketin adresini okur. */
  hasAddress: boolean;
  companies: readonly ViewerCompany[];
};

/**
 * Profil okunamadı. Metin değil kod taşır: ekran metni `@/lib/errors` üzerinden
 * üretilir, backend'in ham mesajı hiçbir yere basılmaz.
 */
export type ViewerFailure = {
  status: number;
  errorCode: string;
};

export type ViewerContext = {
  viewer: Viewer | null;
  failure: ViewerFailure | null;
};

/**
 * Bu isteğin kullanıcı bağlamı.
 *
 * `cache()` React'in render süresince yaşayan not defteri: kabuğun menüyü
 * çizmek için sorduğu `GET /users/me` ile altındaki sayfanın sorduğu aynı
 * çağrıya düşer. Önbellek istekten uzun yaşamaz, bu yüzden iptal edilmiş bir
 * şirket üyeliği bir sonraki gezinmede görünür.
 *
 * Kabuk altındaki her sayfanın kullanıcıyı okuduğu tek yer burasıdır; ikinci
 * bir `/users/me` çağrısı `server-only.test.ts` ile yasak.
 */
export const currentViewer: () => Promise<ViewerContext> = cache(loadViewer);

/**
 * Kabuk layout'unun tek satırı: önce oturum kapısı, sonra bağlam.
 *
 * İki kabuk da aynı sırayı izlemek zorunda. Bağlam kapıdan önce okunsaydı
 * oturumsuz ziyaretçi giriş sayfasına gitmeden önce backend'e bir tur
 * attırırdı; ikisi ayrı ayrı yazılsaydı sıra bir kabukta ters kalabilirdi.
 */
export async function enterShell(): Promise<ViewerContext> {
  await requireSessionForCurrentPath();
  return currentViewer();
}

/**
 * Sarmalanmamış hâli. Testler bir React render'ı kurmadan davranışı
 * sürebilsin diye dışa açık; üretimde `currentViewer` çağrılır.
 */
export async function loadViewer(): Promise<ViewerContext> {
  try {
    const response = await apiRequest<UserMeResponse | null>(backendPaths.usersMe);

    // `apiFetch` gövdesiz başarılı yanıtı `null` olarak döndürür. `/users/me`
    // için bu bir sözleşme ihlali; adı ve bayrakları boş bir kullanıcıyla
    // kabuğu çizmek, arızayı kullanıcının hesabıymış gibi gösterirdi.
    if (response === null) return { viewer: null, failure: unusableProfile };

    return { viewer: toViewer(response), failure: null };
  } catch (error) {
    // Yalnız backend hatası ekrana dönüşür. Oturum render ortasında bitmişse
    // `apiRequest` kullanıcıyı girişe yönlendirir ve o akış bir istisnayla
    // ilerler; buradan yakalanırsa kullanıcı giriş sayfası yerine "profil
    // okunamadı" görürdü.
    if (!(error instanceof ApiError)) throw error;

    // Ayakta kalan 401: `apiRequest` tokenı yeniledi ve backend tazelenmiş
    // tokenı da reddetti, yani oturum gerçekten bitmiş. Bunu kapı arızası
    // sayıp oturumlu kabuğun içinde şerit göstermek, kullanıcıyı girişe
    // dönemeyeceği bir ekranda bırakırdı.
    if (error.status === unauthorizedStatus) redirect(await currentPathLoginRedirect());

    return { viewer: null, failure: { status: error.status, errorCode: error.errorCode } };
  }
}

/** HTTP başarılı, gövde kullanılamaz: durum kodu yok, nötr metne düşülür. */
const unusableProfile: ViewerFailure = { status: 0, errorCode: unexpectedError };

/** Backend zarfının içinden gelen ham gövde. */
type UserMeResponse = {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  isEmployer?: boolean;
  identityVerified?: boolean;
  maskedTcIdentityNumber?: string | null;
  address?: unknown;
  companies?: readonly Partial<ViewerCompany>[] | null;
};

function toViewer(response: UserMeResponse): Viewer {
  const firstName = response.firstName ?? "";
  const lastName = response.lastName ?? "";
  const email = response.email ?? "";

  return {
    firstName,
    displayName: `${firstName} ${lastName}`.trim() || email,
    isEmployer: response.isEmployer === true,
    identityVerified: response.identityVerified === true,
    hasIdentityNumber: Boolean(response.maskedTcIdentityNumber),
    hasAddress: response.address != null,
    companies: (response.companies ?? []).map((company) => ({
      companyId: company.companyId ?? "",
      companyName: company.companyName ?? "",
      role: company.role ?? "",
      approved: company.approved === true,
    })),
  };
}
