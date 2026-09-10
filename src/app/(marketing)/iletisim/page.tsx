import { ControllerIdentity } from "@/components/controller-identity";
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
    <article className="hero hero-compact">
      <p className="eyebrow">{supportContent.eyebrow}</p>
      <h1>{supportContent.title}</h1>
      <p className="lede">{supportContent.intro}</p>
      <ControllerIdentity heading="Şirket ve başvuru bilgileri" />
      <SupportForm action={submitSupportAction} />
    </article>
  );
}
