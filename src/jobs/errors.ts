import type { ErrorCatalog } from "@/lib/error-presentation";

/**
 * İlan yönetiminin (açma, kapatma, iptal) hata metinleri.
 *
 * Başvuru reddi (`JOB_APPLICATION_*`) ve liste sıralaması reddi
 * (`PAGE_SORT_FIELD_NOT_ALLOWED`) burada değil, `@/lib/public-errors`
 * içinde: o kodlar herkese açık ilan sayfalarında görünüyor.
 */
export const jobManagementErrors: ErrorCatalog = {
  // Bireysel ilanın üç reddi. Üçü de aile metnine düşseydi ("Bilgileri kontrol
  // et" / "Bu işlem için yetkin yok") kullanıcı ne yapması gerektiğini
  // okuyamazdı: yapılacak iş her birinde farklı ve hiçbiri alanları gözden
  // geçirmek değil.
  JOB_INDIVIDUAL_JOB_CANNOT_REQUIRE_INSURANCE: {
    title: "Bu kategori bireysel ilanla açılamıyor",
    message:
      "Seçtiğin işte sigorta zorunlu. Sigorta yükümlülüğü işverene ait olduğu için bu iş yalnızca şirket ilanı olarak açılabiliyor.",
    action: "none",
  },
  JOB_INDIVIDUAL_EMPLOYER_IDENTITY_NOT_VERIFIED: {
    title: "Kimliğini doğrulaman gerekiyor",
    message:
      "İlanı yayımlayabilmen için önce kimliğini doğrulamalısın. Dört kimlik fotoğrafını yükleyebilirsin.",
    action: "none",
  },
  JOB_USER_IS_NOT_EMPLOYER: {
    title: "Bu hesap işveren hesabı değil",
    message:
      "İşveren olup olmadığın kayıt sırasında seçiliyor ve bugün değiştirilemiyor. İlan açmak için işveren olarak yeni bir hesap açman gerekiyor.",
    action: "home",
  },
  // Şirket ilanının iki reddi. `validation` aile metni ("Gönderdiğin
  // bilgilerden bazıları geçerli değil") ikisinde de yanlış olurdu: ilkinde
  // düzeltilecek alan sigorta koşulu, ikincisinde kullanıcının formda
  // düzeltebileceği hiçbir şey yok.
  JOB_JOB_CATEGORY_REQUIRES_INSURANCE: {
    title: "Bu kategoride sigortalı çalışma zorunlu",
    message:
      "Seçtiğin işte sigorta zorunlu, yani ilan sigortalı çalışma koşuluyla açılmalı. Kategoriyi değiştirebilir ya da sigorta koşulunu kabul edip yeniden deneyebilirsin.",
    action: "none",
  },
  JOB_USER_IS_NOT_A_CONTACT_OF_COMPANY: {
    title: "Bu şirketin yetkilisi değilsin",
    message:
      "İlanı yalnız şirketin yetkili listesindeki kişiler açabilir. Şirket yöneticisinden seni yetkili olarak eklemesini isteyebilirsin.",
    action: "none",
  },
  // İlanın üç durum geçişi reddi. Üçü de `conflict` ailesinde, ama aile
  // metni ("Bu kayıt başka bir duruma geçmiş olabilir") üçünü de aynı şeye
  // benzetirdi: ilkinde ilan çoktan kapanmış, ikincisinde kapanış kalıcı,
  // üçüncüsünde ise ilanın kendisinde bir sorun yok ve engel başka bir
  // kayıtta duruyor.
  JOB_NOT_OPEN: {
    title: "Bu ilan artık yayında değil",
    message:
      "İlan bu sırada kapatılmış ya da iptal edilmiş olabilir. Sayfayı yenileyip güncel durumu görebilirsin.",
    action: "retry",
  },
  JOB_NOT_CANCELLABLE: {
    title: "Bu ilan iptal edilemiyor",
    message:
      "İlan zaten iptal edilmiş ya da tamamlanmış görünüyor. Sayfayı yenileyip güncel durumu görebilirsin.",
    action: "retry",
  },
  // `JobManager.java:395-397`: canlı atama koşulu istemciden okunamıyor —
  // `JobDetailDto.hiredCount` başka bir durum kümesini sayıyor, yani bu redde
  // düşmeden önce düğmeyi gizlemek mümkün değil. Metin bu yüzden kullanıcıyı
  // eli boş bırakmayıp atamanın kendi akışına yolluyor.
  JOB_HAS_LIVE_ASSIGNMENT: {
    title: "İlanda devam eden bir atama var",
    message:
      "İlanı iptal etmeden önce atamayı kendi iptal akışından iptal etmen gerekiyor; kesinti ve iade tutarı orada hesaplanıyor.",
    action: "none",
  },
};
