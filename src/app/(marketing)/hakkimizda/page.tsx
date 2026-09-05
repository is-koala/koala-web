import { MarketingPage } from "@/components/marketing-page";
import { marketingContent } from "@/content/marketing";
import { pageMetadata } from "@/lib/metadata";

const content = marketingContent.hakkimizda;
export const metadata = pageMetadata(content.title, content.description, "/hakkimizda");

export default function Page() {
  return <MarketingPage content={content} />;
}
