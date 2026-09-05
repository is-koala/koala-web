import { LegalDocument } from "@/components/legal-document";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata("Mesafeli Hizmet Sözleşmesi", "Koala mesafeli hizmet sözleşmesinin yürürlükteki sürümü.", "/mesafeli-hizmet-sozlesmesi");

export default function Page() {
  return <LegalDocument slug="mesafeli-hizmet-sozlesmesi" />;
}
