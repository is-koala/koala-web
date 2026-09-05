import type { Metadata } from "next";

export const metadata: Metadata = { title: "İş Arayanlar" };

export default function Page() {
  return (
    <article className="space-y-4">
      <h1 className="text-3xl font-semibold">İş Arayanlar</h1>
      <p className="text-neutral-600">Yakınındaki günlük işleri keşfet, tek dokunuşla başvur.</p>
      {/* TODO(#1 Faz 0): içerik yazılacak. */}
    </article>
  );
}
