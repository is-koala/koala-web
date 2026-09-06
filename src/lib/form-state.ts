/**
 * Sunucu action'ı ile formun paylaştığı durum.
 *
 * Yalnız `errorCode` ve HTTP durumu taşınır: kullanıcıya görünen metin
 * istemcide `errorPresentation` ile seçilir, böylece backend'in ham mesajı
 * ekrana hiç düşmez ve dallanma metne göre yapılamaz (`AGENTS.md`).
 */
export type FormState =
  | { status: "idle" }
  | { status: "error"; errorCode: string; httpStatus: number };

export const idleFormState: FormState = { status: "idle" };
