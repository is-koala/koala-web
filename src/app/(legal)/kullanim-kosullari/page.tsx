import type { Metadata } from "next";

export const metadata: Metadata = { title: "Kullanım Koşulları" };

/**
 * Bu sayfanın URL'i kalıcıdır. Mobil uygulama buraya bağlantı verecek
 * (bugün auth_legal_footer.dart'ta o bağlantılar ölü) ve backend'deki
 * agreement_versions.contentUrl buraya işaret edecek.
 */
export default function Page() {
  return (
    <article className="space-y-4">
      <h1 className="text-3xl font-semibold">Kullanım Koşulları</h1>
      {/* TODO(#1 Faz 0): hukuki metin. Taslak değil, onaylanmış sürüm konacak. */}
      <p className="text-neutral-600">Bu metnin içeriği hazırlanıyor.</p>
    </article>
  );
}
