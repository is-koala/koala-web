import { pageMetadata } from "@/lib/metadata";
import { contactContent } from "@/content/marketing";

export const metadata = pageMetadata(
  "Koala ile İletişim",
  "Koala ekibine e-posta ile ulaş.",
  "/iletisim",
);

export default function Page() {
  return (
    <article className="hero hero-compact">
      <p className="eyebrow">{contactContent.eyebrow}</p>
      <h1>{contactContent.title}</h1>
      <p className="lede">{contactContent.intro}</p>
      <a className="button button-primary" href={`mailto:${contactContent.email}`}>{contactContent.email}</a>
    </article>
  );
}
