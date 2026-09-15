import { identityVerificationPath } from "@/identity/handoff";

import { companyAddressSectionHref, employerBillingAddressPath } from "./app-routes";
import type { GateId } from "./gates";

/**
 * Bir kapının ekrandaki hâli.
 *
 * `ErrorPresentation`'dan ayrı bir tip, çünkü kaynağı da zamanı da farklı:
 * `errorPresentation` gelmiş bir backend yanıtını okur, bu ise henüz
 * yapılmamış bir isteği anlatır. Ortak olan kural aynı — ekrana çıkan metin
 * backend'in ham mesajı değil, burada yazılı Türkçe.
 *
 * Yalnız oturumlu kabuk okur (`EmployerGate`, ilan gönderimi). Herkese açık
 * sayfaların istemci paketine girmez; `app-routes` üzerinden kabuk bölüm
 * kaydını da taşıdığı için orada pahalı olurdu (is-koala/koala-web#177).
 */
export type GateNotice = {
  title: string;
  message: string;
  /** Kullanıcının kapıyı açmak için gideceği yer; yolu olmayan kapıda `null`. */
  remedy: { href: string; label: string } | null;
  /**
   * Bu kapının önden karşıladığı backend reddi.
   *
   * Eşleşme yazılı duruyor ki backend koşulu değişince kapının bayatladığı
   * görülebilsin. Boş liste "backend bunu hiç denetlemiyor" demek, yani kural
   * yalnız burada yaşıyor.
   */
  errorCodes: readonly string[];
};

/**
 * Fatura adresi #28 ile `/isveren/adres` üzerinde; iş arayan adresi #133
 * ile `/panel/adres` üzerinde. Şirket adresi şirket profilinden düzenlenir
 * (#172): kapı metni şirket kimliğini bilmiyor, bu yüzden bağlantı bölümün
 * girişine (`/isveren/sirket`) düşer ve tek şirketli kullanıcıyı giriş
 * kendisi profile bırakır.
 *
 * Kimlik kapısı `/kimlik-dogrula`'ya düşer: tarayıcı çip PA üretemez; ekran
 * dört TCKK fotoğrafını alır (koala-backend#219).
 */
const gateNotices: Readonly<Record<GateId, GateNotice>> = {
  identityVerification: {
    title: "Kimliğini doğrulaman gerekiyor",
    message:
      "İlan açmak, şirket kurmak ve başvuru yapmak için önce kimliğini doğrulamalısın. Tarayıcıda dört kimlik fotoğrafını yükleyebilirsin; personel onayından sonra damgalanır.",
    remedy: { href: identityVerificationPath, label: "Kimliğini doğrula" },
    errorCodes: [
      "JOB_INDIVIDUAL_EMPLOYER_IDENTITY_NOT_VERIFIED",
      "USER_MUST_VERIFY_IDENTITY",
      "APPLICANT_IDENTITY_NOT_VERIFIED",
    ],
  },
  identityNumber: {
    title: "Kimlik numaran hesabında kayıtlı değil",
    message:
      "Ödemeyi başlatabilmemiz için doğrulanmış kimlik numarana ihtiyacımız var. Kimlik belgelerini yükleyip personel onayından sonra bu bilgi hesabına işlenir.",
    remedy: { href: identityVerificationPath, label: "Kimliğini tamamla" },
    errorCodes: ["JOB_ASSIGNMENT_EMPLOYER_IDENTITY_NOT_VERIFIED"],
  },
  employerRole: {
    title: "Bu hesap işveren hesabı değil",
    message:
      "İşveren olup olmadığın kayıt sırasında seçiliyor ve bugün değiştirilemiyor. Bireysel ilan açmak için işveren olarak yeni bir hesap açman gerekiyor.",
    remedy: null,
    errorCodes: ["JOB_USER_IS_NOT_EMPLOYER"],
  },
  companyContact: {
    title: "Bu şirketin yetkilisi değilsin",
    message:
      "İlanı yalnız şirketin yetkili listesindeki kişiler açabilir. Şirket yöneticisinden seni yetkili olarak eklemesini isteyebilirsin.",
    remedy: null,
    errorCodes: ["JOB_USER_IS_NOT_A_CONTACT_OF_COMPANY"],
  },
  companyApproval: {
    title: "Şirketin henüz onaylanmadı",
    message:
      "Şirket kaydını ekibimiz inceliyor. Onay tamamlandığında şirket adına ilan açabileceksin.",
    remedy: null,
    // Backend bu kuralı uygulamıyor: `company.isApproved()` iş mantığının
    // hiçbir yerinde okunmuyor. Kural yalnız burada yaşıyor.
    errorCodes: [],
  },
  individualBillingAddress: {
    title: "Fatura adresin eksik",
    message:
      "Ödemeyi başlatabilmek için kendi fatura adresine ihtiyacımız var. Adresini bu siteden kaydedebilirsin.",
    remedy: { href: employerBillingAddressPath, label: "Fatura adresini ekle" },
    errorCodes: ["JOB_ASSIGNMENT_ADDRESS_NOT_PROVIDED_FOR_EMPLOYER"],
  },
  companyBillingAddress: {
    title: "Şirketin fatura adresi kayıtlı değil",
    message:
      "Ödeme şirketin adresine kesilir ve bu şirketin kayıtlı adresi yok. Şirket yöneticisi profildeki adres bölümünden ekleyebilir.",
    // Bölüm girişi tek şirketli kullanıcıyı profildeki adres bölümüne
    // bırakıyor (`companyAddressSectionHref`); kapı metni şirket kimliğini
    // taşımıyor.
    remedy: { href: companyAddressSectionHref, label: "Şirket adresini düzenle" },
    errorCodes: ["JOB_ASSIGNMENT_ADDRESS_NOT_PROVIDED_FOR_EMPLOYER"],
  },
};

export function gateNotice(gate: GateId): GateNotice {
  return gateNotices[gate];
}
