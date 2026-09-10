import { SiteFooter } from "@/components/site-footer";
import { MainContent } from "@/components/main-content";
import { SiteHeader } from "@/components/site-header";

export function LegalLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <><SiteHeader /><MainContent className="page-shell legal-shell">{children}</MainContent><SiteFooter /></>;
}
