import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sıkça Sorulan Sorular" };

export default function Page() {
  return (
    <article className="space-y-4">
      <h1 className="text-3xl font-semibold">Sıkça Sorulan Sorular</h1>
      <p className="text-neutral-600">En çok merak edilenler.</p>
      {/* TODO(#1 Faz 0): içerik yazılacak. */}
    </article>
  );
}
