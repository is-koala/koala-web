import { LegalDocument } from "@/components/legal-document";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata("Kullanım Koşulları", "Koala kullanım koşullarının yürürlükteki sürümü.", "/kullanim-kosullari");
export default function Page() {
  return <LegalDocument slug="kullanim-kosullari" />;
}
