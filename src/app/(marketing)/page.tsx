import Link from "next/link";
import { site } from "@/lib/site";

export default function HomePage() {
  return (
    <div className="space-y-16">
      <section className="space-y-4">
        <h1 className="text-4xl font-semibold">{site.description}</h1>
        <p className="text-neutral-600">
          {/* TODO(#1 Faz 0): pazarlama metni logo ve marka dili gelince yazılacak. */}
          İşini bugün bul, bugün yap.
        </p>
        <div className="flex gap-4">
          <Link href="/is-arayanlar" className="underline">
            İş arıyorum
          </Link>
          <Link href="/isverenler" className="underline">
            Eleman arıyorum
          </Link>
        </div>
      </section>
    </div>
  );
}
