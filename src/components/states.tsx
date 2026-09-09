import type { ReactNode } from "react";

import { errorPresentation } from "@/lib/errors";

import { ErrorRetryAction } from "./error-retry-action";

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
} as const;

export function LoadingState({ label = "Yükleniyor" }: { label?: string }) {
  return (
    <div role="status" className="state-card animate-pulse" aria-live="polite">
      <span className="state-kicker">Biraz bekle</span>
      <p>{label}</p>
    </div>
  );
}

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
    <div role="status" className="state-card">
      <h2>{title}</h2>
      <p>{message}</p>
      {children}
    </div>
  );
}

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
  const presentation = errorPresentation(errorCode, status);
  return (
    <div role="alert" className="state-card state-card-error">
      <h2>{presentation.title}</h2>
      <p>{presentation.message}</p>
      {presentation.action === "retry" && onRetry ? (
        <ErrorRetryAction label="Yeniden dene" onRetry={onRetry} />
      ) : null}
    </div>
  );
}
