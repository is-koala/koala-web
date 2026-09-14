import Link from "next/link";

import type { MarketingPage as MarketingPageContent } from "@/content/marketing";

import { Icon } from "@/components/ui/icon";
import { Section, SectionHeading } from "./marketing/section";

/**
 * İç tanıtım sayfalarının ortak yerleşimi: giriş, kart ızgarası, çağrı.
 *
 * Ana sayfayla aynı bileşen setini kullanıyor (#155): bölüm kabuğu, başlık
 * bloğu, düz kartlar. Kartlar numaralı ("01", "02"); `steps` verilirse adım
 * çizgisi gibi çizilir — Nasıl Çalışır sayfası bunu ister.
 */
export function MarketingPage({
  content,
  steps = false,
}: {
  content: MarketingPageContent;
  steps?: boolean;
}) {
  return (
    <article>
      <Section className="mk-page-hero">
        <SectionHeading as="h1" eyebrow={content.eyebrow} title={content.title} intro={content.intro} />
      </Section>
      <Section tone="sunken">
        {steps ? (
          <ol className="mk-steps mk-steps-page">
            {content.sections.map((section, index) => (
              <li key={section.title} className="mk-step">
                <span className="mk-step-dot" aria-hidden="true">{index + 1}</span>
                <div className="mk-step-body">
                  <h2>{section.title}</h2>
                  <p>{section.body}</p>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <ul className="mk-card-grid mk-page-grid">
            {content.sections.map((section, index) => (
              <li key={section.title} className="mk-feature-card">
                <span className="mk-feature-number" aria-hidden="true">0{index + 1}</span>
                <h2>{section.title}</h2>
                <p>{section.body}</p>
              </li>
            ))}
          </ul>
        )}
        <p className="mk-section-foot mk-page-actions">
          <Link className="button button-primary" href={content.action.href}>
            {content.action.label}
            <Icon name="arrowRight" />
          </Link>
          {content.secondaryActions?.map((action) => (
            <Link key={action.href} className="button button-secondary" href={action.href}>
              {action.label}
            </Link>
          ))}
        </p>
      </Section>
    </article>
  );
}
