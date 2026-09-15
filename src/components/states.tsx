import type { ReactNode } from "react";

import { errorPresentation } from "@/lib/errors";
import type { FormState } from "@/lib/form-state";

import { ErrorCard } from "./error-card";
import { EmptyStateCard, type Mascot } from "./ui/empty-state";

const emptyCopy = {
  jobs: ["Henüz ilan yok", "Yeni ilanlar yayımlandığında burada görünecek."],
  /**
   * Süzgeçli aramanın boş sonucu.
   *
   * `jobs`'tan ayrı bir metin, çünkü ayrı bir durum: "henüz ilan yok" sitede
   * hiç ilan olmadığını söyler ve süzgeci daraltmış kullanıcıya yanlış bir şey
   * öğretir — o kullanıcının yapabileceği bir şey var.
   *
   * İkinci satır hiçbir süzgeci **adıyla** anmıyor ve bu bilinçli: eskiden
   * "başka bir il ya da kategori seçebilirsin" yazıyordu, yani on bir süzgecin
   * ikisini tanıyıp gerisinde kullanıcıyı yanlış yere baktırıyordu. Hangi
   * süzgeçlerin daralttığını çağıran taraf yazıyor (`JobResultList`), çünkü
   * onu bilen tek yer seçili süzgeç listesi.
   */
  jobSearch: [
    "Bu süzgeçlere uyan ilan yok",
    "Sonucu daraltan süzgeçlerden birini kaldırıp yeniden deneyebilirsin.",
  ],
  /**
   * Menzil dışı sayfa — üçüncü bir hâl.
   *
   * `jobs` ve `jobSearch`'ten ayrı, çünkü ne site boş ne de süzgeç fazla dar:
   * ilanlar var, yalnız istenen sayfa numarası listenin dışında. İkisinden
   * birini yazmak ziyaretçiye yanlış bir şey öğretirdi ve düzeltmesi için
   * yapması gereken şey de ayrı — süzgeci gevşetmek değil, var olan bir
   * sayfaya dönmek.
   */
  jobPageOutOfRange: [
    "Bu numarada bir sayfa yok",
    "İstediğin sayfa listenin dışında kaldı; ilanlar daha az sayıda sayfaya sığıyor.",
  ],
  employerJobs: [
    "Henüz ilan açmadın",
    "Kendi adına ya da yetkilisi olduğun bir şirket adına açtığın ilanlar burada listelenecek.",
  ],
  jobDetail: ["İlan bulunamadı", "Bu ilan kaldırılmış veya artık yayında olmayabilir."],
  applications: ["Henüz başvuru yok", "Başvurular burada listelenecek."],
  messages: ["Henüz mesaj yok", "Konuşmaların başladığında burada görünecek."],
  assignments: ["Henüz atama yok", "Atamaların burada görünecek."],
  employerAssignments: [
    "Henüz işveren ataman yok",
    "Bir başvuruyu kabul ettiğinde oluşan atamalar burada görünecek.",
  ],
  payouts: ["Henüz bir ödeme almadın.", "Tamamlanan işlerin ödeme çıkışları burada görünecek."],
  jobCategories: ["İş kategorisi bulunamadı", "Kategoriler yüklenemedi; sayfayı yenilemeyi dene."],
  priceQuote: [
    "Fiyat henüz hesaplanmadı",
    "Çalışana ödenecek ücreti girdiğinde Koala hizmet bedelini ve işveren toplamını burada gösteririz.",
  ],
  companyContacts: [
    "Yetkili listesi boş görünüyor",
    "Şirketin yetkilileri burada listelenecek.",
  ],
  companyInvitations: [
    "Bekleyen davet yok",
    "Gönderdiğin ve henüz cevaplanmamış davetler burada görünecek.",
  ],
  addressSuggestions: [
    "Eşleşen adres bulunamadı",
    "Sokak ya da mahalle adını farklı yazmayı deneyebilirsin.",
  ],
  gallery: [
    "Henüz görsel yok",
    "PNG, JPG, JPEG veya WEBP biçiminde görseller ekleyebilirsin.",
  ],
} as const;

export function LoadingState({ label = "Yükleniyor" }: { label?: string }) {
  return (
    <div role="status" className="state-card animate-pulse" aria-live="polite">
      <span className="state-kicker">Biraz bekle</span>
      <p>{label}</p>
    </div>
  );
}

/**
 * Boş durumun maskotu.
 *
 * Tasarım sistemi kişiliği maskota veriyor: işverenin boş listesi
 * `koala_business`, iş arayanınki `koala_worker`. Haritada olmayan türler
 * (öneri listesi, fiyat kutusu) küçük yardımcı kutular; maskot orada yer
 * kaplardı ve bilerek yok.
 */
const emptyMascot: Partial<Record<keyof typeof emptyCopy, Mascot>> = {
  jobs: "worker",
  jobSearch: "worker",
  jobPageOutOfRange: "worker",
  applications: "worker",
  messages: "worker",
  assignments: "worker",
  payouts: "worker",
  employerJobs: "employer",
  employerAssignments: "employer",
  companyContacts: "employer",
  companyInvitations: "employer",
  gallery: "employer",
};

export function EmptyState({
  kind,
  children,
}: {
  kind: keyof typeof emptyCopy;
  /** Boş durumun çıkış yolu; yalnız kullanıcının atabileceği bir adım varsa. */
  children?: ReactNode;
}) {
  const [title, message] = emptyCopy[kind];
  return (
    <EmptyStateCard title={title} message={message} mascot={emptyMascot[kind]}>
      {children}
    </EmptyStateCard>
  );
}

/**
 * Kabuğun hata kartı: `@/lib/errors` içindeki tam kataloğu okur.
 *
 * Herkese açık yüzeyler (`(marketing)`, kök `error.tsx`, giriş/kayıt
 * formları) bunu değil `PublicErrorState`'i kullanır (`public-states.tsx`);
 * bu dosya tam kataloğu taşıdığı için ilan ayrıntısının betik bütçesine
 * sığmıyor (is-koala/koala-web#177).
 */
export function ErrorState({
  errorCode,
  status,
  onRetry,
}: {
  errorCode?: string;
  status: number;
  /** Yalnız Client Component çağıranları retry kararının gerçek davranışını sağlar. */
  onRetry?: () => void;
}) {
  return <ErrorCard presentation={errorPresentation(errorCode, status)} onRetry={onRetry} />;
}

/**
 * Kabuk formunun üst bandındaki hata.
 *
 * Metin `errorPresentation` üzerinden `errorCode` ile seçilir; alan bazlı
 * mesajlar ayrıca kendi alanlarının altında görünür. `form-controls.tsx`'te
 * değil burada, çünkü katalog okuyan tek form denetimi bu ve öbür denetimler
 * herkese açık formlarda da kullanılıyor.
 */
export function FormAlert({ state }: { state: FormState }) {
  if (state.status !== "error") return null;
  return <ErrorState errorCode={state.errorCode} status={state.httpStatus} />;
}
