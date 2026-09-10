import { ControllerIdentity } from "@/components/controller-identity";
import { LegalDocument } from "@/components/legal-document";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata("KVKK Aydınlatma Metni", "Koala KVKK aydınlatma metninin yürürlükteki sürümü.", "/kvkk-aydinlatma");
export default function Page() {
  return (
    <>
      <LegalDocument slug="kvkk-aydinlatma" />
      <ControllerIdentity heading="Veri sorumlusu başvuru adresi" />
    </>
  );
}
