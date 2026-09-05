import { faqContent, frequentlyAskedQuestions } from "@/content/marketing";
import { pageMetadata } from "@/lib/metadata";
import { publicEnvironment } from "@/lib/env";

export const metadata = pageMetadata(
  "Sıkça Sorulan Sorular",
  "Koala, ilanlar, ücretler ve adres güvenliği hakkında sık sorulan sorular.",
  "/sss",
);

export default function Page() {
  return (
    <article>
      <header className="hero hero-compact">
        <p className="eyebrow">{faqContent.eyebrow}</p>
        <h1>{faqContent.title}</h1>
        <p className="lede">{faqContent.intro}</p>
      </header>
      <div className="faq-list">
        {frequentlyAskedQuestions.map((item) => (
          <details key={item.question}>
            <summary>{item.question}</summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          url: `${publicEnvironment().siteUrl}/sss`,
          mainEntity: frequentlyAskedQuestions.map((item) => ({
            "@type": "Question",
            name: item.question,
            acceptedAnswer: { "@type": "Answer", text: item.answer },
          })),
        }) }}
      />
    </article>
  );
}
