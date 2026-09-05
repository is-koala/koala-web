import { LegalDocument } from "@/components/legal-document";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata("Çerez Politikası", "Koala çerez politikasının yürürlükteki sürümü.", "/cerez-politikasi");
export default function Page() {
  return <LegalDocument slug="cerez-politikasi" />;
}
