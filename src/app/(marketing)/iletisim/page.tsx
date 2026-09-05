import type { Metadata } from "next";

export const metadata: Metadata = { title: "İletişim" };

export default function Page() {
  return (
    <article className="space-y-4">
      <h1 className="text-3xl font-semibold">İletişim</h1>
      <p className="text-neutral-600">Bize nasıl ulaşabilirsin.</p>
      {/* TODO(#1 Faz 0): içerik yazılacak. */}
    </article>
  );
}
