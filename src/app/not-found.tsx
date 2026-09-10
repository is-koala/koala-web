import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { MainContent } from "@/components/main-content";
import { SiteFooter } from "@/components/site-footer";

export default function NotFound() {
  return <><SiteHeader /><MainContent className="page-shell"><section className="hero hero-compact"><p className="eyebrow">404</p><h1>Bu sayfa burada değil.</h1><p className="lede">Bağlantı değişmiş veya sayfa kaldırılmış olabilir.</p><Link className="button button-primary" href="/">Ana sayfaya dön</Link></section></MainContent><SiteFooter /></>;
}
