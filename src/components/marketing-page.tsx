import type { MarketingPage as MarketingPageContent } from "@/content/marketing";

export function MarketingPage({ content }: { content: MarketingPageContent }) {
  return (
    <article>
      <header className="hero hero-compact">
        <p className="eyebrow">{content.eyebrow}</p>
        <h1>{content.title}</h1>
        <p className="lede">{content.intro}</p>
      </header>
      <div className="feature-grid">
        {content.sections.map((section, index) => (
          <section className="feature-card" key={section.title}>
            <span className="feature-number" aria-hidden="true">0{index + 1}</span>
            <h2>{section.title}</h2>
            <p>{section.body}</p>
          </section>
        ))}
      </div>
    </article>
  );
}
