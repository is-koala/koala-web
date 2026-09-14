import { ControllerIdentity } from "@/components/controller-identity";
import { Section, SectionHeading } from "@/components/marketing/section";
import { SupportForm } from "@/components/support-form";
import { supportContent } from "@/content/support";
import { pageMetadata } from "@/lib/metadata";

import { submitSupportAction } from "./actions";

export const metadata = pageMetadata(
  "Koala ile İletişim",
  "Koala ekibine destek, KVKK başvurusu ve şikayet için ulaş.",
  "/iletisim",
);

export default function Page() {
  return (
    <article>
      <Section className="mk-page-hero">
        <SectionHeading as="h1" eyebrow={supportContent.eyebrow} title={supportContent.title} intro={supportContent.intro} />
      </Section>
      <Section tone="sunken" narrow>
        <div className="mk-form-card">
          <ControllerIdentity heading="Şirket ve başvuru bilgileri" />
          <SupportForm action={submitSupportAction} />
        </div>
      </Section>
    </article>
  );
}
