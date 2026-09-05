import type { Metadata } from "next";

export const metadata: Metadata = { title: "Hakkımızda" };

export default function Page() {
  return (
    <article className="space-y-4">
      <h1 className="text-3xl font-semibold">Hakkımızda</h1>
      <p className="text-neutral-600">Koala&apos;nın ne yaptığı ve neden yaptığı.</p>
      {/* TODO(#1 Faz 0): içerik yazılacak. */}
    </article>
  );
}
