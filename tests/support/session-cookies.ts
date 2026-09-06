import { vi } from "vitest";

/**
 * Oturum katmanının dokunduğu iki Next sınırının test taklidi.
 *
 * Çerez kavanozu ile istek başlıkları `next/headers` ardında duruyor ve
 * oturumu tüketen her modülün testi ikisini de taklit etmek zorunda. Şekli
 * her dosyada yeniden yazmak, biri değişince diğerlerinin sessizce yanlış
 * geçmesi demekti; bu yüzden tek yerde durur.
 *
 * `vi.mock` çağrıları dosyanın en üstüne taşındığı için fabrikanın dışarıdaki
 * bir değişkeni okuması yasak. Test dosyası bu modülü hem normal içe aktarır
 * hem de fabrika içinde `await import` ile çözer: ikisi de aynı örneğe düşer.
 */
export function createCookieStore() {
  const values = new Map<string, string>();
  return {
    values,
    set: vi.fn((name: string, value: string) => {
      values.set(name, value);
    }),
    delete: vi.fn((name: string) => {
      values.delete(name);
    }),
    get: (name: string) => (values.has(name) ? { name, value: values.get(name)! } : undefined),
  };
}

export const cookieStore = createCookieStore();

export const requestHeaders = new Headers();

/** Backend zarfını taşıyan yanıt; `apiFetch` gövdeyi metin olarak okur. */
export function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Başarılı backend yanıtının zarfı. */
export function envelope(data: unknown) {
  return { success: true, httpStatus: "OK", data };
}
