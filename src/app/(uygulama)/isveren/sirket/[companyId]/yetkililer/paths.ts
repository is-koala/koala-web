/**
 * Bu ekranın adresi ve kimlik biçimi.
 *
 * Sayfa ile Server Action aynı yolu iki ayrı yerde kurmasın diye tek yerde
 * duruyor: `revalidatePath` yanlış yolu tazelerse çıkarılan yetkili ekranda
 * kalır ve hata hiçbir yerde görünmez.
 *
 * Dosya adı bilerek `paths.ts`: App Router `route.ts` adını HTTP handler'ı
 * için ayırıyor ve aynı klasördeki `page.tsx` ile çakışırdı.
 */

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Kalıcı adres; `AGENTS.md` gereği yeniden adlandırılmaz. */
export function contactsPath(companyId: string): string {
  return `/isveren/sirket/${companyId}/yetkililer`;
}

export function isCompanyRecordId(value: string): boolean {
  return uuidPattern.test(value);
}
