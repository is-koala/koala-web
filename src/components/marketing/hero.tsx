import Image from "next/image";
import Link from "next/link";

import { homeContent, jobCategories, sampleJobs } from "@/content/marketing";

import mapImage from "../../../public/brand/map-istanbul.webp";
import { CategoryPin, categoryOf } from "./category-pin";
import { Icon } from "@/components/ui/icon";
import { SampleBadge } from "./section";

const { hero } = homeContent;

/** Pinlerin kart içindeki yerleri (yüzde). Mockup'taki dağılım; veri değil. */
const pinPositions: Record<string, { left: string; top: string }> = {
  BARISTA: { left: "20%", top: "33%" },
  PHOTOGRAPHY: { left: "62%", top: "26%" },
  WAITER: { left: "38%", top: "50%" },
  PET_CARE: { left: "79%", top: "56%" },
  DESIGN: { left: "15%", top: "62%" },
};

/**
 * Ana sayfa girişi: başlık + statik harita kartı.
 *
 * Harita kartı gerçek ilan verisi çizmiyor (is-koala/koala-web#155 kabul
 * kriteri): arka plan bir görsel, pinler dekoratif, kart bir örnek ilan. Bu
 * yüzden pinler düğme değil ve kartın tek eylemi gerçek ilan listesine gider.
 */
export function Hero() {
  const featured = sampleJobs[0];
  const featuredCategory = categoryOf(featured.category);

  return (
    <section className="mk-hero home-hero" aria-labelledby="hero-title">
      <span className="mk-hero-orb mk-hero-orb-right" aria-hidden="true" />
      <span className="mk-hero-orb mk-hero-orb-left" aria-hidden="true" />
      <div className="mk-inner mk-hero-inner">
        <div className="mk-hero-copy">
          <p className="mk-badge">
            <span className="mk-dot" aria-hidden="true" />
            {hero.badge}
          </p>
          <h1 id="hero-title" className="mk-hero-title">
            <span>{hero.title[0]}</span>{" "}
            <span className="mk-hero-title-accent">{hero.title[1]}</span>
          </h1>
          <p className="mk-hero-intro">{hero.intro}</p>
          <div className="mk-actions">
            <a className="button button-primary" href={hero.primaryAction.href}>
              <Icon name="mail" />
              {hero.primaryAction.label}
            </a>
            <a className="button button-secondary" href={hero.secondaryAction.href}>
              {hero.secondaryAction.label}
            </a>
          </div>
          <p className="mk-hero-note">
            <Icon name="mobile" size={16} />
            {hero.storeNote}
          </p>
        </div>

        <div className="mk-map-card">
          <p className="visually-hidden">Örnek harita önizlemesi; pinler ve kart gerçek ilan değil.</p>
          <Image
            src={mapImage}
            alt=""
            fill
            sizes="(max-width: 900px) 100vw, 560px"
            priority
            className="mk-map-image"
          />
          <div className="mk-map-top">
            <span className="mk-map-status">
              <span className="mk-dot mk-dot-success" aria-hidden="true" />
              {hero.map.status}
            </span>
            <span className="mk-map-hint">
              <Icon name="touch" size={15} />
              {hero.map.hint}
            </span>
          </div>
          {jobCategories.map((category) => (
            <span
              key={category.code}
              className={`mk-map-pin${category.code === featured.category ? " is-active" : ""}`}
              style={pinPositions[category.code]}
            >
              <CategoryPin code={category.code} size={54} />
            </span>
          ))}
          <span className="mk-map-me" aria-hidden="true" />
          <div className="mk-map-job">
            <div className="mk-map-job-head">
              <CategoryPin code={featured.category} size={34} />
              <div className="mk-map-job-text">
                <p className="mk-map-job-meta">
                  <span>{featuredCategory.label}</span>
                  <SampleBadge label={homeContent.categories.sampleLabel} />
                </p>
                <p className="mk-map-job-title">{featured.title}</p>
                <p className="mk-map-job-employer">{featured.employer}</p>
              </div>
              <div className="mk-map-job-price">
                <strong>{featured.price}</strong>
                <span>{featured.type}</span>
              </div>
            </div>
            <div className="mk-map-job-foot">
              <span className="mk-chip">
                <Icon name="pin" size={14} />
                {featured.distance}
              </span>
              <span className="mk-chip">
                <Icon name="clock" size={14} />
                {featured.hours}
              </span>
              <Link className="button button-primary button-small" href={hero.map.applyHref}>
                {hero.map.applyLabel}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
