import type { Metadata } from "next";

export const metadata: Metadata = { title: "Nasıl Çalışır" };

export default function Page() {
  return (
    <article className="space-y-4">
      <h1 className="text-3xl font-semibold">Nasıl Çalışır</h1>
      <p className="text-neutral-600">İlandan ödemeye kadar süreç.</p>
      {/* TODO(#1 Faz 0): içerik yazılacak. */}
    </article>
  );
}
