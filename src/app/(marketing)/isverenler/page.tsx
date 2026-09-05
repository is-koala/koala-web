import type { Metadata } from "next";

export const metadata: Metadata = { title: "İşverenler" };

export default function Page() {
  return (
    <article className="space-y-4">
      <h1 className="text-3xl font-semibold">İşverenler</h1>
      <p className="text-neutral-600">İlanını yayımla, başvuruları değerlendir, ekibini bugün kur.</p>
      {/* TODO(#1 Faz 0): içerik yazılacak. */}
    </article>
  );
}
