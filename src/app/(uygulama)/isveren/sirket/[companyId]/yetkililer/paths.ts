/**
 * Bu ekranın kalıcı adresi.
 *
 * Sayfa ile Server Action aynı yolu iki ayrı yerde kurmasın diye tek yerde
 * duruyor: `revalidatePath` yanlış yolu tazelerse çıkarılan yetkili ekranda
 * kalır ve hata hiçbir yerde görünmez.
 *
 * Dosya adı bilerek `paths.ts`: App Router `route.ts` adını HTTP handler'ı
 * için ayırıyor ve aynı klasördeki `page.tsx` ile çakışırdı.
 *
 * Kimlik biçimi burada değil `@/lib/identifiers`: UUID kalıbının ikinci bir
 * kopyası, biri sıkılaştırıldığında diğerinin sessizce gevşek kalması demek.
 */

/** Kalıcı adres; `AGENTS.md` gereği yeniden adlandırılmaz. */
export function contactsPath(companyId: string): string {
  return `/isveren/sirket/${companyId}/yetkililer`;
}
