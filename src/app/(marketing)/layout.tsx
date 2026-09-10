import { SiteHeader } from "@/components/site-header";
import { MainContent } from "@/components/main-content";
import { SiteFooter } from "@/components/site-footer";

export default function MarketingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <SiteHeader />
      <MainContent className="page-shell">{children}</MainContent>
      <SiteFooter />
    </>
  );
}
