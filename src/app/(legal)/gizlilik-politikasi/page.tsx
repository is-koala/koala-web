import { LegalDocument } from "@/components/legal-document";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata("Gizlilik Politikası", "Koala gizlilik politikasının yürürlükteki sürümü.", "/gizlilik-politikasi");
export default function Page() {
  return <LegalDocument slug="gizlilik-politikasi" />;
}
