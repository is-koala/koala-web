import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import type { CanonicalAddress } from "@/address/contract";
import { canonicalAddressFrom } from "@/address/read";
import type { Education, Experience } from "@/lib/profile";
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
  id: string;
  firstName: string;
  lastName: string;
  /** Kabuğun başlığında görünen ad; ad soyad boşsa e-postaya düşer. */
  displayName: string;
  email: string;
  phoneNumber: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  profilePictureUrl: string | null;
  jobTitle: string | null;
  about: string | null;
  qualifications: string | null;
  interests: string | null;
  experiences: readonly Experience[];
  educations: readonly Education[];
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
  /** Destekle paylaşılabilir sunucu takip kimliği; ham hata metni değildir. */
  requestId?: string;
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
 * Fatura adresi ekranının okuduğu kayıtlı adres.
 *
 * Aynı `GET /users/me` turundan gelir; değeri Viewer'a koymak her kabuk
 * sayfasının RSC yüküne sokak adresini yazardı. Kapılar yalnız `hasAddress`
 * sorar.
 */
export function currentUserAddress(): Promise<CanonicalAddress | null> {
  return loadProfile().then((loaded) => loaded.address);
}

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
  const { viewer, failure } = await loadProfile();
  return { viewer, failure };
}

type ProfileLoad = ViewerContext & { address: CanonicalAddress | null };

const loadProfile: () => Promise<ProfileLoad> = cache(async () => {
  try {
    const response = await apiRequest<UserMeResponse | null>(backendPaths.usersMe);

    // `apiFetch` gövdesiz başarılı yanıtı `null` olarak döndürür. `/users/me`
    // için bu bir sözleşme ihlali; adı ve bayrakları boş bir kullanıcıyla
    // kabuğu çizmek, arızayı kullanıcının hesabıymış gibi gösterirdi.
    if (response === null) return { viewer: null, failure: unusableProfile, address: null };

    return {
      viewer: toViewer(response),
      failure: null,
      address: canonicalAddressFrom(response.address),
    };
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

    return {
      viewer: null,
      failure: {
        status: error.status,
        errorCode: error.errorCode,
        ...(error.requestId ? { requestId: error.requestId } : {}),
      },
      address: null,
    };
  }
});

/** HTTP başarılı, gövde kullanılamaz: durum kodu yok, nötr metne düşülür. */
const unusableProfile: ViewerFailure = { status: 0, errorCode: unexpectedError };

/** Backend zarfının içinden gelen ham gövde. */
type UserMeResponse = {
  id?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  profilePictureUrl?: string | null;
  jobTitle?: string | null;
  about?: string | null;
  qualifications?: string | null;
  interests?: string | null;
  experiences?: readonly Experience[] | null;
  educations?: readonly Education[] | null;
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
    id: response.id ?? "",
    firstName,
    lastName,
    displayName: `${firstName} ${lastName}`.trim() || email,
    email,
    phoneNumber: response.phoneNumber ?? "",
    emailVerified: response.emailVerified === true,
    phoneVerified: response.phoneVerified === true,
    profilePictureUrl: response.profilePictureUrl ?? null,
    jobTitle: response.jobTitle ?? null,
    about: response.about ?? null,
    qualifications: response.qualifications ?? null,
    interests: response.interests ?? null,
    experiences: (response.experiences ?? []).map(toExperience),
    educations: (response.educations ?? []).map(toEducation),
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

function toExperience(experience: Experience): Experience {
  return {
    id: experience.id,
    title: experience.title,
    companyName: experience.companyName ?? null,
    employmentType: experience.employmentType ?? null,
    cityName: experience.cityName ?? null,
    startDate: experience.startDate,
    endDate: experience.endDate ?? null,
    description: experience.description ?? null,
  };
}

function toEducation(education: Education): Education {
  return {
    id: education.id,
    universityId: education.universityId,
    universityName: education.universityName,
    facultyId: education.facultyId,
    facultyName: education.facultyName,
    departmentId: education.departmentId,
    departmentName: education.departmentName,
    type: education.type,
    gpa: education.gpa,
    startDate: education.startDate,
    endDate: education.endDate ?? null,
  };
}
