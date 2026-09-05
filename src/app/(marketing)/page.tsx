import Link from "next/link";
import { homeContent } from "@/content/marketing";
import { pageMetadata } from "@/lib/metadata";
import { publicEnvironment } from "@/lib/env";
import { site } from "@/lib/site";

export const metadata = pageMetadata(
  "Koala — Bugünün işi, bugünün insanı",
  site.description,
  "/",
);

export default function HomePage() {
  return (
    <div>
      <section className="hero home-hero">
        <p className="eyebrow">{homeContent.eyebrow}</p>
        <h1>{homeContent.title[0]}<br />{homeContent.title[1]}</h1>
        <p className="lede">{homeContent.intro}</p>
        <div className="button-row">
          <Link href="/is-arayanlar" className="button button-primary">{homeContent.workerAction}</Link>
          <Link href="/isverenler" className="button button-secondary">{homeContent.employerAction}</Link>
        </div>
        <div className="proof-row" aria-label="Koala'nın temel özellikleri">
          {homeContent.proofs.map((proof) => <span key={proof}>{proof}</span>)}
        </div>
      </section>
      <section className="manifesto">
        <p className="eyebrow">{homeContent.manifestoEyebrow}</p>
        <h2>{homeContent.manifesto}</h2>
      </section>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Organization",
        name: site.name,
        url: publicEnvironment().siteUrl,
        email: "info@iskoala.com",
      }) }} />
    </div>
  );
}
