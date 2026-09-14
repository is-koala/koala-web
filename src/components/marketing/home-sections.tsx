import Image from "next/image";
import Link from "next/link";

import {
  frequentlyAskedQuestions,
  homeContent,
  jobCategories,
  sampleJobs,
} from "@/content/marketing";

import poster from "../../../public/brand/afis-post.webp";
import head from "../../../public/brand/head.png";
import markWhite from "../../../public/brand/mark-white.png";
import mascot1 from "../../../public/brand/maskot-1.webp";
import mascot2 from "../../../public/brand/maskot-2.webp";
import mascot3 from "../../../public/brand/maskot-3.webp";
import { CategoryPin, categoryOf } from "./category-pin";
import { FaqList } from "./faq-list";
import { Icon } from "./icon";
import { IconTile, SampleBadge, Section, SectionHeading } from "./section";

const mascots = { 1: mascot1, 2: mascot2, 3: mascot3 } as const;
const headRatio = 283 / 197;
const markRatio = 461 / 320;

/**
 * Kategori şeridi. Kayan bant dekoratif ve içerik iki kez çizilir ki döngü
 * kesintisiz olsun; ikinci kopya ekran okuyucudan gizli. Hareket
 * `prefers-reduced-motion` altında durur (globals.css).
 */
export function CategoryTicker() {
  const items = homeContent.ticker;
  return (
    <div className="mk-ticker" aria-label="Kategoriler ve örnek günlük ücretler">
      <div className="mk-ticker-track">
        {[0, 1].map((copy) => (
          <ul key={copy} className="mk-ticker-list" aria-hidden={copy === 1 ? true : undefined}>
            {items.map((item) => (
              <li key={`${copy}-${item.category}`} className="mk-ticker-item">
                <CategoryPin code={item.category} size={24} />
                <span>{categoryOf(item.category).label}</span>
                <strong>{item.price}</strong>
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}

export function SampleJobs() {
  const copy = homeContent.categories;
  return (
    <Section id="isler" labelledBy="isler-title">
      <SectionHeading id="isler-title" eyebrow={copy.eyebrow} title={copy.title} intro={copy.intro} />
      <ul className="mk-category-row" aria-label="İş kategorileri">
        {jobCategories.map((category) => (
          <li key={category.code} className="mk-category-pill">
            <CategoryPin code={category.code} size={26} />
            {category.label}
          </li>
        ))}
      </ul>
      <ul className="mk-card-grid mk-job-grid">
        {sampleJobs.map((job) => (
          <li key={job.title} className="mk-job-card">
            <div className="mk-job-card-head">
              <CategoryPin code={job.category} size={30} />
              <span className="mk-job-card-category">{categoryOf(job.category).label}</span>
              <SampleBadge label={copy.sampleLabel} />
            </div>
            <h3 className="mk-job-card-title">{job.title}</h3>
            <p className="mk-job-card-employer">
              {job.employer} · {job.type}
            </p>
            <div className="mk-job-card-foot">
              <span className="mk-fact">
                <Icon name="pin" size={15} />
                {job.district}
              </span>
              <span className="mk-fact">
                <Icon name="clock" size={15} />
                {job.hours}
              </span>
              <strong className="mk-price">{job.price}</strong>
            </div>
          </li>
        ))}
      </ul>
      <p className="mk-footnote">
        {copy.disclaimer}{" "}
        <Link className="mk-text-link" href={copy.action.href}>
          {copy.action.label}
        </Link>
      </p>
    </Section>
  );
}

export function Stats() {
  return (
    <Section className="mk-stats-section">
      <dl className="mk-stats">
        {homeContent.stats.map((stat) => (
          <div key={stat.label} className="mk-stat">
            <dt>{stat.label}</dt>
            <dd className={stat.value.length > 2 ? "mk-stat-word" : undefined}>{stat.value}</dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}

export function About() {
  const copy = homeContent.about;
  return (
    <Section id="biz-kimiz" labelledBy="biz-title">
      <div className="mk-split">
        <div className="mk-split-visual">
          <div className="mk-mascot-stage">
            <span className="mk-mascot-backdrop" aria-hidden="true" />
            <Image
              src={mascot1}
              alt="Koala maskotu telefonda günlük iş ilanlarına bakıyor"
              sizes="(max-width: 700px) 80vw, 400px"
              className="mk-mascot"
            />
          </div>
        </div>
        <div className="mk-split-copy">
          <SectionHeading
            id="biz-title"
            eyebrow={copy.eyebrow}
            title={
              <>
                {copy.title[0]}{" "}
                <br />
                {copy.title[1]}
              </>
            }
            intro={copy.body}
          />
          <div className="mk-team">
            <Image src={head} alt="" height={44} width={Math.round(headRatio * 44)} style={{ height: 44, width: "auto" }} />
            <div>
              <p className="mk-team-name">{copy.team}</p>
              <p className="mk-team-school">{copy.school}</p>
            </div>
          </div>
          <Link className="mk-text-link" href={copy.action.href}>
            {copy.action.label}
            <Icon name="arrowRight" size={16} />
          </Link>
        </div>
      </div>
    </Section>
  );
}

export function WhyKoala() {
  const copy = homeContent.why;
  return (
    <Section id="neden-koala" tone="sunken" labelledBy="neden-title">
      <SectionHeading id="neden-title" eyebrow={copy.eyebrow} title={copy.title} intro={copy.intro} />
      <ul className="mk-card-grid mk-why-grid">
        {copy.cards.map((card) => (
          <li key={card.title} className="mk-feature-card">
            <IconTile icon={card.icon} tone={card.tone} />
            <h3>{card.title}</h3>
            <p>{card.body}</p>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/**
 * Nasıl çalışır: üç adımlı zaman çizgisi.
 *
 * Mockup'ta çizgi kaydırdıkça doluyor ve yanındaki görsel değişiyor; burada
 * hepsi statik. Görsel her adımın yanında duruyor, geniş ekranda sağ sütunda
 * ilki büyük gösteriliyor — etkileşim şart değil (#155) ve betiksiz hâli
 * sayfanın indekslenen hâliyle aynı.
 */
export function HowItWorks() {
  const copy = homeContent.how;
  return (
    <Section id="nasil-calisir" labelledBy="nasil-title">
      <SectionHeading id="nasil-title" eyebrow={copy.eyebrow} title={copy.title} intro={copy.intro} />
      <div className="mk-steps-layout">
        <ol className="mk-steps">
          {copy.steps.map((step, index) => (
            <li key={step.title} className="mk-step">
              <span className="mk-step-dot" aria-hidden="true">
                {index + 1}
              </span>
              <div className="mk-step-body">
                <p className="mk-step-time">{step.time}</p>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
                <span className={`mk-chip mk-chip-${step.tone}`}>
                  <Icon name={step.icon} size={16} />
                  {step.chip}
                </span>
                <Image
                  src={mascots[step.image]}
                  alt=""
                  sizes="(max-width: 900px) 60vw, 0px"
                  className="mk-step-image"
                />
              </div>
            </li>
          ))}
        </ol>
        <div className="mk-steps-visual" aria-hidden="true">
          <Image src={mascot1} alt="" sizes="(max-width: 900px) 0px, 420px" />
          <p>
            <strong>01</strong> / 03 <span>Haritayı açtın</span>
          </p>
        </div>
      </div>
      <p className="mk-section-foot">
        <Link className="mk-text-link" href={copy.action.href}>
          {copy.action.label}
          <Icon name="arrowRight" size={16} />
        </Link>
      </p>
    </Section>
  );
}

export function Campaign() {
  const copy = homeContent.campaign;
  return (
    <Section id="kampanya" tone="deep" labelledBy="kampanya-title">
      <div className="mk-split mk-campaign">
        <div className="mk-split-copy">
          <p className="mk-eyebrow">{copy.eyebrow}</p>
          <h2 id="kampanya-title" className="mk-title">
            {copy.title[0]}{" "}
            <br />
            {copy.title[1]}
          </h2>
          <p className="mk-intro">{copy.body}</p>
          <a className="button button-light" href={copy.action.href}>
            {copy.action.label}
            <Icon name="arrowRight" />
          </a>
        </div>
        <div className="mk-split-visual">
          <Image
            src={poster}
            alt={copy.posterAlt}
            sizes="(max-width: 700px) 90vw, 420px"
            className="mk-poster"
          />
        </div>
      </div>
      <div className="mk-campaign-mark">
        <Image src={markWhite} alt="" height={44} width={Math.round(markRatio * 44)} style={{ height: 44, width: "auto" }} />
      </div>
    </Section>
  );
}

export function Testimonials() {
  const copy = homeContent.testimonials;
  return (
    <Section id="yorumlar" labelledBy="yorumlar-title">
      <SectionHeading id="yorumlar-title" eyebrow={copy.eyebrow} title={copy.title} />
      <ul className="mk-card-grid mk-quote-grid">
        {copy.quotes.map((quote) => (
          <li key={quote.name}>
            <figure className="mk-quote">
              <p className="mk-stars">
                <span aria-hidden="true">★★★★★</span>
                <span className="visually-hidden">5 üzerinden 5 yıldız</span>
              </p>
              <blockquote>{quote.text}</blockquote>
              <figcaption>
                <span className="mk-avatar" style={{ background: quote.color }} aria-hidden="true">
                  {quote.initials}
                </span>
                <span>
                  <span className="mk-quote-name">{quote.name}</span>
                  <span className="mk-quote-meta">{quote.meta}</span>
                </span>
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function HomeFaq() {
  const copy = homeContent.faq;
  return (
    <Section id="sss" tone="sunken" narrow labelledBy="sss-title">
      <SectionHeading id="sss-title" eyebrow={copy.eyebrow} title={copy.title} />
      <FaqList items={frequentlyAskedQuestions.slice(0, 6)} />
      <p className="mk-section-foot">
        <Link className="mk-text-link" href={copy.action.href}>
          {copy.action.label}
          <Icon name="arrowRight" size={16} />
        </Link>
      </p>
    </Section>
  );
}
