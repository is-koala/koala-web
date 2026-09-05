import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export function LegalLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <><SiteHeader /><main className="page-shell legal-shell">{children}</main><SiteFooter /></>;
}
