/**
 * Yetki kapılarının sözlüğü.
 *
 * Bir kapı, kullanıcının bir eyleme kalkışmadan **önce** okunabilen bir
 * koşuldur: değer üreten her eylem backend'de sert bir kapının arkasında ve
 * kullanıcı bunu formu doldurduktan sonra öğrenirse akış çöker.
 *
 * Sözlük burada, karar `@/server/session/gates`, metin `@/lib/errors` içinde.
 * Ayrı duruyorlar çünkü rota kaydı (`@/lib/app-routes`) sunucu katmanını içe
 * aktaramaz, ama hangi kapıyı istediğini bildirmek zorunda.
 */

/** Bildirilebilir kapılar. */
export type GateId =
  | "identityVerification"
  | "identityNumber"
  | "employerRole"
  | "companyContact"
  | "companyApproval"
  | "individualBillingAddress"
  | "companyBillingAddress";

/**
 * Kapının nerede duyurulduğu.
 *
 * - `advisory`: kabuğun tamamında duran kalıcı bir şerit. Kabuk kullanılabilir
 *   kalır; kullanıcı doğrulamayı bitirmeden de gezinebilir.
 * - `blocking`: şerit yok, eylemin kendisi devre dışı ve nedeni yanında yazılı.
 *
 * İkisi de arkalarındaki eylemi kapatır; ayrıldıkları yer kullanıcının nedeni
 * **nerede** okuduğu.
 */
export type GateMode = "advisory" | "blocking";

export const gateModes: Readonly<Record<GateId, GateMode>> = {
  // Kimlik doğrulaması bütün kabuğu ilgilendiriyor ve tek bir eyleme
  // bağlanamıyor: üç ayrı backend kapısı ona bakıyor.
  identityVerification: "advisory",
  // Fatura adresi yalnız ödeme anında ısırıyor, ama o an ilan çoktan açılmış
  // ve işçi kabul edilmiş oluyor; geri dönüşü pahalı olduğu için önceden
  // duyuruluyor.
  individualBillingAddress: "advisory",
  companyBillingAddress: "advisory",
  identityNumber: "blocking",
  employerRole: "blocking",
  companyContact: "blocking",
  companyApproval: "blocking",
};

export function gatesInMode(gates: readonly GateId[], mode: GateMode): readonly GateId[] {
  return gates.filter((gate) => gateModes[gate] === mode);
}
