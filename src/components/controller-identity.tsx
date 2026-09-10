import Link from "next/link";

import { controllerIdentity } from "@/content/support";

export function ControllerIdentity({ heading }: { heading: string }) {
  return (
    <section className="controller-identity" aria-labelledby="controller-identity-heading">
      <h2 id="controller-identity-heading">{heading}</h2>
      <dl className="contact-grid">
        <div>
          <dt>Şirket unvanı</dt>
          <dd>{controllerIdentity.publicName}</dd>
          <p className="muted">{controllerIdentity.legalTitlePending}</p>
        </div>
        <div>
          <dt>E-posta</dt>
          <dd>
            <a className="text-link" href={`mailto:${controllerIdentity.email}`}>
              {controllerIdentity.email}
            </a>
          </dd>
        </div>
        <div>
          <dt>Adres</dt>
          <dd>
            Elektronik başvuru:{" "}
            <a className="text-link" href={`mailto:${controllerIdentity.kvkkApplicationEmail}`}>
              {controllerIdentity.kvkkApplicationEmail}
            </a>
          </dd>
          <p className="muted">{controllerIdentity.postalAddressPending}</p>
        </div>
        <div>
          <dt>KVKK veri sorumlusu başvuru adresi</dt>
          <dd>
            <a className="text-link" href={`mailto:${controllerIdentity.kvkkApplicationEmail}`}>
              {controllerIdentity.kvkkApplicationEmail}
            </a>
            {" · "}
            <Link className="text-link" href={controllerIdentity.kvkkApplicationPath}>
              İletişim formu
            </Link>
          </dd>
        </div>
      </dl>
    </section>
  );
}
