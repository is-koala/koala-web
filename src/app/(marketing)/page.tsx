import { AppDemo } from "@/components/marketing/app-demo";
import { EarlyAccess } from "@/components/marketing/early-access";
import { Hero } from "@/components/marketing/hero";
import {
  About,
  Campaign,
  CategoryTicker,
  HomeFaq,
  HowItWorks,
  SampleJobs,
  Stats,
  Testimonials,
  WhyKoala,
} from "@/components/marketing/home-sections";
import { TwoSides } from "@/components/marketing/two-sides";
import { frequentlyAskedQuestions } from "@/content/marketing";
import { controllerIdentity } from "@/content/support";
import { pageMetadata } from "@/lib/metadata";
import { publicEnvironment } from "@/lib/env";
import { site } from "@/lib/site";

import { submitEarlyAccessAction } from "./actions";

export const metadata = pageMetadata(
  "Koala — Boş vaktini paraya çevir",
  site.description,
  "/",
);

/**
 * Ana sayfa. Bölüm sırası tasarımcının v2 mockup'ıyla birebir
 * (is-koala/koala-web#155): hero → kategori şeridi → örnek ilanlar → sayılar →
 * biz kimiz → neden Koala → nasıl çalışır → uygulama → kampanya → iki taraf →
 * yorumlar → SSS → erken erişim. Altbilgi tanıtım yerleşiminde.
 */
export default function HomePage() {
  return (
    <div className="mk-home">
      <Hero />
      <CategoryTicker />
      <SampleJobs />
      <Stats />
      <About />
      <WhyKoala />
      <HowItWorks />
      <AppDemo />
      <Campaign />
      <TwoSides />
      <Testimonials />
      <HomeFaq />
      <EarlyAccess action={submitEarlyAccessAction} kvkkPath={controllerIdentity.kvkkNoticePath} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Organization",
        name: site.name,
        url: publicEnvironment().siteUrl,
        email: controllerIdentity.email,
      }) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        url: publicEnvironment().siteUrl,
        mainEntity: frequentlyAskedQuestions.slice(0, 6).map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: { "@type": "Answer", text: item.answer },
        })),
      }) }} />
    </div>
  );
}
