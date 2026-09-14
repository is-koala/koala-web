import Image from "next/image";
import Link from "next/link";

import { homeContent } from "@/content/marketing";

import mascotEmployer from "../../../public/brand/maskot-isveren.webp";
import mascotWorker from "../../../public/brand/maskot-calisan.webp";
import { Icon, type IconName } from "@/components/ui/icon";
import { Section, SectionHeading } from "./section";
import { Tabs } from "./tabs";

type Side = {
  title: string;
  body: string;
  points: ReadonlyArray<{ icon: IconName; text: string }>;
  action: { label: string; href: string };
  link: { label: string; href: string };
};

function SidePanel({ side, tone, image, alt }: { side: Side; tone: "worker" | "employer"; image: typeof mascotWorker; alt: string }) {
  return (
    <div className={`mk-side mk-side-${tone}`}>
      <div className="mk-side-copy">
        <h3>{side.title}</h3>
        <p>{side.body}</p>
        <ul className="mk-side-points">
          {side.points.map((point) => (
            <li key={point.text}>
              <Icon name={point.icon} size={22} />
              {point.text}
            </li>
          ))}
        </ul>
        <div className="mk-actions">
          <a className={`button ${tone === "worker" ? "button-primary" : "button-light"}`} href={side.action.href}>
            {side.action.label}
            <Icon name="arrowRight" />
          </a>
          <Link className="mk-text-link" href={side.link.href}>
            {side.link.label}
            <Icon name="arrowRight" size={16} />
          </Link>
        </div>
      </div>
      <div className="mk-side-visual">
        <Image src={image} alt={alt} sizes="(max-width: 700px) 60vw, 280px" className="mk-side-mascot" />
      </div>
    </div>
  );
}

/**
 * İki taraf: Çalışan / İşveren anahtarı.
 *
 * Mockup işveren yüzünü yeşil bir gradyanla ayırıyor; beyaz yazı o zeminde
 * AA kontrastı geçmediği için burada koyu yeşil düz zemin kullanılıyor
 * (kampanya bölümüyle aynı renk).
 */
export function TwoSides() {
  const copy = homeContent.sides;
  return (
    <Section id="iki-taraf" labelledBy="iki-taraf-title">
      <SectionHeading id="iki-taraf-title" eyebrow={copy.eyebrow} title={copy.title} intro={copy.intro} />
      <Tabs
        label="Çalışan ya da işveren tarafı"
        variant="segmented"
        items={[
          {
            id: "calisan",
            label: copy.worker.label,
            panel: <SidePanel side={copy.worker} tone="worker" image={mascotWorker} alt="Öğrenci koala" />,
          },
          {
            id: "isveren",
            label: copy.employer.label,
            panel: <SidePanel side={copy.employer} tone="employer" image={mascotEmployer} alt="İşveren koala" />,
          },
        ]}
      />
    </Section>
  );
}
