import { FaqList } from "@/components/marketing/faq-list";
import { Section, SectionHeading } from "@/components/marketing/section";
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
      <Section className="mk-page-hero">
        <SectionHeading as="h1" eyebrow={faqContent.eyebrow} title={faqContent.title} intro={faqContent.intro} />
      </Section>
      <Section tone="sunken" narrow>
        <FaqList items={frequentlyAskedQuestions} />
      </Section>
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
