import type { CanonicalAddress } from "@/address/contract";

/**
 * Sunucu action'ı ile formun paylaştığı durum.
 *
 * Yalnız `errorCode`, HTTP durumu ve alan bazlı metinler taşınır: formun üst
 * bandındaki metin istemcide `errorPresentation` ile seçilir, böylece
 * backend'in ham mesajı ekrana hiç düşmez ve dallanma metne göre yapılamaz
 * (`AGENTS.md`). Alan hataları ayrı, çünkü backend onları zaten çözülmüş
 * Türkçe olarak `details[]` içinde veriyor (`FieldError`).
 */
export type FormState =
  | { status: "idle" }
  /**
   * İşlem tamamlandı ve sayfa değişmiyor; form yerine onay paneli çizilir.
   * `unchanged`: gönderilecek bir değişiklik yoktu ve backend'e gidilmedi.
   */
  | { status: "done"; unchanged?: true }
  | {
      status: "error";
      errorCode: string;
      httpStatus: number;
      fieldErrors?: Readonly<Record<string, string>>;
    };

export const idleFormState: FormState = { status: "idle" };

/** `useActionState` ile eşleşen sunucu action imzası. */
export type FormAction = (state: FormState, formData: FormData) => Promise<FormState>;

/** Alanın altına yazılacak metin; yalnız hata durumunda dolu. */
export function fieldError(state: FormState, name: string): string | undefined {
  return state.status === "error" ? state.fieldErrors?.[name] : undefined;
}

/**
 * Reddin ekrana taşınan tek gövdesi.
 *
 * `failureView` bunu döndürüyor ve her durum birliğinin hata dalı aynı iki
 * alanı yazıyordu. Dallanma `errorCode` ile yapılıyor, mesaj metniyle asla
 * (`AGENTS.md`); çift olarak durmaları o kuralı her kopyada yeniden yazma
 * riskini taşıyordu.
 */
export type ActionFailure = {
  readonly errorCode: string;
  readonly httpStatus: number;
};

/** `useActionState` imzası; durumun kendisini çağıran seçiyor. */
export type ActionFor<State> = (state: State, formData: FormData) => Promise<State>;

/**
 * Kanonik adresi tek bir yazma ucuna bağlayan üç formun (bireysel fatura
 * adresi, aday adresi, şirket adresi) paylaştığı durum: bitişte kaydedilen
 * adres geri gelir ki ekran onu yeniden çekmeden gösterebilsin. Kabuğu
 * `@/components/address-form-shell` çiziyor; durum burada, çünkü
 * `"use server"` eylemleri bir istemci modülünden değer alamaz.
 */
export type AddressFormState =
  | { status: "idle" }
  | { status: "done"; address: CanonicalAddress }
  | Extract<FormState, { status: "error" }>;

export const idleAddressFormState: AddressFormState = { status: "idle" };

/**
 * Kimliğini kendi içinde taşıyan eylem durumu.
 *
 * Bir liste tek bir `useActionState` paylaştığında cevabın **hangi satıra**
 * ait olduğu başka türlü okunamıyor: durum kimliği taşımazsa ikinci satıra
 * verilen cevap ilkinin altına çizilir. Aynı üçlü — birlik, `idle` sabiti,
 * action imzası — bu yüzden ekran ekran kopyalanıyordu.
 *
 * Kimliğin **adı** ekrana bırakılıyor (`"userId"`, `"applicationId"`): tek bir
 * `key` alanı okunurluğu düşürür ve iki farklı kimliği aynı isimde toplardı.
 *
 * `FormState`'in yerini almıyor. O birlik kimliksiz ve alan bazlı hata metni
 * taşıyor; formlar onu, satır başına cevap veren listeler bunu kullanır.
 */
export type KeyedActionState<Key extends string, Done> =
  | { readonly status: "idle" }
  | (Readonly<Record<Key, string>> & Done & { readonly status: "done" })
  | (Readonly<Record<Key, string>> & ActionFailure & { readonly status: "error" });

/** Her durum birliğinin başlangıcı; `idle` dalı hepsinde aynı. */
export const idleActionState = { status: "idle" } as const;
